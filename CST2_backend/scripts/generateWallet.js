require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { generateWallet } = require("../services/blockchainService");

generateWallet()
  .then(({ seed, address }) => {
    console.log("\n=== ADD THESE TO YOUR .env FILE ===\n");
    console.log(`WALLET_SEED_PHRASE=${seed}`);
    console.log(`CARDANO_WALLET_ADDRESS=${address}`);
    console.log("\n====================================\n");
    console.log("IMPORTANT: Save the seed phrase somewhere safe.");
    console.log("Anyone with it has full control of the wallet.\n");
  })
  .catch((err) => {
    console.error("Failed to generate wallet:", err.message);
  });
