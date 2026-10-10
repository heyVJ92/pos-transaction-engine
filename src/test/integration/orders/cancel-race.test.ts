
import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";
import { authHeader } from "../../helpers/auth.js";
import { UserRole } from "../../../db/models/user.model.js";

import request, { type Response } from "supertest";
import app from "../../../app.js";
import { pool } from "../../../config/database.js";
import {
    resetDb,
    seedBaseFixtures,
    createDraftOrder,
    getInventory,
    closeDb,
} from "../../helpers/db.js";

/**
 * Polls until some backend is waiting on a lock held by `holderPid`.
 * Used instead of a fixed sleep: against a remote DB the add-item request can
 * take longer than ~200ms to reach its FOR UPDATE, and if cancel ran first the
 * test would pass without ever exercising the race.
 */
const waitUntilBlockedBy = async (holderPid: number, timeoutMs = 5_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const { rows } = await pool.query<{ count: number }>(
            `SELECT count(*)::int AS count
             FROM pg_stat_activity
             WHERE $1 = ANY(pg_blocking_pids(pid))`,
            [holderPid]
        );
        if (rows[0]!.count > 0) return;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("add-item never blocked on the inventory row lock");
};

describe("Concurrency: cancel races an in-flight add-item", () => {
    beforeEach(async () => {
        await resetDb();
    });

    afterAll(async () => {
        await closeDb();
    });

    it("add-item blocked on the inventory lock does not reserve stock into a cancelled order", async () => {

        const { sessionId, userId, productId, productUuid } = await seedBaseFixtures(1);
        const auth = authHeader(UserRole.CASHIER, userId);
        const orderUuid = await createDraftOrder(sessionId, userId);

        // 1. hold the "shelf key": lock the inventory row from our own connection
        const lockClient = await pool.connect();
        let addItemPromise: Promise<Response> | undefined;
        try {
            await lockClient.query("BEGIN");
            await lockClient.query(
                `SELECT available_stock FROM inventory WHERE product_id = $1 FOR UPDATE`,
                [productId]
            );
            const { rows } = await lockClient.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`);
            const lockPid = rows[0]!.pid;

            // 2. start add-item without awaiting — .then() is what actually sends a supertest request
            addItemPromise = request(app)
                .post(`/orders/${orderUuid}/items`)
                .set("Authorization", auth)
                .send({ productUuid, quantity: 1 })
                .then(res => res);

            await waitUntilBlockedBy(lockPid);

            // 3. cancel while add-item is parked on the lock
            const cancelResponse = await request(app)
                .patch(`/orders/${orderUuid}/cancel`)
                .set("Authorization", auth);

            expect(cancelResponse.status).toBe(200);
        } finally {
            // 4. release the shelf key
            await lockClient.query("ROLLBACK");
            lockClient.release();
        }

        if (!addItemPromise) throw new Error("add-item request was never started");
        const addItemResponse = await addItemPromise;

        // 409 alone isn't enough: PRODUCT_NOT_FOUND and INSUFFICIENT_STOCK are also 409
        expect(addItemResponse.status).toBe(409);
        expect(addItemResponse.body.error.code).toBe("ORDER_NOT_IN_DRAFT");

        const { rows: orderRows } = await pool.query<{ status: string; item_count: number }>(
            `SELECT o.status,
                    (SELECT count(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
             FROM orders o
             WHERE o.uuid = $1`,
            [orderUuid]
        );
        expect(orderRows[0]!.status).toBe("cancelled");
        expect(orderRows[0]!.item_count).toBe(0);

        const finalInventory = await getInventory(productId);
        expect(finalInventory.availableStock).toBe(1);
        expect(finalInventory.reservedStock).toBe(0);
    }, 15_000);
});
