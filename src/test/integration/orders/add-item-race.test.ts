
import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";

import request from "supertest";
import app from "../../../app.js";
import {
    resetDb,
    seedBaseFixtures,
    createDraftOrder,
    getInventory,
    closeDb,
} from "../../helpers/db.js";

describe("Concurrency: two cashiers racing the last unit of stock", () => {
    beforeEach(async () => {
        await resetDb();
    });

    afterAll(async () => {
        await closeDb();
    });

    it("one succeeds, one is rejected, stock never goes negative", async () => {

        const { sessionId, userId, productId, productUuid } = await seedBaseFixtures(1);

        const orderAUuid = await createDraftOrder(sessionId, userId);
        const orderBUuid = await createDraftOrder(sessionId, userId);
         const [responseA, responseB] = await Promise.all([
            request(app)
                .post(`/orders/${orderAUuid}/items`)
                .send({ productUuid, quantity: 1 }),
            request(app)
                .post(`/orders/${orderBUuid}/items`)
                .send({ productUuid, quantity: 1 }),
        ]);

        const responses = [responseA, responseB];
        const successes = responses.filter(r => r.status === 200 || r.status === 201);
        const rejections = responses.filter(r => r.status === 409);

        expect(successes).toHaveLength(1);
        expect(rejections).toHaveLength(1);
        const finalInventory = await getInventory(productId);
        
        expect(finalInventory.availableStock).toBe(0);
        expect(finalInventory.reservedStock).toBe(1);
    }, 10_000);
});
