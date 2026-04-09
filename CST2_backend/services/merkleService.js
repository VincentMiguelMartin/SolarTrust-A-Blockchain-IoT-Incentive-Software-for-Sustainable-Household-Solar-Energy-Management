const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function buildLeafHash(plantId, solarWatts, gridWatts, ts) {
  const raw = `${plantId}|${solarWatts}|${gridWatts}|${ts}`;
  return sha256(raw);
}

function buildMerkleTree(readings) {
  if (!readings || readings.length === 0) {
    throw new Error("Cannot build Merkle tree from empty readings array");
  }

  const leaves = readings.map((r) =>
    buildLeafHash(
      r.household_id,
      r.solar_watts,
      r.grid_watts,
      r.ts
    )
  );

  let level = [...leaves];

  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]);
    }

    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      nextLevel.push(sha256(level[i] + level[i + 1]));
    }
    level = nextLevel;
  }

  return {
    merkleRoot: level[0],
    leaves,
  };
}

function verifyReading(reading, merkleRoot, leaves) {
  const leafHash = buildLeafHash(
    reading.household_id,
    reading.solar_watts,
    reading.grid_watts,
    reading.ts
  );

  if (!leaves.includes(leafHash)) {
    return false;
  }

  let level = [...leaves];
  if (level.length % 2 !== 0) {
    level.push(level[level.length - 1]);
  }

  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]);
    }
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      nextLevel.push(sha256(level[i] + level[i + 1]));
    }
    level = nextLevel;
  }

  return level[0] === merkleRoot;
}

// Public API: accepts { plantId, solarWatts, gridWatts, ts } — returns hex root string
function buildMerkleRoot(readings) {
  if (!readings || readings.length === 0) {
    throw new Error("Cannot build Merkle root from empty readings array");
  }

  let level = readings.map((r) =>
    buildLeafHash(r.plantId, r.solarWatts, r.gridWatts, r.ts)
  );

  while (level.length > 1) {
    if (level.length % 2 !== 0) {
      level.push(level[level.length - 1]);
    }
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256(level[i] + level[i + 1]));
    }
    level = next;
  }

  return level[0];
}

module.exports = {
  buildLeafHash,
  buildMerkleRoot,
  buildMerkleTree,
  verifyReading,
};
