# API Patterns & Standards
## POS Transaction Engine

Reference guide for consistent patterns across all APIs.
Updated as new patterns are established.

---

## 1. Response Shape Convention

### Success
```json
{
  "success": true,
  "message": "Resource fetched successfully.",
  "data": {}
}
```

### Success with Pagination
```json
{
  "success": true,
  "message": "Products fetched successfully.",
  "data": [],
  "meta": {
    "total": 47,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {}
  }
}
```

---

## 2. Response Helpers

```typescript
// src/utils/response.ts

sendSuccess(res, message, data?, statusCode?)   // 200
sendCreated(res, message, data?)                // 201
sendPaginated(res, message, data, meta)         // 200 with meta
sendError(res, code, message, statusCode?)      // 400 default
```

**Rule:** Always use helpers. Never write `res.json()` directly in controllers.

---

## 3. HTTP Status Codes

```
200 → success (GET, PATCH, DELETE)
201 → created (POST)
400 → validation error
404 → resource not found
409 → conflict (duplicate SKU, already inactive)
429 → rate limit exceeded
500 → internal server error (global handler)
```

---

## 4. Layered Architecture

```
Request
  ↓
Router         → maps URL + method to controller
  ↓
Middleware     → validate (query/body/params) → res.locals
  ↓
Controller     → reads res.locals, calls service, sends response
  ↓
Service        → business logic, decisions, orchestration
  ↓
Repository     → raw SQL only, row mapper, returns plain objects
  ↓
Database
```

### Rules Per Layer

| Layer | Responsibility | Never Does |
|---|---|---|
| Router | URL mapping only | No logic |
| Controller | HTTP in/out | No SQL, no business rules |
| Service | Business decisions | No SQL, no HTTP types |
| Repository | SQL queries | No business rules, no HTTP types |

---

## 5. Validation Middleware

```typescript
// src/middlewares/validate.ts
validateQuery(schema, target)

// targets
"query"   → req.query  → res.locals.validatedQuery
"body"    → req.body   → res.locals.validatedBody
"params"  → req.params → res.locals.validatedParams
```

### Usage in Routes

```typescript
// query only
router.get("/", validateQuery(listSchema, "query"), handler);

// body only
router.post("/", validateQuery(createSchema, "body"), handler);

// params + body (chain middlewares)
router.patch("/:uuid",
  validateQuery(paramsSchema, "params"),
  validateQuery(updateSchema, "body"),
  handler
);

// params + query
router.get("/:uuid/items",
  validateQuery(paramsSchema, "params"),
  validateQuery(querySchema, "query"),
  handler
);
```

### Reading in Controller

```typescript
const { uuid } = res.locals["validatedParams"];
const body     = res.locals["validatedBody"] as CreateOrderBody;
const query    = res.locals["validatedQuery"] as ListOrdersQuery;
```

---

## 6. Zod Schema Standards

```typescript
// numeric query params → always coerce (arrive as strings)
page:  z.coerce.number().int().min(1).default(1),
limit: z.coerce.number().int().min(1).max(100).default(10),

// TypeScript enums → z.enum() in Zod v4
category: z.enum(ProductCategory).optional(),

// sort column → allowlist only (injected into SQL ORDER BY)
sort: z.enum(["name", "created_at", "sell_price"]).optional(),

// string validation
name: z.string().min(1).max(255),
sku:  z.string().min(1).max(50),

// strict mode on query schemas → rejects unknown fields
}).strict()
```

---

## 7. Public vs Internal IDs

```
Internal id (integer) → joins, foreign keys, DB operations only
Public uuid (string)  → API responses, URL params, client communication

Never expose integer id in API responses.
Always use uuid for external communication.
```

### Stripping id from Response

```typescript
// single resource
const { id, ...publicData } = product;
sendSuccess(res, "Product fetched.", publicData);

// list
const publicProducts = products.map(({ id, ...rest }) => rest);
```

### TypeScript Pattern

```typescript
// in model file
export interface IProduct {
  id: number;       // internal
  uuid: string;     // public
  name: string;
  // ...
}

export type IProductPublic = Omit<IProduct, "id">;
```

---

## 8. Row Mapper Pattern

Database returns snake_case. TypeScript uses camelCase. Map at the boundary.

```typescript
// private — mirrors DB columns exactly
interface ProductRow {
  id: number;
  uuid: string;
  name: string;
  cost_price: string;  // pg returns NUMERIC as string
  sell_price: string;
  created_at: Date;
}

// mapper — one place for snake_case → camelCase conversion
const rowToProduct = (row: ProductRow): IProduct => ({
  id:        row.id,
  uuid:      row.uuid,
  name:      row.name,
  costPrice: Number(row.cost_price),  // always Number() for NUMERIC
  sellPrice: Number(row.sell_price),
  createdAt: row.created_at,
});
```

### Rules
- `NUMERIC` columns always return as strings from pg → wrap in `Number()`
- `rows[0]?.field ?? fallback` — never `rows[0].field` (noUncheckedIndexedAccess)
- Row types are private to the repository file — never exported

---

## 9. Dynamic WHERE Clause Builder

```typescript
const buildWhereClause = (params: ListQuery) => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conditions.push(`status = $${idx++}`);
    values.push(params.status);
  }

  if (params.search) {
    // one value, referenced three times — push ONCE, increment ONCE
    conditions.push(
      `(name ILIKE $${idx} OR sku ILIKE $${idx} OR description ILIKE $${idx})`
    );
    values.push(`%${params.search}%`);
    idx++;
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    nextIndex: idx,
  };
};
```

### Pagination Query Pattern

```typescript
const [countResult, dataResult] = await Promise.all([
  pool.query(`SELECT COUNT(*) AS total FROM products ${where}`, values),
  pool.query(
    `SELECT ... FROM products ${where}
     ORDER BY ${sortCol} ${sortOrder}
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    [...values, params.limit, (params.page - 1) * params.limit]
  ),
]);

const total = Number(countResult.rows[0]?.total ?? 0);
```

---

## 10. Dynamic UPDATE Builder

```typescript
// maps camelCase body keys to snake_case DB columns
const columnMap: Record<string, string> = {
  name:      "name",
  costPrice: "cost_price",
  sellPrice: "sell_price",
  tax:       "tax",
  weight:    "weight",
};

const buildUpdateSql = (body: UpdateBody) => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(body)) {
    const column = columnMap[key];
    if (!column) continue; // skip unknown fields
    clauses.push(`${column} = $${idx}`);
    values.push(value);
    idx++;
  }

  clauses.push(`updated_at = NOW()`);

  return { sql: clauses.join(", "), values };
};

// usage in repository
const { sql, values } = buildUpdateSql(body);
await pool.query(
  `UPDATE products SET ${sql}
   WHERE uuid = $${values.length + 1} AND status = $${values.length + 2}`,
  [...values, uuid, ProductStatus.ACTIVE]
);
```

---

## 11. DB Error Handling

```typescript
// src/utils/db-errors.ts

// PostgreSQL error codes
"23505" → UNIQUE_VIOLATION      (duplicate SKU, email etc)
"23503" → FOREIGN_KEY_VIOLATION (referenced row doesn't exist)
"23502" → NOT_NULL_VIOLATION    (required field missing)
"40P01" → DEADLOCK_DETECTED     (concurrent transaction conflict)
"55P03" → LOCK_NOT_AVAILABLE    (pessimistic lock timeout)
```

### Pattern in Repository

```typescript
try {
  await pool.query(...);
} catch (err) {
  handleDbError(err); // converts PG error → DatabaseError
  throw err;          // unreachable, satisfies TypeScript
}
```

### Pattern in Service

```typescript
try {
  await repository.update(uuid, body);
  return "success";
} catch (err) {
  if (err instanceof DatabaseError && err.code === "UNIQUE_VIOLATION") {
    return "sku_conflict";
  }
  throw err; // unexpected → bubble to global handler
}
```

### Outcome Pattern in Controller

```typescript
switch (result) {
  case "not_found":   sendError(res, "PRODUCT_NOT_FOUND", "...", 404); return;
  case "sku_conflict": sendError(res, "SKU_ALREADY_EXISTS", "...", 409); return;
  case "success":     sendSuccess(res, "Updated successfully."); return;
}
```

---

## 12. UUID to ID Conversion

Client always sends uuid. DB needs integer id. Convert at the service/repository layer.

### Single Lookup

```typescript
// service layer
const product = await findProductByUuid(uuid);
if (!product) return "not_found";
const productId = product.id; // use for DB operations
```

### Bulk Lookup (Orders with Multiple Items)

```sql
-- pass array of uuids, get back ids + needed data in one query
SELECT id, uuid, sell_price, cost_price, tax
FROM products
WHERE uuid = ANY($1::uuid[])
AND status = 'active'
```

---

## 13. Enriched Response Pattern

For complex resources (orders, counter sessions) — JOIN related data and return enriched response.

### Order Detail Response Shape

```json
{
  "uuid": "order-uuid",
  "status": "payment_pending",
  "subTotal": 2.40,
  "tax": 0.29,
  "discount": 0,
  "total": 2.69,
  "cashier": {
    "uuid": "user-uuid",
    "firstName": "Vijay",
    "lastName": "Singh"
  },
  "counter": {
    "uuid": "counter-uuid",
    "name": "Counter 1",
    "code": "C001"
  },
  "items": [
    {
      "uuid": "item-uuid",
      "quantity": 2,
      "sellPrice": 1.20,
      "total": 2.40,
      "product": {
        "uuid": "product-uuid",
        "name": "Coca Cola 330ml",
        "sku": "BEV-CC-330"
      }
    }
  ],
  "createdAt": "2026-06-25T10:00:00Z"
}
```

### Multiple Rows → Single Object (Collapsing JOINs)

```typescript
const rowsToOrder = (rows: OrderRow[]): IOrderDetail => {
  const first = rows[0]!;
  return {
    uuid:     first.uuid,
    status:   first.status,
    subTotal: Number(first.sub_total),
    cashier: {
      uuid:      first.cashier_uuid,
      firstName: first.cashier_first_name,
    },
    items: rows
      .filter(r => r.item_uuid)  // exclude empty orders
      .map(r => ({
        uuid:      r.item_uuid,
        quantity:  r.quantity,
        sellPrice: Number(r.sell_price),
        total:     r.quantity * Number(r.sell_price),
        product: {
          uuid: r.product_uuid,
          name: r.product_name,
        }
      }))
  };
};
```

---

## 14. Order Totals — Always Recalculate

Never store derived values. Always recalculate from source of truth.

```sql
UPDATE orders SET
  sub_total = (
    SELECT COALESCE(SUM(quantity * sell_price), 0)
    FROM order_items
    WHERE order_id = $1
  ),
  tax = (
    SELECT COALESCE(SUM(quantity * tax), 0)
    FROM order_items
    WHERE order_id = $1
  ),
  total = sub_total + tax - discount,
  updated_at = NOW()
WHERE id = $1
```

---

## 15. Immutable Records

Some tables are never updated — only inserted.

```
inventory_movement  → immutable, no updated_at
order_items         → immutable, no updated_at
audit_logs          → immutable, no updated_at
```

If you need to "undo" — insert a new compensating record, never update the old one.

---

## 16. Soft Delete Standard

Never hard delete. Change status instead.

```typescript
// ❌ never
DELETE FROM products WHERE uuid = $1

// ✅ always
UPDATE products SET status = 'inactive', updated_at = NOW()
WHERE uuid = $1
```

DB-level protection: `ON DELETE RESTRICT` on foreign keys pointing to soft-deleted tables.

---

## 17. Price Snapshotting

Capture prices at the time of transaction — never reference current price for historical orders.

```
order_items.sell_price  → price at time of order
order_items.cost_price  → cost at time of order
order_items.tax         → tax rate at time of order
```

If product price changes tomorrow — last month's orders still show correct prices.

---

## 18. Folder & File Naming

```
API folders    → plural   (products/, orders/, counters/)
Source files   → singular (product.controller.ts)
Sub-resources  → subfolder under parent (counters/sessions/)
Exceptions     → inventory/ (grammatically awkward as inventories/)
```

### File Naming Pattern

```
<resource>.controller.ts
<resource>.repository.ts
<resource>.service.ts
<resource>.schema.ts
<resource>.routes.ts
```

---

## 19. TypeScript Strict Mode Checklist

| Flag | What To Do |
|---|---|
| `noUncheckedIndexedAccess` | `rows[0]?.field ?? fallback` — never `rows[0].field` |
| `exactOptionalPropertyTypes` | Omit optional keys; never assign `undefined` explicitly |
| `verbatimModuleSyntax` | `import type` for type-only imports |
| `nodenext` module | All local imports must end in `.js` |
| `strict` | No `any` — use `unknown` and narrow |

---

## 20. Dates

```
Backend  → always ISO 8601 UTC  "2026-06-25T10:00:00Z"
Frontend → formats for user's timezone using dayjs or date-fns
Never    → format dates on the backend
```

---

*Last updated: June 2026 · Add new patterns as they are established*
