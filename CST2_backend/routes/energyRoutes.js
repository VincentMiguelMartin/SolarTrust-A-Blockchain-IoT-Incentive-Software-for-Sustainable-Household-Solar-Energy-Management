const express = require("express");
const router = express.Router();
const { syncEnergy } = require("../controllers/energyController");

router.get("/sync/:plantId", syncEnergy);

module.exports = router;