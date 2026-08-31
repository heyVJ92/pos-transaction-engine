import { describe, it, expect, jest, beforeAll } from "@jest/globals";
import type { Express } from "express";
import type { checkoutOrder, processOrderPayment } from "../../../api/orders/order.service.js";
import { OrderStatus } from "../../../db/models/order.model.js";

// Declare the two things we need, but DON'T import them yet — we need the
// mock set up first, before anything grabs the real function.
let app: Express;
let checkoutOrderMock: jest.Mock<typeof checkoutOrder>;
let processOrderPaymentMock: jest.Mock<typeof processOrderPayment>

beforeAll(async () => {
  // ESM-native mocking: replace this module's exports before it's ever
  // actually loaded by anything else (including app.ts, transitively).
  jest.unstable_mockModule("../../../api/orders/order.service.js", () => ({
    createDraftOrder: jest.fn(),
    getOrderList: jest.fn(),
    addOrderItem: jest.fn(),
    editOrderItem: jest.fn(),
    removeOrderItem: jest.fn(),
    getOrderDetails: jest.fn(),
    holdOrder: jest.fn(),
    checkoutOrder: jest.fn(),
    revertOrderToDraft: jest.fn(),
    cancelOrder: jest.fn(),
    processOrderPayment: jest.fn(),
  }));

  // NOW import — dynamically, with await — so both grab the mocked version.
  const orderService = await import("../../../api/orders/order.service.js");
  checkoutOrderMock = orderService.checkoutOrder as jest.Mock<typeof checkoutOrder>;
  processOrderPaymentMock = orderService.processOrderPayment as jest.Mock<typeof processOrderPayment>;

  app = (await import("../../../app.js")).default;
});
describe("order.controller", () => {
  describe("PATCH /orders/:uuid/checkout", () => {
    const validUuid = "71c5cc2e-0b6d-40ed-89fb-3b064dcc9ddc";

    // supertest needs to be imported dynamically too, purely so it resolves
    // after the mock setup above — keeps the ordering simple and consistent
    const request = async () => (await import("supertest")).default;

    it("returns 400 for a malformed uuid (validation layer, no service call)", async () => {
      const supertest = await request();
      const res = await supertest(app).patch("/orders/not-a-uuid/checkout");
      console.log(res.status, "status------45");
      expect(res.status).toBe(400);
      expect(checkoutOrderMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the order does not exist", async () => {
      checkoutOrderMock.mockResolvedValue("not_found");
      const supertest = await request();

      const res = await supertest(app).patch(`/orders/${validUuid}/checkout`);
      console.log(res.status, "status------55", res.body.error);
      
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("ORDER_NOT_FOUND");
    });

    it("returns 409 when the order is not in draft status", async () => {
      checkoutOrderMock.mockResolvedValue("not_draft");
      const supertest = await request();

      const res = await supertest(app).patch(`/orders/${validUuid}/checkout`);
      console.log(res.status, "status------66", res.body.error);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ORDER_NOT_IN_DRAFT");
    });

    it("returns 409 when the order has no items", async () => {
      checkoutOrderMock.mockResolvedValue("empty_order");
      const supertest = await request();

      const res = await supertest(app).patch(`/orders/${validUuid}/checkout`);
      console.log(res.status, "status------77", res.body.error);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ORDER_EMPTY");
    });

    it("returns 200 on successful checkout", async () => {
      checkoutOrderMock.mockResolvedValue({
        uuid: validUuid,
        status: OrderStatus.INPROCESS,
      });
      const supertest = await request();

      const res = await supertest(app).patch(`/orders/${validUuid}/checkout`);
      console.log(res.status, "status------91");

      expect(res.status).toBe(200);
      expect(checkoutOrderMock).toHaveBeenCalledWith(validUuid);
    });
  });

  describe("PATCH /orders/:uuid/payment", () => {
    const validUuid = "71c5cc2e-0b6d-40ed-89fb-3b064dcc9ddc";
    const request = async () => (await import("supertest")).default;

    it("returns 400 for a malformed uuid (validation layer, no service call)", async () => {
      const supertest = await request();
      const res = await supertest(app).patch("/orders/not-a-uuid/payment");
      console.log(res.status, "status------45");
      expect(res.status).toBe(400);
      expect(processOrderPaymentMock).not.toHaveBeenCalled();
    });
  });
});