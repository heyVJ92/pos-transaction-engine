import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";

import { closeDb, createDraftOrder, getPaymentVerificationState, resetDb, seedBaseFixtures } from "../../helpers/db.js";
import request from "supertest";
import app from "../../../app.js";
import { OrderStatus } from "../../../db/models/order.model.js";
import { IDEMPOTENCY_STATUS } from "../../../db/models/idempotency.model.js";

describe("Idempotency: Payment API gets duplicate request", () => {
    beforeEach(async () => {
        await resetDb();
    })

    afterAll(async ()=> {
        await closeDb()
    })

    it("fresh Idempotency-Key executes payment", async () => {
            const idempotency_key = "payment-test-key-001";
            const {sessionId, userId, productId, productUuid} = await seedBaseFixtures(10);

            const orderUuid = await createDraftOrder(sessionId, userId);
            const addItemResponse = await request(app).post(`/orders/${orderUuid}/items`).send({
                productUuid, quantity: 2
            });
            expect(addItemResponse.status).toBe(200);
            // const checkout = await checkoutOrder(orderUuid);
            const checkoutResponse = await request(app).patch(`/orders/${orderUuid}/checkout`);
            expect(checkoutResponse.status).toBe(200);
            const paymentResponse = await request(app).patch(`/orders/${orderUuid}/payment`).set("Idempotency-Key", idempotency_key).send({
                mode: "cash", amountTendered: 40
            });
            expect(paymentResponse.status).toBe(200);
            expect(paymentResponse.body.success).toBe(true);

            const state = await getPaymentVerificationState(orderUuid, idempotency_key);
            expect(state.orderStatus).toBe(OrderStatus.COMPLETED);
            expect(state.idempotencyHttpStatus).toBe(200);
            expect(state.idempotencyStatus).toBe(IDEMPOTENCY_STATUS.SUCCESS);

        }, 30_000)


// to-do
// once payment flow add create test for same Key + same payment payload 
// show replay the success response instead of creating a duplicate payment
// so check payment count = 1

    it("Duplicate request get idempotency conflict, 409", async () => {
            const idempotency_key = "payment-test-key-001";
            const {sessionId, userId, productId, productUuid} = await seedBaseFixtures(10);

            const orderUuid = await createDraftOrder(sessionId, userId);
            const addItemResponse = await request(app).post(`/orders/${orderUuid}/items`).send({
                productUuid, quantity: 2
            });
            expect(addItemResponse.status).toBe(200);
            // const checkout = await checkoutOrder(orderUuid);
            const checkoutResponse = await request(app).patch(`/orders/${orderUuid}/checkout`);
            expect(checkoutResponse.status).toBe(200);
            const paymentResponse = await request(app).patch(`/orders/${orderUuid}/payment`).set("Idempotency-Key", idempotency_key).send({
                mode: "cash", amountTendered: 40
            });
            expect(paymentResponse.status).toBe(200);
            expect(paymentResponse.body.success).toBe(true);

            const state = await getPaymentVerificationState(orderUuid, idempotency_key);
            expect(state.orderStatus).toBe(OrderStatus.COMPLETED);
            expect(state.idempotencyHttpStatus).toBe(200);
            expect(state.idempotencyStatus).toBe(IDEMPOTENCY_STATUS.SUCCESS);

            const conflictResponse = await request(app)
                .patch(`/orders/${orderUuid}/payment`)
                .set("Idempotency-Key", idempotency_key)
                .send({
                    mode: "cash",
                    amountTendered: 50
                });

            expect(conflictResponse.status).toBe(409);
            expect(conflictResponse.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
        }, 30_000);


    it("replays stored failure for duplicate request", async () => {
        const idempotencyKey = "payment-failure-key-001";
    
        const { sessionId, userId, productUuid } =
            await seedBaseFixtures(10);
    
        const orderUuid = await createDraftOrder(sessionId, userId);
    
        await request(app)
            .post(`/orders/${orderUuid}/items`)
            .send({ productUuid, quantity: 2 });
    
        await request(app)
            .patch(`/orders/${orderUuid}/checkout`);
    
        const firstResponse = await request(app)
            .patch(`/orders/${orderUuid}/payment`)
            .set("Idempotency-Key", idempotencyKey)
            .send({
                mode: "cash",
                amountTendered: 0
            });
    
        expect(firstResponse.status).toBe(409);
        expect(firstResponse.body.error.code)
            .toBe("INSUFFICIENT_TENDER");
    
        const state = await getPaymentVerificationState(
            orderUuid,
            idempotencyKey
        );
    
        expect(state.idempotencyStatus)
            .toBe(IDEMPOTENCY_STATUS.FAILED);
    
        expect(state.idempotencyHttpStatus).toBe(409);
    
        const replayResponse = await request(app)
            .patch(`/orders/${orderUuid}/payment`)
            .set("Idempotency-Key", idempotencyKey)
            .send({
                mode: "cash",
                amountTendered: 0
            });
    
        expect(replayResponse.status).toBe(409);
        expect(replayResponse.body).toEqual(firstResponse.body);
    });

    it("rejects payment request without Idempotency-Key", async () => {
        const { sessionId, userId, productUuid } =
            await seedBaseFixtures(10);
    
        const orderUuid = await createDraftOrder(sessionId, userId);
    
        await request(app)
            .post(`/orders/${orderUuid}/items`)
            .send({ productUuid, quantity: 2 });
    
        await request(app)
            .patch(`/orders/${orderUuid}/checkout`);
    
        const response = await request(app)
            .patch(`/orders/${orderUuid}/payment`)
            .send({
                mode: "cash",
                amountTendered: 40
            });
    
        expect(response.status).toBe(400);
        expect(response.body.error.code)
            .toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

// to-do Concurrency test for 2 duplicate idempotency requests
// confirm with payment flow 
// it should return 200 for both request, but payment count should equals to 1

})