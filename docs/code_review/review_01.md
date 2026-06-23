# Code Review — StockAPI / POS Transaction Engine

> Raw SQL over ORM is a deliberate learning choice and is **not** flagged as an issue.
> Rating is based on code quality, correctness, and engineering maturity — not feature completeness.

---

## Overall Rating: ⭐⭐⭐ 3.2 / 5 — Competent Intermediate

The infrastructure instincts are strong (UUID pattern, TIMESTAMPTZ, Zod env validation, pool config).
The bugs that exist are the kind a senior dev would catch in a first PR review — fixable, not catastrophic.

---

## BUGS (will break at runtime)

### 1. Enum Value Mismatch — `ProductCategory.OTHERS`
**Files:** `src/db/models/product.model.ts` vs `src/db/migrations/002_create_product.ts`

TypeScript enum has `OTHERS = "others"` (plural), but the PostgreSQL `product_category` ENUM only
allows `'other'` (singular). Any INSERT using `ProductCategory.OTHERS` will throw a PostgreSQL type
violation error.

```ts
// model — WRONG
export enum ProductCategory {
    OTHERS = "others"   // ← "others"
}

// migration — correct
CREATE TYPE product_category AS ENUM ('beverages', 'snacks', 'grocery', 'dairy', 'other');
//                                                                                  ↑ "other"
```

**Fix:** Change the enum value to `OTHER = "other"`.

---

### 2. No camelCase ↔ snake_case Mapping
**Files:** All model interfaces vs actual pg query results

TypeScript models use camelCase (`firstName`, `costPrice`, `sellPrice`, `availableStock`), but `pg`
returns column names exactly as they appear in the DB — snake_case (`first_name`, `cost_price`).
There is no transform layer anywhere.

```ts
const user: IUser = rows[0];
console.log(user.firstName); // undefined at runtime — pg returned user.first_name
```

TypeScript won't catch this because `rows` from `pg` is typed as `any[]`. These bugs are completely
silent until you observe wrong data in responses.

**Fix (pick one):**
- Alias every column in SQL: `SELECT first_name AS "firstName" FROM users`
- Write a row-mapper utility once and reuse it per model
- Use `pg`'s `types` with a global camelCase transform

---

### 3. `weight` is Not Optional in `IProduct`
**File:** `src/db/models/product.model.ts`

The migration defines `weight NUMERIC(10, 3)` with no `NOT NULL` — it is nullable. The TypeScript
interface says `weight: number`, which doesn't allow `null` or `undefined`. This creates a type lie.

```ts
// current — wrong
weight: number;

// correct
weight: number | null;
```

---

### 4. Dynamic `import()` in Migrations Breaks in Compiled Build
**File:** `src/db/migrate.ts`

```ts
const migrationFile = await import(`./migrations/${filename}`);
```

- **ts-node (dev):** works — resolves `.ts` files.
- **compiled dist/ (prod):** fails — `filename` is `001_create_user.ts` but the compiled output has
  `.js` files. The dynamic import path won't resolve.

**Fix:** Use `fs.readFile` to load SQL as plain strings, or store migrations as `.sql` files and
read them with `fs.readFile`. Plain `.sql` files work identically in dev and prod with no import
trickery.

---

## CODE QUALITY ISSUES

### 5. Unused Variable in `env.ts`
**File:** `src/config/env.ts`

```ts
const env = process.env;   // ← declared, never used

const result = envSchema.safeParse(process.env)  // ← uses process.env directly
```

Dead code — delete the `const env = process.env` line.

---

### 6. `dotenv` Loaded Twice
**Files:** `src/app.ts` and `src/config/database.ts`

`import "dotenv/config"` appears in both files. The comment in `database.ts` even says
`// first line of app.ts, before anything else` — which contradicts it being in `database.ts`.

Dotenv is idempotent so it won't break anything, but it signals ownership confusion. Load it exactly
once, in `app.ts`, before any other local imports.

---

### 7. `IPRODUCT` Naming Inconsistency
**File:** `src/db/models/product.model.ts`

```ts
export interface IPRODUCT { ... }   // ← all caps
export interface IUser { ... }      // ← PascalCase
export interface IInventory { ... } // ← PascalCase
```

Should be `IProduct` to match the rest of the codebase.

---

### 8. `migrationFiles()` Doesn't Sort
**File:** `src/db/migrate.ts`

```ts
export const migrationFiles = async (path: string) => {
    const files = await fs.readdir(path);
    return files;  // ← unsorted
};
```

`fs.readdir` order is filesystem-dependent (not alphabetical on all OSes). Sorting happens after
filtering in `runMigration`, which means you only sort the subset of *new* files — not the full
sequence. If migrations 002 and 003 are both new, they might run out of order on some systems.

**Fix:** `.sort()` the result inside `migrationFiles` before returning.

---

### 9. `runMigration()` Auto-Executes at Module Level
**File:** `src/db/migrate.ts`

```ts
runMigration().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
```

Fine for a standalone script, but if `migrate.ts` is ever imported (e.g., in test setup or a future
admin controller), it immediately triggers a full migration run. Wrap it in a module-entry guard:

```ts
import { fileURLToPath } from "url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runMigration().catch((err) => {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    });
}
```

---

### 10. Internal Functions Exported Unnecessarily
**File:** `src/db/migrate.ts`

`ensureMigrationsTable`, `alreadyRunMigrations`, `migrationFiles`, and `migrationTransaction` are
all exported. These are internal implementation details of `runMigration`. Exporting them leaks the
module's internals and creates an artificial public API surface. Only `runMigration` should be
exported (and only if it's intended for use elsewhere).

---

### 11. `down` Exports With No Runner
**Files:** All migration files

Every migration exports `const down = ...` but `migrate.ts` never reads or uses it. This is a
half-implementation that creates false expectations. Either:
- Add a `rollback` command to `migrate.ts` that runs `down`, or
- Remove the `down` exports until you're ready to implement rollback

---

### 12. `updated_at` Will Never Auto-Update
**Files:** All migration files

```sql
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

`DEFAULT NOW()` fires only on `INSERT`, not `UPDATE`. Without a trigger or explicit
`SET updated_at = NOW()` in every UPDATE statement, this column will always hold the row's creation
time — silently wrong data.

**Fix (recommended):** Add a reusable trigger function once:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Apply the same trigger to `products` and `inventory`.

---

## ARCHITECTURAL NOTES

### 13. `.env` Appears to Be Committed
The `.env` file with `DATABASE_URL=postgresql://postgres:admin@localhost:5433/pos_engine` is
readable in the repo. Real credentials must never be in source control — add `.env` to `.gitignore`
and use only `.env.example` as the committed template (which you already have).

---

### 14. `connectDB` Startup Check is Slightly Wasteful
```ts
const client = await pool.connect();
console.log("✅ Database connected");
client.release();
```

`pool.connect()` acquires a dedicated client from the pool just to release it immediately. A lighter
health check that doesn't allocate a pooled client:

```ts
await pool.query('SELECT 1');
console.log("✅ Database connected");
```

---

## WHAT'S DONE WELL

| What | Why it matters |
|---|---|
| TypeScript strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | Catches an entire class of runtime bugs at compile time. Most projects don't enable these extra flags. |
| Zod env validation with `process.exit(1)` on failure | Fail-fast on bad config is production-correct. Better than silent `undefined` values deep in the app. |
| UUID + serial ID pattern | UUID externally, integer FK internally — correct for distributed-safe IDs with fast joins. |
| `TIMESTAMPTZ` everywhere | Timezone-aware timestamps. Plain `TIMESTAMP` is a silent footgun in multi-timezone systems. |
| `CHECK (available_stock >= 0)` | Business invariant enforced at the DB level, not just in application code. |
| `ON DELETE RESTRICT` on inventory → products FK | Prevents orphaned inventory rows if a product is deleted. Correct defensive default. |
| Migration transactions on a dedicated client | Many tutorials get this wrong — using `pool.query` instead of a dedicated `client` means BEGIN and COMMIT can run on different connections. This code gets it right. |
| Pool config with timeouts | `idleTimeoutMillis` and `connectionTimeoutMillis` are frequently omitted and cause silent production hangs. |
| ESM throughout | Modern and correct. Avoids the CommonJS/ESM dual-module hazard. |
| Express v5 | Adopting v5 already — async errors are caught automatically, no `try/catch` wrappers needed in route handlers. |

---

## PRIORITIZED FIX LIST

| Priority | Issue | File |
|---|---|---|
| 🔴 Critical | Enum value mismatch `OTHERS` vs `other` | `src/db/models/product.model.ts` |
| 🔴 Critical | No camelCase mapper for pg results | All models + future query files |
| 🔴 Critical | Dynamic `import()` breaks in compiled build | `src/db/migrate.ts` |
| 🟡 High | `weight` not optional in `IProduct` | `src/db/models/product.model.ts` |
| 🟡 High | `updated_at` never auto-updates | All migration files |
| 🟡 High | `.env` committed to source control | `.gitignore` (root) |
| 🟢 Medium | Unused `const env` in env.ts | `src/config/env.ts` |
| 🟢 Medium | `dotenv` loaded twice | `src/app.ts` + `src/config/database.ts` |
| 🟢 Medium | `migrationFiles()` unsorted | `src/db/migrate.ts` |
| 🟢 Medium | Auto-execute guard missing | `src/db/migrate.ts` |
| 🔵 Low | `IPRODUCT` → `IProduct` naming | `src/db/models/product.model.ts` |
| 🔵 Low | Unnecessary internal exports | `src/db/migrate.ts` |
| 🔵 Low | `down` exports with no runner | All migration files |

---

*Reviewed: 2026-06-22*
