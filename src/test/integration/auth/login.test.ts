import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";

import { pool } from "../../../config/database.js";
import env from "../../../config/env.js";
import { SALT_ROUNDS } from "../../../utils/constants.js";
import { closeDb, resetDb } from "../../helpers/db.js";
import app from "../../../app.js";
import { UserRole, UserStatus } from "../../../db/models/user.model.js";

const PLAINTEXT_PASSWORD = "correct-horse-battery-staple";

// seedBaseFixtures (test/helpers/db.ts) doesn't set password_hash, so it can't be reused here —
// login needs a real bcrypt hash to compare against. Seeded directly, not through any endpoint,
// since there's no signup/register endpoint to create a user through.
async function seedUser(overrides: { email: string; role?: UserRole; status?: UserStatus }): Promise<void> {
    const passwordHash = await bcrypt.hash(PLAINTEXT_PASSWORD, SALT_ROUNDS);
    await pool.query(
        `INSERT INTO users (first_name, last_name, email, role, status, password_hash)
         VALUES ('Test', 'User', $1, $2, $3, $4)`,
        [overrides.email, overrides.role ?? UserRole.CASHIER, overrides.status ?? UserStatus.ACTIVE, passwordHash]
    );
}

describe("Auth integration — POST /auth/login against a real DB", () => {
    beforeEach(async () => {
        await resetDb();
    });

    afterAll(async () => {
        await closeDb();
    });

    it("logs in successfully for a seeded active user; the returned token decodes to the correct sub/role", async () => {
        await seedUser({ email: "active-cashier@test.local", role: UserRole.CASHIER });

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "active-cashier@test.local", password: PLAINTEXT_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.data.accessToken).toBe("string");

        const decoded = jwt.verify(res.body.data.accessToken, env.JWT_SECRET) as jwt.JwtPayload;
        expect(decoded.role).toBe(UserRole.CASHIER);

        const { rows } = await pool.query<{ id: number }>(`SELECT id FROM users WHERE email = $1`, ["active-cashier@test.local"]);
        expect(decoded.sub).toBe(String(rows[0]!.id));
    });

    it("rejects login (401 INVALID_CREDENTIALS) for an active user with the wrong password", async () => {
        await seedUser({ email: "active-cashier@test.local", role: UserRole.CASHIER });

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "active-cashier@test.local", password: "definitely-the-wrong-password" });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects login (401 INVALID_CREDENTIALS) for a seeded user with status: inactive, even with the correct password", async () => {
        await seedUser({ email: "inactive-user@test.local", status: UserStatus.INACTIVE });

        const res = await request(app)
            .post("/auth/login")
            .send({ email: "inactive-user@test.local", password: PLAINTEXT_PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects login (401 INVALID_CREDENTIALS) for an email with no matching user at all", async () => {
        const res = await request(app)
            .post("/auth/login")
            .send({ email: "nobody@test.local", password: PLAINTEXT_PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("a token issued by a real login is accepted by requireAuth on a real protected route (GET /products)", async () => {
        await seedUser({ email: "real-login@test.local", role: UserRole.ADMIN });

        const loginRes = await request(app)
            .post("/auth/login")
            .send({ email: "real-login@test.local", password: PLAINTEXT_PASSWORD });
        expect(loginRes.status).toBe(200);

        const productsRes = await request(app)
            .get("/products")
            .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

        expect(productsRes.status).toBe(200);
    });

    // RBAC note: accessCheck is now wired to every resource's routes (see
    // docs/backend-verification-todo.md, 2026-09-10 row) — cashier-vs-admin access differentiation
    // is testable end-to-end now, but adding those cases here is a scope expansion beyond this
    // file's original "Auth" cases, flagged separately rather than added unasked.
});
