const axios = require("axios");

async function fetchPlantLive(plantId) {
  const response = await axios.get(
    `https://api.taneko.net/plant/${plantId}/live`,
    {
      params: {
        api_key: process.env.TANEKO_API_KEY
      }
    }
  );

  return response.data;
}

module.exports = { fetchPlantLive };