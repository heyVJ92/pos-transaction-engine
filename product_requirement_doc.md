# Product Requirements Document

## POS Transaction Engine

**Version:** 1.0  
**Status:** Active Development  
**Author:** Vijay Singh  
**Started:** June 2026  
**GitHub:** github.com/heyVJ92/pos-transaction-engine

---

## 1. Overview

### 1.1 Problem Statement

Point-of-sale systems face three critical reliability problems that are invisible until they cause real damage:

- **Concurrent billing:** Two cashiers simultaneously bill the last item in stock. Without concurrency control, both succeed — stock goes negative, a physical item is sold twice.
- **Network retries:** A payment request times out mid-flight. The client retries. Without idempotency, the customer is charged twice for one order.
- **Audit loss:** A server crashes during a write operation. Without async queue-backed logging, audit records are lost permanently — compliance fails, reconciliation is impossible.

This system solves all three with production-grade patterns implemented in working code.

### 1.2 What This Is

A backend API that simulates a warehouse inventory and billing system. The primary purpose is to demonstrate five production reliability patterns in a working, deployable system.

- The UI is a thin interactive shell — not the product
- The backend is the product
- Every pattern is demonstrable via the live demo

### 1.3 Who This Is For

Primary audience: hiring managers and technical interviewers evaluating backend engineering depth.

The system is designed so an evaluator can:

1. Hit the live URL
2. Place two simultaneous orders for the last item in stock
3. Watch one succeed and one return 503
4. Check the audit log
5. Reset to seed data and repeat

That 30-second demo tells the complete story.

---

## 2. Core Entities

### 2.1 Data Model

```
Users
├── id (internal), uuid (public), first_name, last_name
├── email (unique), role (admin | cashier), status (active | inactive)
└── created_at, updated_at

Products
├── id (internal), uuid (public), name, sku (unique)
├── category (enum), cost_price, sell_price, tax, weight
├── status (active | inactive)
└── created_at, updated_at

Inventory
├── id, uuid, product_id (FK → products, RESTRICT on delete)
├── available_stock (CHECK >= 0), reserved_stock (CHECK >= 0)
└── created_at, updated_at

Inventory Movement
├── id, uuid, product_id (FK), order_id (FK, nullable)
├── quantity, movement_type (RESERVED | CONFIRMED | REVERTED | EXPIRED)
├── reason
└── created_at

Orders
├── id (internal), uuid (public), user_id (FK)
├── status (PAYMENT_PENDING | COMPLETED | CANCELLED)
├── total
└── created_at, updated_at

Order Items
├── id, order_id (FK), product_id (FK)
├── quantity, price_at_order
└── created_at

Payments
├── id, uuid, order_id (FK)
├── status (PENDING | SUCCESS | FAILED)
├── amount, idempotency_key
└── created_at, updated_at

Idempotency Keys
├── id, key (unique), request_hash
├── response (JSONB), status (PENDING | COMPLETED | FAILED)
└── created_at, expires_at

Audit Logs
├── id, resource_type, resource_id
├── action, actor_id, before (JSONB), after (JSONB)
└── created_at
```

### 2.2 Key Constraints

- `inventory.product_id` → UNIQUE — one inventory row per product (single location)
- `inventory.available_stock` → CHECK >= 0 — stock never goes negative at DB level
- `products.sku` → UNIQUE — no duplicate SKUs
- `users.email` → UNIQUE — no duplicate accounts
- Products use soft delete (status: inactive) — never hard deleted if inventory exists

---

## 3. Order Processing Flow

### 3.1 Happy Path

```
1. Request arrives with Idempotency-Key header
   → missing key → 400 rejected immediately

2. Check idempotency_keys table
   → key exists + status COMPLETED → return stored response (no processing)
   → key exists + status PENDING   → 409 (request in flight)
   → key not found                 → insert new key, status PENDING, continue

3. Check stock availability (pre-lock optimisation)
   → any item has available_stock < requested → return INSUFFICIENT_STOCK error
   → all items available → continue

4. BEGIN TRANSACTION
   SELECT FROM inventory
   WHERE product_id = ANY($1)
   ORDER BY product_id  ← sorted to prevent deadlock
   FOR UPDATE           ← pessimistic lock acquired

5. Re-validate stock inside lock (source of truth check)
   → insufficient → ROLLBACK → return INSUFFICIENT_STOCK with comparison details

6. UPDATE inventory — reduce available_stock, increase reserved_stock
7. INSERT inventory_movement — status: RESERVED
8. INSERT order — status: PAYMENT_PENDING
9. INSERT order_items
   COMMIT ← locks released automatically

10. Update idempotency_keys — store response, status: COMPLETED
11. Return order response to client
```

### 3.2 Payment Flow

```
Payment request arrives with Idempotency-Key
        ↓
Idempotency check (same pattern as order)
        ↓
Process payment (80% success simulation)
        ↓
SUCCESS:
  → UPDATE inventory: reserved_stock - qty (stock permanently gone)
  → UPDATE inventory_movement: status CONFIRMED
  → UPDATE order: status COMPLETED
  → Update idempotency table

FAILED:
  → UPDATE inventory: available_stock + qty, reserved_stock - qty (instant restore)
  → UPDATE inventory_movement: status REVERTED
  → UPDATE order: status CANCELLED
  → Update idempotency table
```

### 3.3 Ghost Transaction Cleanup

Handles: network drops, server crashes, abandoned checkouts — where payment result never arrives.

```
Cleanup job runs every 5 minutes
  → Find orders: status PAYMENT_PENDING AND created_at < NOW() - 30 minutes
  → For each:
    → UPDATE inventory: restore stock
    → INSERT inventory_movement: status EXPIRED
    → UPDATE order: status CANCELLED
```

### 3.4 Concurrent Order Conflict Error Response

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Some items in your order have insufficient stock",
    "details": [
      {
        "product_id": "uuid",
        "name": "Product Name",
        "sku": "SKU-001",
        "requested": 5,
        "available": 0
      }
    ]
  }
}
```

---

## 4. API Reference

### 4.1 Products

```
GET  /api/products           → list products (filter: category, status, search, pagination)
POST /api/products           → create product
GET  /api/products/:uuid     → get single product
PUT  /api/products/:uuid     → update product
```

### 4.2 Inventory

```
GET  /api/inventory                         → list all inventory levels
GET  /api/inventory/:product_uuid           → stock level for one product
GET  /api/inventory/:product_uuid/movements → movement history
```

### 4.3 Orders

```
POST /api/orders         → place order (requires Idempotency-Key header)
GET  /api/orders         → list orders (filter: status, pagination)
GET  /api/orders/:uuid   → get order with items
```

### 4.4 Payments

```
POST /api/payments        → process payment (requires Idempotency-Key header)
GET  /api/payments/:uuid  → get payment status
```

### 4.5 Audit Logs

```
GET  /api/audit-logs  → list logs (filter: resource_type, action, pagination)
```

### 4.6 System

```
GET  /api/health       → database + Redis status
POST /api/demo/reset   → restore all seed data (demo only)
```

### 4.7 Response Shape Convention

```json
// Success
{ "success": true, "data": {} }

// Success with pagination
{ "success": true, "data": [], "meta": { "total": 47, "page": 1, "limit": 10, "totalPages": 5 } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human readable message" } }

// Validation error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

---

## 5. Reliability Patterns

### Pattern 1 — Pessimistic Locking

**Problem:** Two cashiers simultaneously bill the last item. Both read stock = 1. Both succeed. Stock = -1.  
**Solution:** `SELECT FOR UPDATE` locks inventory rows before any modification. Second request waits or times out.  
**Where:** `POST /api/orders` → order service → inventory repository

### Pattern 2 — Idempotency

**Problem:** Network drops mid-payment. Client retries. Customer charged twice.  
**Solution:** Every mutating request requires `Idempotency-Key` header. Keys stored with full response. Duplicates return stored response immediately.  
**Where:** `POST /api/orders`, `POST /api/payments` → idempotency middleware

### Pattern 3 — Async Audit Logging (Version 2)

**Problem:** Synchronous audit writes add latency to every request. Server crash loses logs.  
**Solution:** BullMQ queue with 3 retries and dead letter queue. Audit writes never block the main request.  
**Where:** Every write operation → audit queue worker

### Pattern 4 — Rate Limiting

**Problem:** Single client floods the API, degrades service for all users.  
**Solution:** Token bucket algorithm, 100 requests/minute per IP. Returns 429 with Retry-After header.  
**Where:** Global middleware on all routes

### Pattern 5 — Graceful Shutdown (Version 2)

**Problem:** Server restart kills in-flight requests mid-transaction. Data corruption.  
**Solution:** SIGTERM handler drains in-flight requests before process exits.  
**Where:** `app.ts` → SIGTERM handler

---

## 6. Non-Functional Requirements

```
Performance
→ API response p95 under 200ms at normal load
→ No query over 100ms without index justification
→ Rate limiter adds less than 5ms per request
→ Queue jobs processed within 1 second of submission

Reliability
→ Zero audit logs lost even if Redis restarts
→ Zero duplicate orders on network retry
→ Zero stock going below zero
→ Cleanup job recovers all ghost transactions

Code Quality
→ TypeScript strict mode — zero any
→ Zod validation on every external input
→ Parameterized queries — no SQL injection surface
→ No silent failures — every error logged with correlation ID
```

---

## 7. Seed Data

```
Users:     1 admin, 9 cashiers — static, no auth required for V1
Products:  20 products across 4 categories with realistic pricing
Inventory: mixed stock levels — some high, some critically low (for demo)
```

Demo scenario requires at least one product with `available_stock = 1` so the concurrent order conflict can be demonstrated immediately.

---

## 8. Version Roadmap

| Version | Theme         | Key Additions                                                                                       |
| ------- | ------------- | --------------------------------------------------------------------------------------------------- |
| V1      | Ship It       | Core APIs, pessimistic locking, idempotency, sync audit log, in-memory rate limiter, Railway deploy |
| V2      | Reliability   | Redis, BullMQ async queue, Pino logging, graceful shutdown, cleanup job                             |
| V3      | Testing       | Jest unit tests, Supertest integration, concurrency test, GitHub Actions CI                         |
| V4      | Docker        | Dockerfile, docker-compose, multi-stage build                                                       |
| V5      | Observability | Prometheus, Grafana, Loki, Sentry                                                                   |
| V6      | AWS           | EC2, RDS, ElastiCache, S3, CloudWatch, k6 load test                                                 |

---

## 9. Acceptance Criteria

### V1 Complete When:

- [ ] Two simultaneous POST /api/orders for same low-stock product — one 200, one 503
- [ ] Same Idempotency-Key sent twice — identical response, no duplicate order in DB
- [ ] Payment failure — stock restored instantly, order cancelled
- [ ] Ghost transaction — cleanup job cancels after 30 minutes, stock restored
- [ ] 20 products seeded with realistic data
- [ ] All endpoints return consistent response shape
- [ ] TypeScript compiles with zero errors in strict mode
- [ ] Live URL accessible on Railway
- [ ] README covers setup and demo walkthrough

---

## 10. Out of Scope (V1)

```
→ Authentication    — static cashier user, no login required
→ RBAC             — all requests treated equally
→ Real payment     — 80% success simulation only
→ Multi-location   — single warehouse
→ Customers        — walk-in model, no customer records
→ Barcode scanning — manual product selection
→ Receipts         — out of scope for backend demo
→ Multi-currency   — single currency
```

---

_Last updated: June 2026 · Living document — updated as decisions are made_
