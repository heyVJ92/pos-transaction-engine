// RBAC integration coverage — accessCheck wired into real routes (see
// docs/backend-verification-todo.md and docs/decisions.md, both dated 2026-09-10).
// Seeds one admin and one cashier user directly via pool.query (no login round-trip needed —
// signAccessToken issues the same shape of token a real login would) and drives real routes
// through supertest, asserting on the resulting HTTP status per the deferred RBAC test list:
//   - admin-only route called by cashier -> 403 FORBIDDEN
//   - admin-only route called by admin -> 200/201
//   - both-roles route called by cashier -> 200
//   - both-roles route called by admin -> 200
//   - unauthenticated request -> 401 (accessCheck must run after requireAuth, not instead of it)

import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";
import request from "supertest";

import { closeDb, resetDb } from "../../helpers/db.js";
import { pool } from "../../../config/database.js";
import { signAccessToken } from "../../../utils/jwt.js";
import { UserRole } from "../../../db/models/user.model.js";
import app from "../../../app.js";

const seedUser = async (role: UserRole): Promise<{ id: number; token: string }> => {
    // password_hash is NOT NULL but irrelevant here — RBAC is decided entirely from the JWT
    // payload (signAccessToken below), never from a real login/password check.
    const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO users (first_name, last_name, email, role, password_hash)
         VALUES ('Test', $1, $2, $3, 'unused-in-rbac-tests')
         RETURNING id`,
        [role, `rbac-test-${role}@test.local`, role]
    );
    const id = rows[0]!.id;
    return { id, token: signAccessToken({ id, role }) };
};

describe("RBAC integration — accessCheck on real routes", () => {
    beforeEach(async () => {
        await resetDb();
    });

    afterAll(async () => {
        await closeDb();
    });

    it("admin-only route (POST /counters) called by a cashier -> 403 FORBIDDEN", async () => {
        const { token } = await seedUser(UserRole.CASHIER);

        const res = await request(app)
            .post("/counters")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Front Counter", code: "RBAC-1" });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("admin-only route (POST /counters) called by an admin -> 201", async () => {
        const { token } = await seedUser(UserRole.ADMIN);

        const res = await request(app)
            .post("/counters")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Front Counter", code: "RBAC-2" });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it("both-roles route (GET /users) called by a cashier -> 200", async () => {
        const { token } = await seedUser(UserRole.CASHIER);

        const res = await request(app)
            .get("/users")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("both-roles route (GET /users) called by an admin -> 200", async () => {
        const { token } = await seedUser(UserRole.ADMIN);

        const res = await request(app)
            .get("/users")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("a protected route with no token at all -> 401 UNAUTHORIZED, not 403 (requireAuth runs before accessCheck)", async () => {
        const res = await request(app).post("/counters").send({ name: "Front Counter", code: "RBAC-3" });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
});
