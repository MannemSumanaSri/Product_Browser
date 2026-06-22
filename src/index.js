require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const productsRouter = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());           // allow requests from any origin (needed for hosted frontend)
app.use(express.json());   // parse JSON request bodies

// Serve the bonus UI from the /public folder
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/api/products", productsRouter);

// Health check — Render pings this to confirm the server is alive
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root
app.get("/", (req, res) => {
  res.json({
    message: "Product Browser API",
    endpoints: {
      products: "GET /api/products?limit=20&cursor=<cursor>&category=<category>",
      categories: "GET /api/products/categories",
      health: "GET /health",
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});