const { Pool } = require("pg");
require("dotenv").config();

// Pool = a set of reusable DB connections (faster than opening one per request)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon / Supabase hosted DBs
  max: 10,          // max 10 connections in the pool
  idleTimeoutMillis: 30000,
});

module.exports = pool;