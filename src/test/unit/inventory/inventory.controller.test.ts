// ===== IMPORTS =====
// import describe/it/expect/jest/beforeAll/beforeEach from "@jest/globals"
import { describe, it, jest, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest"
import type {Express} from "express";
// import type-only the real service function(s) we're about to mock — types only, no side effects
import type { getAllInventoris, getAllInventoryMovement, restockInventory } from "../../../api/inventory/inventory.service.js"
import { ProductCategory, ProductStatus } from "../../../db/models/product.model.js";
import { MovementType, type IInventoryMovement } from "../../../db/models/inventory_movement.model.js";
import type { IInventory } from "../../../db/models/inventory.model.js";

// ===== DECLARE (not import) what needs mocking =====
// declare `app` (Express) — assigned later, not imported at top
// declare a mock variable per service function we'll control
let app: Express;
let listInventoriesMock: jest.Mock<typeof getAllInventoris>;
let restockInventoryMock: jest.Mock<typeof restockInventory>;
let movementsListMock: jest.Mock<typeof getAllInventoryMovement>;

const mockInventory = (overrides: Partial<IInventory> = {}): IInventory => ({
    id: 1,
    uuid: "f552f8d1-15fb-4f2a-91d2-f72331d5d8d3",
    productId: 1,
    product: {
        uuid: "b1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3",
        name: "Product 1",
        sku: "SKU01",
        category: ProductCategory.SNACKS,
        costPrice: 10,
        sellPrice: 20,
        tax: 0,
        weight: 1,
        status: ProductStatus.ACTIVE,
    },
    availableStock: 100,
    reservedStock: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
})

const mockMovement = (overrides: Partial<IInventoryMovement> = {}): IInventoryMovement => ({
    id: 1,
    uuid: "c1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3",
    productId: 1,
    productUuid: "b1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3",
    orderId: null,
    orderUuid: null,
    orderNumber: null,
    quantity: 10,
    movementType: MovementType.RESTOCK,
    stockBefore: 90,
    stockAfter: 100,
    unitCost: 5,
    createdAt: new Date(),
    ...overrides,
})

// ===== beforeAll =====
beforeAll(async () => {
    // 1. jest.unstable_mockModule() on the real service's path
    //    - stub EVERY named export of that module, not just the ones this file tests
    jest.unstable_mockModule("../../../api/inventory/inventory.service.js", () => ({
        getAllInventoris: jest.fn(),
        restockInventory: jest.fn(),
        getAllInventoryMovement: jest.fn(),
    }))

    // 2. dynamically `await import()` that same service path -> grab the mocked fns, cast as jest.Mock
    const service = await import("../../../api/inventory/inventory.service.js");
    listInventoriesMock = service.getAllInventoris as jest.Mock<typeof getAllInventoris>;
    restockInventoryMock = service.restockInventory as jest.Mock<typeof restockInventory>;
    movementsListMock = service.getAllInventoryMovement as jest.Mock<typeof getAllInventoryMovement>;
    // 3. dynamically `await import()` the app -> assign to `app`
    //    (this pulls in the mocked service transitively, since step 1 ran first)
    app = (await import("../../../app.js")).default;
})

// ===== describe(controller name) =====
describe("inventory.controller", () => {

    //   beforeEach -> jest.clearAllMocks()   // reset call history before every single test
    beforeEach(() => {
        jest.resetAllMocks()
    })

    describe("GET /inventory", () => {
        // query validation test
        it("return 400 for invalid query params", async () => {
            const res = await request(app).get("/inventory").query({ category: "not_a_category" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(listInventoriesMock).not.toHaveBeenCalled();
        })
        // success response test
        it("return 200 with paginated list of inventory, stripped of internal id and productId", async () => {
            const inventories = [mockInventory(), mockInventory({ id: 2, uuid: "a1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3", productId: 2 })];
            listInventoriesMock.mockResolvedValue({
                data: inventories,
                total: 2,
                page: 1,
                limit: 10,
                totalPages: 1,
            });

            const res = await request(app).get("/inventory");
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
            // internal integer id/productId must never leak to the response — only uuid is public
            for (const item of res.body.data) {
                expect(item).not.toHaveProperty("id");
                expect(item).not.toHaveProperty("productId");
            }
            expect(res.body.data[0].uuid).toBe(inventories[0]!.uuid);
        })
    })

    describe("PUT /inventory/:product_uuid/restock", () => {
        // invalid uuid test
        it("return 400 for invalid uuid", async () => {
            const res = await request(app).put("/inventory/INVALID_UUID/restock").send({ quantity: 5, unitCost: 10 });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(restockInventoryMock).not.toHaveBeenCalled();
        })
        // request body validation test
        it("return 400, rejects invalid body data", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            const res = await request(app).put(`/inventory/${uuid}/restock`).send({ quantity: 0, unitCost: 10 }); // quantity below min(1)
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(restockInventoryMock).not.toHaveBeenCalled();
        })
        // resource not found
        it("return 404, product not found", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            restockInventoryMock.mockResolvedValue("NOT_FOUND");
            const res = await request(app).put(`/inventory/${uuid}/restock`).send({ quantity: 5, unitCost: 10 });
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
        })
        // success response test
        it("return 200 on successful restock", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            restockInventoryMock.mockResolvedValue("SUCCESS");
            const res = await request(app).put(`/inventory/${uuid}/restock`).send({ quantity: 5, unitCost: 10 });
            expect(res.status).toBe(200);
            expect(restockInventoryMock).toHaveBeenCalledWith(uuid, { quantity: 5, unitCost: 10 });
        })
    })

    describe("GET /inventory/:product_uuid/movements", () => {
        // invalid uuid test
        it("return 400 for invalid uuid", async () => {
            const res = await request(app).get("/inventory/INVALID_UUID/movements");
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(movementsListMock).not.toHaveBeenCalled();
        })
        // query validation test
        it("return 400 for invalid query params", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            const res = await request(app).get(`/inventory/${uuid}/movements`).query({ movementType: "not_a_type" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(movementsListMock).not.toHaveBeenCalled();
        })
        // resource not found
        it("return 404, product not found", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            movementsListMock.mockResolvedValue("NOT_FOUND");
            const res = await request(app).get(`/inventory/${uuid}/movements`);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
        })
        // success response test
        it("return 200 with paginated list of movements, stripped of internal id/productId/orderId", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            const movements = [mockMovement(), mockMovement({ id: 2, uuid: "d1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3" })];
            movementsListMock.mockResolvedValue({
                data: movements,
                total: 2,
                page: 1,
                limit: 10,
                totalPages: 1,
            });

            const res = await request(app).get(`/inventory/${uuid}/movements`);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
            for (const item of res.body.data) {
                expect(item).not.toHaveProperty("id");
                expect(item).not.toHaveProperty("productId");
                expect(item).not.toHaveProperty("orderId");
            }
            expect(res.body.data[0].uuid).toBe(movements[0]!.uuid);
            expect(movementsListMock).toHaveBeenCalledWith(uuid, expect.objectContaining({ page: 1, limit: 10 }));
        })
    })

})
