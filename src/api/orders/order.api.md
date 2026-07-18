# Order API Plan

## POS Transaction Engine

---

## Schema Changes Needed

### Migration 016 — Add soft_reserved to inventory

```sql
ALTER TABLE inventory
ADD COLUMN soft_reserved NUMERIC(10) NOT NULL DEFAULT 0
CHECK (soft_reserved >= 0);
```

### Migration 017 — Add draft to order_status enum

```sql
ALTER TYPE order_status ADD VALUE 'draft';
```

> ⚠️ No changes needed to movement_type enum.
> Cart operations (scan/remove) do NOT create movement log entries.
> Movement log starts at checkout only.

---

## Updated Inventory Table

```
inventory
├── id, uuid
├── product_id (FK)
├── available_stock   → what new customers can buy right now
├── soft_reserved     → in active carts (scanned, not yet at checkout)
├── reserved_stock    → at payment processing stage
└── created_at, updated_at

physical_stock = available_stock + soft_reserved + reserved_stock
```

---

## Movement Type Enum — Unchanged

```
INITIAL     → first stock entry when product created
RESTOCK     → stock added via restock API
RESERVED    → checkout hit — first movement log entry
CONFIRMED   → payment success — stock permanently gone
REVERTED    → payment failed or order cancelled
EXPIRED     → cleanup job — abandoned order
```

> Cart scan and cart removal do NOT create movement log entries.
> This keeps the audit log clean — only meaningful committed events are logged.

---

## Complete API Surface

```
POST   /api/orders                          → create draft order
GET    /api/orders                          → list orders
GET    /api/orders/:uuid                    → order detail with items
POST   /api/orders/:uuid/items              → add item to cart (soft reserve)
DELETE /api/orders/:uuid/items/:itemUuid    → remove item from cart (restore soft reserve)
PATCH  /api/orders/:uuid/checkout           → draft → payment_pending + hard lock
PATCH  /api/orders/:uuid/hold               → put order on hold
PATCH  /api/orders/:uuid/cancel             → cancel order + restore stock
```

---

## Each Endpoint In Detail

---

### POST /api/orders — Create Draft Order

**Request:**

```json
{
  "sessionUuid": "uuid",
  "discount": 0
}
```

**Flow:**

```
1. Validate session exists and is OPEN → 409 if closed
2. INSERT order with status: DRAFT
3. Return order uuid and orderNumber
```

**No inventory impact.**

**Response:**

```json
{
  "success": true,
  "message": "Order created.",
  "data": {
    "uuid": "order-uuid",
    "orderNumber": "OID0000001",
    "status": "draft"
  }
}
```

---

### POST /api/orders/:uuid/items — Add Item to Cart

**Request:**

```json
{
  "productUuid": "uuid",
  "quantity": 2
}
```

**Flow:**

```
1. Validate order exists and is DRAFT → 404 / 409
2. Validate product exists and is ACTIVE → 404 / 409
3. BEGIN TRANSACTION
4. SELECT inventory FOR UPDATE (pessimistic lock — prevents concurrent scan race)
5. Check available_stock >= quantity → INSUFFICIENT_STOCK if not
6. UPDATE inventory:
   available_stock - quantity  (removed from available)
   soft_reserved   + quantity  (held in cart)
7. INSERT order_item with price snapshot:
   sell_price = product.sell_price (at time of scan)
   cost_price = product.cost_price (at time of scan)
   tax        = product.tax        (at time of scan)
8. Recalculate order totals from order_items (never store derived values)
9. UPDATE orders: sub_total, tax, total
10. COMMIT
```

**NO movement log entry — only inventory numbers updated.**

**Insufficient stock response:**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Insufficient stock",
    "details": {
      "productName": "Moleskine Classic Notebook A5",
      "sku": "OTH-MOL-A5",
      "requested": 2,
      "available": 1
    }
  }
}
```

**Success response:**

```json
{
  "success": true,
  "message": "Item added to order.",
  "data": {
    "orderUuid": "uuid",
    "item": {
      "uuid": "item-uuid",
      "productName": "Coca Cola 330ml",
      "quantity": 2,
      "sellPrice": 1.2,
      "total": 2.4
    },
    "orderTotal": 2.4
  }
}
```

---

### DELETE /api/orders/:uuid/items/:itemUuid — Remove Item from Cart

**Flow:**

```
1. Validate order is DRAFT → 409 if not
2. Get order_item → quantity, product_id
3. BEGIN TRANSACTION
4. SELECT inventory FOR UPDATE (lock prevents concurrent modification)
5. UPDATE inventory:
   available_stock + quantity  (restored to available)
   soft_reserved   - quantity  (released from cart)
6. DELETE order_item
7. Recalculate order totals from remaining items
8. UPDATE orders: sub_total, tax, total
9. COMMIT
```

**NO movement log entry.**

---

### PATCH /api/orders/:uuid/checkout — Checkout

**The most critical endpoint. Pessimistic locking happens here.**

**Flow:**

```
1. Validate order is DRAFT → 409 if not
2. Validate order has at least one item → 400 if empty
3. BEGIN TRANSACTION
4. SELECT inventory FOR UPDATE on ALL product_ids in order
   ORDER BY product_id  ← sorted to prevent deadlock
5. Re-validate ALL stock levels inside lock (source of truth)
   → available_stock check is done AGAIN inside lock
   → between scan and checkout another order may have taken stock
   → if any item insufficient → ROLLBACK → INSUFFICIENT_STOCK with full details
6. For each item UPDATE inventory:
   soft_reserved  - quantity  (released from cart)
   reserved_stock + quantity  (hard committed)
7. INSERT inventory_movement (RESERVED) for each item ← FIRST log entry
   stock_before and stock_after recorded
8. UPDATE order status: DRAFT → PAYMENT_PENDING
9. COMMIT
```

**Insufficient stock error (can list multiple failed items):**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Some items have insufficient stock",
    "details": [
      {
        "productName": "Moleskine Classic Notebook A5",
        "sku": "OTH-MOL-A5",
        "requested": 2,
        "available": 1
      }
    ]
  }
}
```

**Success response:**

```json
{
  "success": true,
  "message": "Order checked out. Proceed to payment.",
  "data": {
    "uuid": "order-uuid",
    "orderNumber": "OID0000001",
    "status": "payment_pending",
    "total": 8.74
  }
}
```

---

### PATCH /api/orders/:uuid/hold — Put On Hold

**Flow:**

```
1. Validate order is PAYMENT_PENDING → 409 if not
2. UPDATE order status: PAYMENT_PENDING → HOLD
3. Stock stays in reserved_stock — no inventory change
4. Cleanup job skips HOLD orders — no automatic expiry
5. Manual cashier action required to resume or cancel
```

---

### PATCH /api/orders/:uuid/cancel — Cancel Order

**Status-aware — different inventory restore depending on where order is.**

**Flow:**

```
1. Check current order status:
   DRAFT            → restore soft_reserved → available_stock (no movement log)
   PAYMENT_PENDING  → restore reserved_stock → available_stock + INSERT REVERTED log
   HOLD             → restore reserved_stock → available_stock + INSERT REVERTED log
   COMPLETED        → 409 cannot cancel completed order
   CANCELLED        → 409 already cancelled
   EXPIRED          → 409 already expired

2. BEGIN TRANSACTION
3. UPDATE inventory based on status above
4. INSERT inventory_movement (REVERTED) only if was PAYMENT_PENDING or HOLD
5. UPDATE order status → CANCELLED
6. COMMIT
```

---

### GET /api/orders — List Orders

**Query params:**

```
status        → filter by status
sessionUuid   → filter by counter session (show current session orders only)
page, limit   → pagination
order         → asc/desc (default: desc by created_at)
```

**Response — lightweight:**

```json
{
  "success": true,
  "message": "Orders fetched successfully.",
  "data": [
    {
      "uuid": "order-uuid",
      "orderNumber": "OID0000001",
      "status": "draft",
      "subTotal": 7.8,
      "tax": 0.94,
      "discount": 0,
      "total": 8.74,
      "itemCount": 3,
      "cashier": {
        "uuid": "...",
        "firstName": "Vijay",
        "lastName": "Singh"
      },
      "createdAt": "2026-07-08T10:00:00Z"
    }
  ],
  "meta": {
    "total": 47,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### GET /api/orders/:uuid — Order Detail

**Fully enriched — cashier, counter, all items with product info.**

```json
{
  "success": true,
  "message": "Order fetched successfully.",
  "data": {
    "uuid": "order-uuid",
    "orderNumber": "OID0000001",
    "status": "payment_pending",
    "discount": 0,
    "subTotal": 7.8,
    "tax": 0.94,
    "total": 8.74,
    "cashier": {
      "uuid": "...",
      "firstName": "Vijay",
      "lastName": "Singh"
    },
    "counter": {
      "uuid": "...",
      "name": "Counter 2",
      "code": "C002"
    },
    "items": [
      {
        "uuid": "item-uuid",
        "quantity": 1,
        "sellPrice": 3.0,
        "costPrice": 1.5,
        "tax": 0.36,
        "total": 3.0,
        "product": {
          "uuid": "...",
          "name": "Tropicana Orange Juice 1L",
          "sku": "BEV-TR-OJ-1L"
        }
      }
    ],
    "createdAt": "2026-07-08T10:00:00Z",
    "updatedAt": "2026-07-08T10:05:00Z"
  }
}
```

---

## Stock Movement Summary

Two separate concerns — inventory column changes and movement log entries.

---

### Inventory Column Changes

```
Action                        available_stock   soft_reserved   reserved_stock
───────────────────────────────────────────────────────────────────────────────
Add item to cart              -qty              +qty            —
Remove item from cart         +qty              -qty            —
Checkout                      —                 -qty            +qty
Payment success               —                 —               -qty
Payment failed                +qty              —               -qty
Cancel (DRAFT)                +qty              -qty            —
Cancel (PENDING/HOLD)         +qty              —               -qty
Cleanup (DRAFT expired)       +qty              -qty            —
Cleanup (PENDING expired)     +qty              —               -qty
```

---

### Movement Log Entries

```
Action                        movement_log
──────────────────────────────────────────
Add item to cart              NONE
Remove item from cart         NONE
Checkout                      RESERVED
Payment success               CONFIRMED
Payment failed                REVERTED
Cancel (DRAFT)                NONE
Cancel (PENDING/HOLD)         REVERTED
Cleanup (DRAFT expired)       EXPIRED
Cleanup (PENDING expired)     EXPIRED
```

---

## Key Design Decisions

```
1. Soft reservation at scan time
   → reduces surprise at checkout
   → other counters see reduced available_stock immediately
   → industry standard for physical POS

2. No movement log during cart phase
   → scan and remove are ephemeral cart operations
   → movement log only records committed events
   → keeps audit log clean and meaningful

3. Movement log starts at checkout
   → RESERVED is the first meaningful committed stock event
   → every entry after this has financial significance

4. Pessimistic lock at BOTH scan and checkout
   → scan: prevents two counters soft-reserving same last unit
   → checkout: prevents race between soft_reserved → reserved_stock

5. Sorted lock acquisition at checkout
   → ORDER BY product_id prevents deadlock
   → standard pattern for multi-row pessimistic locking

6. Double stock check
   → pre-lock check at scan (optimisation — avoids acquiring lock)
   → inside-lock check at checkout (correctness — source of truth)

7. Price snapshotting at scan time
   → sell_price, cost_price, tax captured when item added to cart
   → historical orders always show correct prices even if product changes

8. Order totals always recalculated
   → never store derived values
   → SUM from order_items on every change
   → prevents drift and rounding errors

9. Cancel is status-aware
   → DRAFT cancel restores soft_reserved (no log)
   → PAYMENT_PENDING/HOLD cancel restores reserved_stock (with log)
   → different inventory columns, different movement log behaviour
```

---

## Build Order

```
Step 1  → Migration 016: soft_reserved column on inventory
Step 2  → Migration 017: DRAFT status on order_status enum
Step 3  → Update IInventory model + row mapper + seeder
Step 4  → Update MovementType enum in TypeScript (no new values needed)
Step 5  → POST /api/orders (create draft)
Step 6  → POST /api/orders/:uuid/items (add item + soft reserve + lock)
Step 7  → DELETE /api/orders/:uuid/items/:itemUuid (remove + restore)
Step 8  → GET /api/orders/:uuid (enriched detail)
Step 9  → GET /api/orders (lightweight list)
Step 10 → PATCH /api/orders/:uuid/checkout (core endpoint + hard lock)
Step 11 → PATCH /api/orders/:uuid/cancel (status-aware restore)
Step 12 → PATCH /api/orders/:uuid/hold
Step 13 → POST /api/payments (80% success simulation)
Step 14 → Cleanup job (DRAFT + PAYMENT_PENDING older than 30 mins)
```

---

_Last updated: July 2026_
