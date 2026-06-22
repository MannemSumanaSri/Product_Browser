/**
 * Seed script — generates 200,000 products in the database.
 *
 * Run with: npm run seed
 *
 * APPROACH: bulk INSERT with unnest()
 * -----------------------------------
 * Inserting 200k rows one-by-one in a loop is very slow because each INSERT
 * is a separate round-trip to the database.
 *
 * Instead we use PostgreSQL's unnest() function, which lets us pass arrays
 * of values and expand them into rows server-side — all in a single query.
 * This is orders of magnitude faster (seconds vs. minutes).
 *
 * We split into batches of 10,000 to avoid hitting memory limits.
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Configuration ──────────────────────────────────────────────────────────────
const TOTAL_PRODUCTS = 200_000;
const BATCH_SIZE = 10_000;

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Books",
  "Home & Kitchen",
  "Sports",
  "Toys",
  "Beauty",
  "Automotive",
  "Garden",
  "Food & Grocery",
];

const ADJECTIVES = [
  "Premium", "Budget", "Pro", "Ultra", "Compact", "Deluxe",
  "Portable", "Smart", "Eco", "Vintage", "Modern", "Classic",
];

const NOUNS = [
  "Widget", "Gadget", "Gizmo", "Device", "Tool", "Kit",
  "Set", "Pack", "Bundle", "System", "Unit", "Module",
];

// Generate a random product name like "Premium Widget #12345"
function randomName(i) {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun} #${i + 1}`;
}

function randomCategory() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

// Random price between 1.00 and 999.99
function randomPrice() {
  return (Math.random() * 998.99 + 1).toFixed(2);
}

// Random timestamp spread across the last 2 years
function randomDate() {
  const now = Date.now();
  const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;
  return new Date(twoYearsAgo + Math.random() * (now - twoYearsAgo));
}

// ── Database setup ─────────────────────────────────────────────────────────────
async function createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      price       NUMERIC(10, 2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Index on (created_at DESC, id DESC) — this is exactly the ORDER BY we use
  // in our pagination query, so Postgres can satisfy it with an index scan
  // instead of sorting 200k rows on every request.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_created_at_id
    ON products (created_at DESC, id DESC)
  `);

  // Index for category filtering — allows fast WHERE category = '...' lookups
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (category)
  `);

  console.log("Table and indexes ready.");
}

// ── Bulk insert one batch ──────────────────────────────────────────────────────
async function insertBatch(batchIndex, size) {
  // Build arrays for each column
  const names = [];
  const categories = [];
  const prices = [];
  const createdAts = [];
  const updatedAts = [];

  for (let i = 0; i < size; i++) {
    const globalIndex = batchIndex * BATCH_SIZE + i;
    const createdAt = randomDate();
    names.push(randomName(globalIndex));
    categories.push(randomCategory());
    prices.push(randomPrice());
    createdAts.push(createdAt);
    updatedAts.push(createdAt); // start with updated_at = created_at
  }

  // unnest() expands parallel arrays into rows — one row per array element.
  // This sends a SINGLE query that inserts the whole batch atomically.
  await pool.query(
    `
    INSERT INTO products (name, category, price, created_at, updated_at)
    SELECT * FROM unnest(
      $1::text[],
      $2::text[],
      $3::numeric[],
      $4::timestamptz[],
      $5::timestamptz[]
    )
    `,
    [names, categories, prices, createdAts, updatedAts]
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`Seeding ${TOTAL_PRODUCTS.toLocaleString()} products...`);
  const startTime = Date.now();

await createTable();
await pool.query("TRUNCATE TABLE products RESTART IDENTITY");
const batches = Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const size = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - b * BATCH_SIZE);
    await insertBatch(b, size);
    const done = (b + 1) * BATCH_SIZE;
    console.log(`  Inserted ${Math.min(done, TOTAL_PRODUCTS).toLocaleString()} / ${TOTAL_PRODUCTS.toLocaleString()}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone! Seeded ${TOTAL_PRODUCTS.toLocaleString()} products in ${elapsed}s`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});