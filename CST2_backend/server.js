require("dotenv").config();

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

// ======================
// START SERVER
// ======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
