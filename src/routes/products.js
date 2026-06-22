const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/products
 *
 * Query params:
 *   limit    - how many products per page (default: 20, max: 100)
 *   cursor   - opaque string from previous response's nextCursor field
 *   category - optional category name to filter by
 *
 * How cursor-based pagination works:
 *   - First page: no cursor, get newest 20 products
 *   - Next page: pass the cursor from the previous response
 *   - The cursor encodes (created_at, id) of the LAST item on the current page
 *   - We fetch items strictly older than that point
 *   - This is stable: new inserts at the top never shift your position
 *
 * Why (created_at, id) and not just created_at?
 *   - Multiple products can share the same created_at timestamp
 *   - Adding the unique id as a tiebreaker makes the cursor unambiguous
 */
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const category = req.query.category || null;
    const cursorParam = req.query.cursor || null;

    // Decode the cursor (it's base64-encoded JSON)
    let cursorData = null;
    if (cursorParam) {
      try {
        cursorData = JSON.parse(Buffer.from(cursorParam, "base64").toString("utf8"));
      } catch {
        return res.status(400).json({ error: "Invalid cursor" });
      }
    }

    // Build the query dynamically
    // We use parameterised queries ($1, $2 ...) to prevent SQL injection
    const params = [];
    const conditions = [];

    // Category filter
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    // Cursor condition: fetch rows older than (or same time but lower id than) the cursor
    // The composite (created_at DESC, id DESC) ordering means:
    //   "newer" = higher created_at; ties broken by higher id
    // So "after the cursor" means: created_at < cursor.created_at
    //                           OR (created_at = cursor.created_at AND id < cursor.id)
    if (cursorData) {
      params.push(cursorData.created_at);
      params.push(cursorData.id);
      conditions.push(
        `(created_at < $${params.length - 1} OR (created_at = $${params.length - 1} AND id < $${params.length}))`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(limit + 1); 

    const sql = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(sql, params);
    const rows = result.rows;

    // If we got limit+1 rows, there IS a next page
    const hasNextPage = rows.length > limit;
    const products = hasNextPage ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasNextPage) {
      const lastItem = products[products.length - 1];
      const cursorPayload = {
        created_at: lastItem.created_at,
        id: lastItem.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString("base64");
    }

    res.json({
      products,
      nextCursor,     
      count: products.length,
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/products/categories
 * Returns all distinct categories — useful for building a filter dropdown in the UI
 */
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT category FROM products ORDER BY category"
    );
    res.json({ categories: result.rows.map((r) => r.category) });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;