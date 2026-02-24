require("dotenv").config();
try {
  require("./cron/tanekoCron");
} catch (error) {
  console.warn("[cron] Skipping Taneko cron job:", error.message);
}

const express = require("express");
const cors = require("cors");
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
// START SERVER
// ======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
