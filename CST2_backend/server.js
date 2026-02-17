console.log("File is running...");

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
  console.log("✓ Test endpoint called - Client connected!");
  res.json({ 
    message: "Backend connected successfully!",
    timestamp: new Date().toISOString(),
    status: "connected"
  });
});

app.listen(3000, '0.0.0.0', () => {
  console.log("Server running on port 3000");
});

