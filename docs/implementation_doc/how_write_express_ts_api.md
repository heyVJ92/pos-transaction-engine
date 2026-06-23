# How to Write an Express + TypeScript API Endpoint

A reference guide based on the `GET /api/users` implementation. Follow this pattern for every new resource (products, orders, etc.).

---

## Architecture: 5-Layer Pattern

```
Request
  ↓
Routes  (<resource>.routes.ts)
  → validateQuery middleware   ← validates req.query via Zod, attaches to res.locals
  → controller handler
      ↓
Controller  (<resource>.controller.ts)
  → reads res.locals.validatedQuery, calls service, formats HTTP response
      ↓
Service  (<resource>.service.ts)
  → business logic — pagination calc, rules, orchestrates repository calls
      ↓
Repository  (<resource>.repository.ts)
  → raw SQL, row mapper — returns plain data, no HTTP or business concepts
      ↓
Database (PostgreSQL via pg pool)
```

| Layer | File | Responsibility |
|---|---|---|
| Schema | `<resource>.schema.ts` | Zod schema + inferred TypeScript type |
| Middleware | `src/middlewares/validate.ts` | Shared — validates `req.query`, attaches to `res.locals` |
| Routes | `<resource>.routes.ts` | Wiring only: middleware chain + handler |
| Controller | `<resource>.controller.ts` | HTTP in/out, calls service |
| Service | `<resource>.service.ts` | Business logic, orchestrates repository |
| Repository | `<resource>.repository.ts` | SQL queries, row mapping |

**Layer import rule — never skip a layer:**
- Controller imports from **service** only
- Service imports from **repository** only
- Repository imports from **database config** only

---

## Folder Structure per Resource

```
src/
  middlewares/
    validate.ts               ← shared across ALL resources (write once)
  api/
    <resource>/
      <resource>.schema.ts
      <resource>.repository.ts
      <resource>.service.ts
      <resource>.controller.ts
      <resource>.routes.ts
```

Wire the router into `src/app.ts`:
```typescript
import userRouter from "./api/users/user.routes.js";
app.use("/api/users", userRouter);  // after express.json(), before error handler
```

---

## 1. Schema (`user.schema.ts`)

Defines the shape of valid query params. Used by the middleware, not the controller.

```typescript
import * as z from "zod";  // "import * as z" — project convention from env.ts
import { UserRole, UserStatus } from "../../db/models/user.model.js";

export const getUsersQuerySchema = z.object({
    role:   z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    search: z.string().min(1).max(100).optional(),
    page:   z.coerce.number().int().min(1).default(1),   // coerce: query params arrive as strings
    limit:  z.coerce.number().int().min(1).max(100).default(10),
    sort:   z.enum(["created_at", "first_name", "last_name", "email"]).optional(),
    order:  z.enum(["asc", "desc"]).optional(),
});

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
```

**Rules:**
- `z.coerce.number()` — always use for numeric query params; they arrive as strings.
- `sort` must be a Zod `z.enum([...])` allowlist of real DB column names — it gets interpolated into SQL (ORDER BY can't be parameterized).
- `z.nativeEnum` for TypeScript enums; `z.enum([...])` for plain string unions.

---

## 2. Shared Middleware (`src/middlewares/validate.ts`)

Written once. Reused by every resource's route file.

```typescript
import type { Request, Response, NextFunction } from "express";
import * as z from "zod";

export function validateQuery(schema: z.ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                error: {
                    code:    "VALIDATION_ERROR",
                    message: "Invalid query parameters",
                    details: parsed.error.flatten().fieldErrors,
                },
            });
            return;  // MUST return here — otherwise next() runs after the 400
        }
        res.locals["validatedQuery"] = parsed.data;
        next();
    };
}
```

**Rules:**
- Always `return` after `res.status(400).json(...)` — without it, `next()` executes too.
- `res.locals["validatedQuery"]` (bracket notation) — avoids `exactOptionalPropertyTypes` issues with Express's `locals` typing.
- This file lives in `src/middlewares/`, not inside a resource folder — it belongs to no single resource.

---

## 3. Routes (`user.routes.ts`)

Chains the validate middleware before the controller handler. Wiring only — no logic.

```typescript
import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { getUsersQuerySchema } from "./user.schema.js";
import { listUsersHandler } from "./user.controller.js";

const userRouter = Router();
userRouter.get("/", validateQuery(getUsersQuerySchema), listUsersHandler);
export default userRouter;
```

This is the **only** file that knows which schema applies to which handler.

---

## 4. Controller (`user.controller.ts`)

Reads the pre-validated data from `res.locals`, calls the service, sends the response. No validation, no SQL.

```typescript
import type { Request, Response, NextFunction } from "express";
import type { GetUsersQuery } from "./user.schema.js";
import { listUsers } from "./user.service.js";

export async function listUsersHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const params = res.locals["validatedQuery"] as GetUsersQuery;
    const result = await listUsers(params);

    res.json({
        success: true,
        data: result.users,
        meta: {
            total:      result.total,
            page:       result.page,
            limit:      result.limit,
            totalPages: result.totalPages,
        },
    });
}
```

**Rules:**
- No `try/catch` — Express 5 auto-forwards rejected async promises to `globalErrorHandler`.
- No Zod calls — validation already happened in the middleware.
- `import type` for all Express types (`verbatimModuleSyntax` is on).
- Calls **service** only — never imports from the repository.

---

## 5. Service (`user.service.ts`)

Business logic. Answers: **"what does the business need?"**

```typescript
import type { GetUsersQuery } from "./user.schema.js";
import type { IUser } from "../../db/models/user.model.js";
import { findManyUsers } from "./user.repository.js";

export interface UsersPage {
    users:      IUser[];
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
}

export async function listUsers(params: GetUsersQuery): Promise<UsersPage> {
    const { users, total } = await findManyUsers(params);

    return {
        users,
        total,
        page:       params.page,
        limit:      params.limit,
        totalPages: Math.ceil(total / params.limit),  // business concept — not a DB concern
    };
}
```

**Rules:**
- Never imports `pool` or writes SQL.
- Never imports `Request`/`Response`.
- This is where role-based rules, data enrichment, and cross-resource logic go in the future.
- `totalPages` lives here — it's derived from business inputs (limit), not raw DB output.

---

## 6. Repository (`user.repository.ts`)

Pure DB layer. Answers: **"what does the database return?"** Returns `{ users, total }` — no pagination metadata.

### Row type (private — mirrors DB snake_case)

```typescript
interface UserRow {
    id:         number;
    uuid:       string;
    first_name: string;
    last_name:  string;
    email:      string;
    role:       string;
    status:     string;
    created_at: Date;
    updated_at: Date;
}
```

### Mapper (snake_case DB → camelCase IUser)

```typescript
function rowToUser(row: UserRow): IUser {
    return {
        id:        row.id,
        uuid:      row.uuid,
        firstName: row.first_name,
        lastName:  row.last_name,
        email:     row.email,
        role:      row.role as UserRole,    // safe: DB ENUM enforces valid values
        status:    row.status as UserStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
```

### Dynamic WHERE builder (accumulator pattern)

```typescript
function buildWhereClause(params: GetUsersQuery) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.role   !== undefined) { conditions.push(`role = $${idx++}`);   values.push(params.role); }
    if (params.status !== undefined) { conditions.push(`status = $${idx++}`); values.push(params.status); }

    if (params.search !== undefined) {
        // $idx referenced 3 times — push the value ONCE, increment idx ONCE
        conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`);
        values.push(`%${params.search}%`);
        idx++;
    }

    return {
        sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
        nextIndex: idx,
    };
}
```

### Main export

```typescript
export interface UserQueryResult { users: IUser[]; total: number; }

export async function findManyUsers(params: GetUsersQuery): Promise<UserQueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);

    const sortCol   = params.sort  ?? "created_at";
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total FROM users ${where}`;
    const dataSql  = `
        SELECT id, uuid, first_name, last_name, email, role, status, created_at, updated_at
        FROM users
        ${where}
        ORDER BY ${sortCol} ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // COUNT and data are independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<UserRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a JS string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        users: dataResult.rows.map(rowToUser),
        total,
    };
}
```

---

## Response Shape Convention

Always use this shape (matches `/health` and the global error handler in `app.ts`):

**200 OK:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "uuid": "...", "firstName": "Jane", "lastName": "Doe",
      "email": "...", "role": "admin", "status": "active",
      "createdAt": "2024-01-15T10:30:00.000Z", "updatedAt": "2024-01-15T10:30:00.000Z" }
  ],
  "meta": { "total": 47, "page": 1, "limit": 10, "totalPages": 5 }
}
```

**400 Validation Error** (from `validateQuery` middleware):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": { "role": ["Invalid enum value. Expected 'admin' | 'cashier'"] }
  }
}
```

**500 Server Error:** handled by the global error handler in `app.ts` — no extra work needed.

---

## TypeScript Strict Mode Checklist

| Flag | What to do |
|---|---|
| `noUncheckedIndexedAccess` | `rows[0]?.field ?? fallback` — never `rows[0].field` directly |
| `exactOptionalPropertyTypes` | Omit optional keys; never assign `undefined` to them |
| `verbatimModuleSyntax` | `import type` for type-only imports (Express types, interfaces) |
| `nodenext` module | All local imports must end in `.js` (even in `.ts` source files) |

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Business logic in controller | Move to service — controller is HTTP translation only |
| Controller importing repository directly | Always go Controller → Service → Repository |
| `$N` reuse in ILIKE search | Push search value **once**, reference `$idx` three times, increment `idx` **once** |
| Forgetting `return` in middleware after 400 | Without `return`, `next()` runs and the request continues |
| `COUNT(*)` returned as string | Always wrap in `Number(countResult.rows[0]?.total ?? 0)` |
| Raw user input in ORDER BY | Validate `sort` via Zod `z.enum([...])` allowlist before interpolating |
| Missing `.js` on local imports | nodenext ESM requires `.js` extension on all local imports |
| Express 4 async error handling | This project uses Express 5 — async rejections propagate automatically |
