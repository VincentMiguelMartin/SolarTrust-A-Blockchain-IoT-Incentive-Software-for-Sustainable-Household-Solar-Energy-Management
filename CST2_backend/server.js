require("dotenv").config();
try {
  require("./cron/tanekoCron");
} catch (error) {
  console.warn("[cron] Skipping Taneko cron job:", error.message);
}

const express = require("express");
const cors = require("cors");
const {
  getLatestBlock,
  getTransactionStatus,
  getWalletUtxos,
} = require("./services/blockfrostService");
const { recordEnergyOnChain, runBatch } = require("./services/blockchainRecordService");
const { createClient } = require("@supabase/supabase-js");

console.log("File is running...");
console.log("Running file:", __filename);

const app = express();

app.use(cors());
app.use(express.json());

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase environment variables are missing.");
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ======================
// ROUTES
// ======================

// Basic test
app.get("/test", (req, res) => {
  res.json({
    message: "Backend connected successfully!",
    timestamp: new Date().toISOString(),
    status: "connected",
  });
});

// DB connection test
app.get("/db-test", async (req, res) => {
  try {
    const { data, error } = await supabase.from("households").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ CREATE HOUSEHOLD
app.post("/households", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const { data, error } = await supabase
      .from("households")
      .insert([{ name }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ household: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ✅ INSERT READING
app.post("/readings", async (req, res) => {
  try {
    const { householdId, ts, solarWatts, gridWatts } = req.body;

    if (!householdId || !ts || solarWatts == null || gridWatts == null) {
      return res.status(400).json({
        error: "householdId, ts, solarWatts, gridWatts are required",
      });
    }

    const { data, error } = await supabase
      .from("readings")
      .insert([
        {
          household_id: householdId,
          ts,
          solar_watts: solarWatts,
          grid_watts: gridWatts,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ reading: data });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// SYNC LIVE DATA FROM TANEKO
app.get("/energy/sync/:plantId", async (req, res) => {
  try {
    const { plantId } = req.params;
    if (!plantId) {
      return res.status(400).json({ error: "plantId is required" });
    }

    const base = process.env.TANEKO_BASE_URL || "https://api.taneko.net/plant";
    const baseUrl = `${base}/${encodeURIComponent(plantId)}/live`;
    const search = new URLSearchParams();
    if (process.env.TANEKO_API_KEY) {
      search.set("api_key", process.env.TANEKO_API_KEY);
    }

    const response = await fetch(
      search.size ? `${baseUrl}?${search.toString()}` : baseUrl
    );
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Taneko request failed with status ${response.status}`,
      });
    }

    const payload = await response.json();
    const values = Array.isArray(payload?.values) ? payload.values : [];
    if (!values.length) {
      return res.status(502).json({ error: "No values returned from Taneko" });
    }

    const latest = [...values].sort(
      (a, b) => Date.parse(b.ts || "") - Date.parse(a.ts || "")
    )[0];

    const reading = {
      ts: latest.ts ?? null,
      solarWatts: Number(latest.sap ?? 0),
      gridWatts: Number(latest.iap ?? 0),
      exportWatts: Number(latest.eap ?? 0),
      powerFactor: Number(latest.pf ?? 0),
    };

    return res.json({
      plantId,
      unit: payload?.unit ?? null,
      reading,
      latest,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

// ======================
// BLOCKCHAIN ROUTES
// ======================

// GET /blockchain/status — Cardano connectivity check
app.get("/blockchain/status", async (_req, res) => {
  try {
    const latestBlock = await getLatestBlock();
    res.json({
      connected: true,
      network: process.env.BLOCKFROST_NETWORK || "preprod",
      latestBlock,
    });
  } catch (e) {
    res.status(502).json({ connected: false, error: String(e) });
  }
});

// GET /blockchain/tx/:txHash — transaction status
app.get("/blockchain/tx/:txHash", async (req, res) => {
  try {
    const { txHash } = req.params;
    const status = await getTransactionStatus(txHash);
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /blockchain/record — record a single energy reading on-chain
app.post("/blockchain/record", async (req, res) => {
  try {
    const { plantId, solarWatts, gridWatts, exportWatts, ts } = req.body;
    if (!plantId || solarWatts == null || gridWatts == null || exportWatts == null || !ts) {
      return res.status(400).json({
        error: "plantId, solarWatts, gridWatts, exportWatts, ts are required",
      });
    }
    const result = await recordEnergyOnChain(plantId, solarWatts, gridWatts, exportWatts, ts);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /blockchain/batch — batch pending readings and submit Merkle root
app.post("/blockchain/batch", async (req, res) => {
  try {
    const { plantId } = req.body;
    if (!plantId) {
      return res.status(400).json({ error: "plantId is required" });
    }
    const result = await runBatch(plantId);
    if (!result) {
      return res.json({ message: "No pending readings to batch" });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /blockchain/wallet — wallet UTXOs
app.get("/blockchain/wallet", async (_req, res) => {
  try {
    const address = process.env.CARDANO_WALLET_ADDRESS;
    if (!address) {
      return res.status(500).json({ error: "CARDANO_WALLET_ADDRESS not set" });
    }
    const utxos = await getWalletUtxos(address);
    res.json({ address, utxos });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});


// ======================
// GAME SESSION ROUTES
// ======================

// POST /game/session — record a completed game session
app.post("/game/session", async (req, res) => {
  try {
    const { householdId, cleanliness, score } = req.body;

    if (!householdId || cleanliness == null || score == null) {
      return res.status(400).json({
        error: "householdId, cleanliness, and score are required",
      });
    }

    const completedAt = new Date().toISOString();

    const { error } = await supabase.from("game_sessions").insert([
      {
        household_id: householdId,
        cleanliness,
        score,
        completed_at: completedAt,
      },
    ]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    console.log(
      `[game] Session recorded for ${householdId}, score: ${score}, cleanliness: ${cleanliness}%`
    );

    res.json({
      success: true,
      message: "Game session recorded",
      householdId,
      score,
      cleanliness,
      completedAt,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ======================
// DASHBOARD ROUTES
// ======================

// GET /dashboard/:userId — user energy + game summary
app.get("/dashboard/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Confirmed readings for this household
    const { data: readings, error: readingsErr } = await supabase
      .from("readings")
      .select("solar_watts")
      .eq("household_id", userId)
      .eq("blockchain_status", "confirmed");

    if (readingsErr) {
      return res.status(500).json({ error: readingsErr.message });
    }

    const totalVerifiedEnergyWatts = (readings || []).reduce(
      (sum, r) => sum + (r.solar_watts || 0),
      0
    );
    const totalConfirmedReadings = (readings || []).length;

    // Game sessions for this household
    const { data: sessions, error: sessionsErr } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("household_id", userId);

    if (sessionsErr) {
      return res.status(500).json({ error: sessionsErr.message });
    }

    const totalGameSessions = (sessions || []).length;

    // rewardPoints uses eap * 2 temporarily until the full formula is implemented
    res.json({
      userId,
      totalVerifiedEnergyWatts,
      totalConfirmedReadings,
      totalGameSessions,
      rewardPoints: totalVerifiedEnergyWatts * 2,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ======================
// START SERVER
// ======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
