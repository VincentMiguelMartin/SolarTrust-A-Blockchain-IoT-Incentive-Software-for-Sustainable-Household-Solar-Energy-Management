const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function saveEnergyReading({
  plant_id,
  solar_power_kw,
  export_kw,
  import_kw,
  timestamp,
  reward_points,
}) {
  const { data, error } = await supabase
    .from("readings")
    .insert([
      {
        household_id: plant_id,
        ts: timestamp,
        solar_watts: solar_power_kw,
        grid_watts: import_kw,
        export_watts: export_kw,
        blockchain_status: "pending",
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`saveEnergyReading failed: ${error.message}`);
  return { ...data, reward_points };
}

module.exports = { saveEnergyReading };
