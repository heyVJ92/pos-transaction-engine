// ===== IMPORTS =====
// import describe/it/expect/jest/beforeAll/beforeEach from "@jest/globals"
import { describe, it, jest, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest"
import type {Express} from "express";
// import type-only the real service function(s) we're about to mock — types only, no side effects
import type { listProducts, addProduct, getProductDetails, changeStatusOfProduct, updateProductByUUID } from "../../../api/products/product.service.js"
import { ProductCategory, ProductStatus, type IProductDetail } from "../../../db/models/product.model.js";

// ===== DECLARE (not import) what needs mocking =====
// declare `app` (Express) — assigned later, not imported at top
// declare a mock variable per service function we'll control
let app: Express;
let listProductsMock: jest.Mock<typeof listProducts>;
let addProductMock: jest.Mock<typeof addProduct>;
let detailProductMock: jest.Mock<typeof getProductDetails>;
let changeStatusOfProductMock: jest.Mock<typeof changeStatusOfProduct>;
let updateProductByUUIDMock: jest.Mock<typeof updateProductByUUID>

const mockProduct = (overrides: Partial<IProductDetail> = {}): IProductDetail => ({
    id: 1,
    uuid: "f552f8d1-15fb-4f2a-91d2-f72331d5d8d3",
    name: "Product 1",
    sku: "SKU01",
    category: ProductCategory.SNACKS,
    costPrice: 10,
    sellPrice: 20,
    availableStock: 100,
    reservedStock: 0,
    minQty: 5,
    maxQty: 50,
    tax: 0,
    weight: 1,
    status: ProductStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
})

// ===== beforeAll =====
beforeAll(async () => {
    // 1. jest.unstable_mockModule() on the real service's path
    //    - stub EVERY named export of that module, not just the ones this file tests
    jest.unstable_mockModule("../../../api/products/product.service.js", () => ({
        listProducts: jest.fn(),
        addProduct: jest.fn(),
        getProductDetails: jest.fn(),
        changeStatusOfProduct: jest.fn(),
        updateProductByUUID: jest.fn()
    }))

    // 2. dynamically `await import()` that same service path -> grab the mocked fns, cast as jest.Mock
    const service = await import("../../../api/products/product.service.js");
    listProductsMock = service.listProducts as jest.Mock<typeof listProducts>;
    addProductMock = service.addProduct as jest.Mock<typeof addProduct>;
    detailProductMock = service.getProductDetails as jest.Mock<typeof getProductDetails>
    changeStatusOfProductMock = service.changeStatusOfProduct as jest.Mock<typeof changeStatusOfProduct>;
    updateProductByUUIDMock = service.updateProductByUUID as jest.Mock<typeof updateProductByUUID>
    // 3. dynamically `await import()` the app -> assign to `app`
    //    (this pulls in the mocked service transitively, since step 1 ran first)
    app = (await import("../../../app.js")).default;
})

// ===== describe(controller name) =====
describe("product.controller", () => {

    //   beforeEach -> jest.clearAllMocks()   // reset call history before every single test
    beforeEach(() => {
        jest.resetAllMocks()
    })

    describe("GET /products", () => {
        // query validation test
        it("return 400 for invalid query params", async () => {
            const res = await request(app).get("/products").query({ category: "not_a_category" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(listProductsMock).not.toHaveBeenCalled();
        })
        // success response test
        it("return 200 with paginated list of products, stripped of internal id", async () => {
            const products = [mockProduct(), mockProduct({ id: 2, uuid: "a1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3", sku: "SKU02" })];
            listProductsMock.mockResolvedValue({
                data: products,
                total: 2,
                page: 1,
                limit: 10,
                totalPages: 1,
            });

            const res = await request(app).get("/products");
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
            // internal integer id must never leak to the response — only uuid is public
            for (const item of res.body.data) {
                expect(item).not.toHaveProperty("id");
            }
            expect(res.body.data[0].uuid).toBe(products[0]!.uuid);
        })
    })

    describe("POST /products", () => {
        // body validation test
        it("return 400, rejects invalid body data", async () => {
            const res = await request(app).post("/products").send({ name: "Product 1" }); // missing required `sku` and `category`
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(addProductMock).not.toHaveBeenCalled();
        })
        // success response test
        it("return 201 on successful creation", async () => {
            addProductMock.mockResolvedValue(true);
            const body = { name: "Product 1", sku: "SKU01", category: ProductCategory.SNACKS };
            const res = await request(app).post("/products").send(body);
            expect(res.status).toBe(201);
            expect(addProductMock).toHaveBeenCalled();
        })
        // Duplicate sku test
        it("return 409 for duplicate product sku", async () => {
            addProductMock.mockResolvedValue(false);
            const body = { name: "Product 1", sku: "SKU01", category: ProductCategory.SNACKS };
            const res = await request(app).post("/products").send(body);
            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("SKU_ALREADY_EXISTS");
        })
    })

    describe("GET /products/:uuid", () => {
        // invalid uuid test
        it("return 400 for invalid uuid", async () => {
            const res = await request(app).get(`/products/INVALID_UUID`);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(detailProductMock).not.toHaveBeenCalled();
        })
        // resource not found
        it("return 404, No resource found with this uuid", async () => {
            detailProductMock.mockResolvedValue(null)
            const res = await request(app).get(`/products/e824dcce-d570-4c07-941b-428a19a2d88a`)
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("NOT_FOUND");
        })
        // success response test
        it("return 200 with details of product", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3'
            detailProductMock.mockResolvedValue(mockProduct({ uuid }))

            const res = await request(app).get(`/products/${uuid}`)
            expect(res.status).toBe(200);
            expect(detailProductMock).toHaveBeenCalledWith(uuid);
            expect(res.body.data.uuid).toBe(uuid);
            // internal integer id must never leak to the response — only uuid is public
            expect(res.body.data).not.toHaveProperty("id");
        })
    })

    describe("PUT /products/:uuid/status", () => {
        // invalid uuid test
        it("return 400 for invalid uuid", async () => {
            const res = await request(app).put("/products/INVALID_UUID/status");
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(changeStatusOfProductMock).not.toHaveBeenCalled();
        })
        // resource not found
        it("return 404, product not found", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            changeStatusOfProductMock.mockResolvedValue("not_found");
            const res = await request(app).put(`/products/${uuid}/status`);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("NOT_FOUND");
        })
        // deactivate branch
        it("return 200 and deactivates an active product", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            changeStatusOfProductMock.mockResolvedValue("deactivated");
            const res = await request(app).put(`/products/${uuid}/status`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Product Deactivated Successfully.");
            expect(changeStatusOfProductMock).toHaveBeenCalledWith(uuid);
        })
        // activate branch
        it("return 200 and activates an inactive product", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            changeStatusOfProductMock.mockResolvedValue("activated");
            const res = await request(app).put(`/products/${uuid}/status`);
            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Product Activated Successfully.");
            expect(changeStatusOfProductMock).toHaveBeenCalledWith(uuid);
        })
    })

    describe("PUT /products/:uuid", () => {
        // invalid uuid test
        it("return 400 for invalid uuid", async () => {
            const res = await request(app).put("/products/INVALID_UUID");
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(updateProductByUUIDMock).not.toHaveBeenCalled();
        })
        // request body validation test
        it("return 400, rejected any invalid body data", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            const res = await request(app).put(`/products/${uuid}`).send({
                costPrice: "not_a_number"
            });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(updateProductByUUIDMock).not.toHaveBeenCalled();
        })
        // sku conflict test
        it("return 409 for conflicting sku", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            updateProductByUUIDMock.mockResolvedValue("sku_conflict");

            const res = await request(app).put(`/products/${uuid}`).send({ sku: "SKU01" });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("SKU_ALREADY_EXISTS");
            expect(updateProductByUUIDMock).toHaveBeenCalledWith(uuid, { sku: "SKU01" });
        })
        // resource not found
        it("return 404, product not found", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            updateProductByUUIDMock.mockResolvedValue("not_found");
            const res = await request(app).put(`/products/${uuid}`).send({ name: "Renamed" });
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("NOT_FOUND");
        })
        // counter already inactive test
        it("return 409 for already inactive product", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            updateProductByUUIDMock.mockResolvedValue("already_inactive");

            const res = await request(app).put(`/products/${uuid}`).send({ name: "Renamed" });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("ALREADY_INACTIVE");
            expect(updateProductByUUIDMock).toHaveBeenCalledWith(uuid, { name: "Renamed" });
        })
        // success response test
        it("return 200 successful update", async () => {
            const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
            updateProductByUUIDMock.mockResolvedValue("success");

            const res = await request(app).put(`/products/${uuid}`).send({ name: "Renamed" });

            expect(res.status).toBe(200);
            expect(updateProductByUUIDMock).toHaveBeenCalledWith(uuid, { name: "Renamed" });
        })
    })

})
