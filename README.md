# Product Browser API

A high-performance backend service for browsing **200,000 products** with efficient cursor-based pagination, category filtering, and PostgreSQL indexing.

The project focuses on building a scalable API that remains consistent even when data changes during browsing.

---

## 🚀 Live Deployment

**API Base URL**

https://product-browser-xs8a.onrender.com

### Endpoints

| Feature | Endpoint |
|---|---|
| Products API | `/api/products` |
| Categories | `/api/products/categories` |
| Health Check | `/health` |

Example:

```
https://product-browser-xs8a.onrender.com/api/products?limit=20
```

---

# 📌 Problem Statement

Build a backend system that allows users to:

- Browse approximately 200,000 products
- View products ordered by newest first
- Filter products by category
- Paginate efficiently
- Maintain correct pagination results even when new products are added or existing products are updated

---

# 🛠 Tech Stack

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL
- Neon PostgreSQL

### Libraries
- pg (PostgreSQL client)
- dotenv
- cors

### Deployment
- Render (Backend Hosting)

---

# ✨ Features

## Product Browsing

- Fetch products with newest-first ordering
- Supports configurable page size
- Maximum limit protection
- Optimized database queries

---

## Cursor-Based Pagination

Instead of traditional OFFSET pagination, this project uses cursor pagination.

### Why?

OFFSET pagination becomes unreliable when data changes.

Example:

```
Page 1 → Products 1-20

New products inserted

Page 2 using OFFSET may skip products
or return duplicates
```

Cursor pagination solves this by remembering the exact position of the last item.

The cursor contains:

```
(created_at, id)
```

The next request fetches:

```sql
WHERE 
created_at < cursor_created_at
OR
(
 created_at = cursor_created_at
 AND id < cursor_id
)

ORDER BY created_at DESC, id DESC
LIMIT 20
```

Benefits:

✅ No duplicate products  
✅ No missing products  
✅ Stable browsing during database changes  

---

# 📂 Project Structure

```
Product_Browser
│
├── public
│   └── index.html              # Bonus UI
│
├── scripts
│   └── seed.js                 # Generates 200k products
│
├── src
│   │
│   ├── db.js                   # PostgreSQL connection pool
│   ├── index.js                # Express server
│   │
│   └── routes
│       └── products.js         # Product APIs
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

# ⚡ Database Design

Products table:

```sql
products

id
name
category
price
created_at
updated_at
```

---

# 🚄 Performance Optimization

## Database Indexing

To support fast pagination:

```sql
CREATE INDEX idx_products_created_at_id
ON products(created_at DESC, id DESC);
```

This matches:

```sql
ORDER BY created_at DESC, id DESC
```

allowing PostgreSQL to use an index scan instead of sorting large datasets.

---

For category filtering:

```sql
CREATE INDEX idx_products_category_cursor
ON products(category, created_at DESC, id DESC);
```

This optimizes:

```sql
WHERE category = ?
ORDER BY created_at DESC, id DESC
LIMIT 20
```

---

# 🌱 Data Generation

The project includes a seed script that generates:

```
200,000 products
```

Each product contains:

- Unique ID
- Product name
- Category
- Price
- Created timestamp
- Updated timestamp


## Bulk Insert Strategy

Instead of inserting rows individually:

❌ Slow approach:

```
INSERT 1 row
INSERT 1 row
INSERT 1 row
...
```

The project uses PostgreSQL `unnest()`:

```
Generate arrays
      ↓
Send batch of 10,000 rows
      ↓
PostgreSQL expands arrays into rows
```

This significantly reduces database round trips.

---

# 🔌 API Documentation

## Get Products

```
GET /api/products
```

### Query Parameters

| Parameter | Type | Default | Description |
|-|-|-|-|
| limit | number | 20 | Number of products |
| cursor | string | null | Pagination cursor |
| category | string | null | Filter category |

Example:

```
GET /api/products?limit=10&category=Electronics
```

Response:

```json
{
  "products": [],
  "nextCursor": "cursor_value",
  "count": 10
}
```

---

## Get Categories

```
GET /api/products/categories
```

Example response:

```json
{
 "categories":[
   "Electronics",
   "Books",
   "Sports"
 ]
}
```

---

## Health Check

```
GET /health
```

Response:

```json
{
 "status":"ok",
 "timestamp":"2026-06-22T00:00:00.000Z"
}
```

---

# 💻 Local Development

## Clone Repository

```bash
git clone <repository-url>

cd Product_Browser
```

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment Variables

Create:

```
.env
```

Add:

```env
DATABASE_URL=your_postgresql_connection_string
```

---

## Generate Database Data

Run:

```bash
npm run seed
```

This will:

- Create products table
- Create indexes
- Insert 200,000 products

---

## Start Application

Production:

```bash
npm start
```

Development:

```bash
npm run dev
```

Server runs:

```
http://localhost:3000
```

---

# 🔐 Security

Implemented:

- Environment variable based configuration
- Parameterized SQL queries
- No database credentials committed
- `.env` excluded using `.gitignore`

---

# 📈 Future Improvements

With additional time:

- Add product search using PostgreSQL full-text search
- Add price range filtering
- Add sorting options
- Add API rate limiting
- Add Redis caching
- Add automated API tests
- Add Docker support
- Add CI/CD pipeline

---

# 🤖 AI Usage

AI tools were used as development assistants.

Used for:

- Generating initial Express boilerplate
- Reviewing SQL queries
- Exploring PostgreSQL bulk insert strategies
- Improving documentation

The final architecture decisions, pagination approach, indexing strategy, and implementation were tested and understood before integration.

---

# 👤 Author

**Sumana Sri**

GitHub:
https://github.com/MannemSumanaSri