# Product Browser

A backend that lets you browse ~200,000 products (newest first), filter by category, and paginate — with **stable cursor-based pagination**.

## Live Demo
- **API:** `https://<your-render-url>/api/products`
- **UI:** `https://<your-render-url>/`

---

## Local Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd product-browser
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — paste your Neon DATABASE_URL

# 3. Seed the database (creates table, indexes, and 200k products)
npm run seed

# 4. Start the server
npm start
# or for development with auto-reload:
npm run dev
```

Server starts on `http://localhost:3000`

---

## API Reference

### `GET /api/products`

Returns a page of products (newest first).

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 20 | Products per page (max 100) |
| `cursor` | string | — | Cursor from previous response's `nextCursor` |
| `category` | string | — | Filter by category name |

**Example response:**
```json
{
  "products": [
    {
      "id": 199823,
      "name": "Premium Widget #199823",
      "category": "Electronics",
      "price": "49.99",
      "created_at": "2025-01-15T10:23:00Z",
      "updated_at": "2025-01-15T10:23:00Z"
    }
  ],
  "nextCursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0...",
  "count": 20
}
```

Pass `nextCursor` as `?cursor=` on the next request to get the next page. When `nextCursor` is `null`, you've reached the end.

### `GET /api/products/categories`

Returns all distinct category names.

### `GET /health`

Health check endpoint.

---

## Design Decisions

### Why cursor-based pagination (not OFFSET)?

The naive approach is `LIMIT 20 OFFSET 400`. This breaks when data changes:

> You're on page 20. Someone inserts 5 new products. Now "OFFSET 400" skips 5 different products — you've missed them permanently.

**Cursor pagination** anchors to a specific row instead of a position. We encode the `(created_at, id)` of the last seen product as the cursor. The next page query is:

```sql
WHERE (created_at < :cursor_time OR (created_at = :cursor_time AND id < :cursor_id))
ORDER BY created_at DESC, id DESC
LIMIT 21
```

New inserts at the top never shift your position. You can never see duplicates or skip rows.

### Why `(created_at, id)` as the cursor key?

`created_at` alone isn't unique — many products can share the same timestamp. Adding `id` as a tiebreaker makes the cursor unambiguous.

### Why these indexes?

```sql
CREATE INDEX idx_products_created_at_id ON products (created_at DESC, id DESC);
CREATE INDEX idx_products_category ON products (category);
```

The first index matches our `ORDER BY` exactly, so Postgres does an **index scan** instead of sorting 200k rows on every request. The second speeds up `WHERE category = ?` filters. Without indexes, each request would be a full table scan — fine for small data, catastrophically slow for 200k rows.

### Why PostgreSQL + `unnest()` for seeding?

Inserting 200k rows one at a time in a JS loop would take minutes (each row = one network round-trip). Using `unnest()` we pass all data as arrays in a **single query** and let Postgres expand them server-side. One network round-trip per 10k rows = seeding in seconds.

---

## What I'd Improve With More Time

1. **Search** — full-text search on product name using `pg_trgm` or a search index
2. **Price range filter** — `?minPrice=10&maxPrice=100`
3. **Sort options** — by price, by name, not just by date
4. **Rate limiting** — prevent abuse on the public API
5. **Caching** — Redis cache for the first page (most accessed), invalidated on new inserts
6. **Tests** — unit tests for the cursor encode/decode logic and integration tests for pagination correctness

---

## How I Used AI

- Used Claude to **write the boilerplate** (Express setup, CORS, dotenv wiring) and the frontend UI
- Used it to **double-check the SQL** for the composite cursor condition — I wrote the logic, AI verified the edge cases
- AI suggested using `unnest()` for bulk inserts, which I hadn't used before — I read the Postgres docs to understand it before using it
- The **cursor pagination design** — the core challenge — I reasoned through myself after understanding why OFFSET breaks

---

## Project Structure

```
product-browser/
├── scripts/
│   └── seed.js          ← generates 200k products (bulk insert)
├── src/
│   ├── db.js            ← PostgreSQL connection pool
│   ├── index.js         ← Express app entry point
│   └── routes/
│       └── products.js  ← /api/products with cursor pagination
├── public/
│   └── index.html       ← bonus UI
├── .env.example
├── package.json
└── README.md
```