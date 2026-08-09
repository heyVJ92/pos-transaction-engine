// ===== IMPORTS =====
// import describe/it/expect/jest/beforeAll/beforeEach from "@jest/globals"
import { describe, it, jest, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest"
import type {Express} from "express";
// import type-only the real service function(s) we're about to mock — types only, no side effects
import type  { listCounters, addCounter, removeCounter, getCounterDetails, updateCounterByUUID} from "../../../api/counters/counter.service.js"
import { CounterStatus, type ICounter } from "../../../db/models/counter.model.js";

// ===== DECLARE (not import) what needs mocking =====
// declare `app` (Express) — assigned later, not imported at top
// declare a mock variable per service function we'll control
let app: Express;
let listCountersMock: jest.Mock<typeof listCounters>;
let detailCounterMock: jest.Mock<typeof getCounterDetails>;
let updateCounterByUUIDMock: jest.Mock<typeof updateCounterByUUID>
const mockCounter = (overrides: Partial<ICounter> = {}): ICounter => ({
    id: 1,
    uuid: "f552f8d1-15fb-4f2a-91d2-f72331d5d8d3",
    name: "Counter 1",
    code: "C01",
    status: CounterStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
})

// ===== beforeAll =====
beforeAll(async () => {
    // 1. jest.unstable_mockModule() on the real service's path
    //    - stub EVERY named export of that module, not just the ones this file tests
    jest.unstable_mockModule("../../../api/counters/counter.service.js", () => ({
        listCounters: jest.fn(),
        addCounter: jest.fn(),
        getCounterDetails: jest.fn(),
        removeCounter: jest.fn(),
        updateCounterByUUID: jest.fn()
    }))

    // 2. dynamically `await import()` that same service path -> grab the mocked fns, cast as jest.Mock
    const service = await import("../../../api/counters/counter.service.js");
    listCountersMock = service.listCounters as jest.Mock<typeof listCounters>;
    detailCounterMock = service.getCounterDetails as jest.Mock<typeof getCounterDetails>
    updateCounterByUUIDMock = service.updateCounterByUUID as jest.Mock<typeof updateCounterByUUID>
    // 3. dynamically `await import()` the app -> assign to `app`
    //    (this pulls in the mocked service transitively, since step 1 ran first)
    app = (await import("../../../app.js")).default;
})

// ===== describe(controller name) =====
describe("counter.controller", () => {

    //   beforeEach -> jest.clearAllMocks()   // reset call history before every single test
    beforeEach(() => {
        jest.resetAllMocks()
    })
    //   describe(route 1: method + path)
    describe("GET /counters", () => {
        // test cases
            // query validation test
            // success response test
    })
    describe("POST /counters", () => {
        // test cases
            // body validation test
            // success response test
            // Duplicate code test
    })

    describe("GET /counters/:uuid", () => {
        // test cases
            // invalid uuid test
            it("retrun 400 for invalid uuid", async() => {
                const res = await request(app).get(`/counters/INVALID_UUID`);
                expect(res.status).toBe(400);
                expect(res.body.error.code).toBe("VALIDATION_ERROR");
                expect(detailCounterMock).not.toHaveBeenCalled();
            })
            // resource not found
            it("return 404, No resource found with this uuid", async() => {
                detailCounterMock.mockResolvedValue(null)
                const res = await request(app).get(`/counters/e824dcce-d570-4c07-941b-428a19a2d88a`)
                expect(res.status).toBe(404);
                expect(res.body.error.code).toBe("NOT_FOUND");
            })
            // success response test
            it("return 200 with details of counter", async() => {
                const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3'
                detailCounterMock.mockResolvedValue(mockCounter({ uuid }))

                const res = await request(app).get(`/counters/${uuid}`)
                expect(res.status).toBe(200);
                expect(detailCounterMock).toHaveBeenCalledWith(uuid);
                expect(res.body.data.uuid).toBe(uuid);  // worth asserting the response actually carries the mocked data through
            })
    })

    describe("DELETE /counters/:uuid", () => {
        // test cases
            // invalid uuid test
            // resource not found
            // counter already inactive test
            // success response test
    })

    describe("PATCH /counters/:uuid", () => {
        // test cases
            // invalid uuid test
            it("return 400 for invalid uuid", async() => {
                const res = await request(app).patch("/counters/INVALID_UUID");
                expect(res.status).toBe(400);
                expect(res.body.error.code).toBe("VALIDATION_ERROR");
                expect(updateCounterByUUIDMock).not.toHaveBeenCalled();
            })
            // request body validation test
            it("return 400, rejcted any invalid body data", async() => {
                const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
                const res = await request(app).patch(`/counters/${uuid}`).send({
                    status: "running"
                });
                expect(res.status).toBe(400);
                expect(res.body.error.code).toBe("VALIDATION_ERROR");
                expect(updateCounterByUUIDMock).not.toHaveBeenCalled();
            })

            // ---- code conflict test ----
            it("return 409 for conflict code", async () => {
                const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
                updateCounterByUUIDMock.mockResolvedValue("code_conflict");
            
                const res = await request(app).patch(`/counters/${uuid}`).send({
                    code: "C01",   // any body that PASSES validation — the point of this
                                    // test is what happens AFTER validation, so the body
                                    // itself must be valid, only the SERVICE's response
                                    // is what's simulating the conflict
                });
            
                expect(res.status).toBe(409);
                expect(res.body.error.code).toBe("CODE_ALREADY_EXISTS");
                expect(updateCounterByUUIDMock).toHaveBeenCalledWith(uuid, { code: "C01" });
            });
            // resource not found
            it("return 404, counter not found", async () => {
                const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
                updateCounterByUUIDMock.mockResolvedValue("not_found");
                const res = await request(app).patch(`/counters/${uuid}`).send({ status: "inactive" });
                expect(res.status).toBe(404);
                expect(res.body.error.code).toBe("NOT_FOUND");
            });
            // counter already inactive test
            it("return 409 for already inactive counter", async () => {
                const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
                updateCounterByUUIDMock.mockResolvedValue("already_inactive");
            
                const res = await request(app).patch(`/counters/${uuid}`).send({
                    status: "inactive",   // any body that PASSES validation — the point of this
                                    // test is what happens AFTER validation, so the body
                                    // itself must be valid, only the SERVICE's response
                                    // is what's simulating the conflict
                });
            
                expect(res.status).toBe(409);
                expect(res.body.error.code).toBe("ALREADY_INACTIVE");
                expect(updateCounterByUUIDMock).toHaveBeenCalledWith(uuid, { status: CounterStatus.INACTIVE });
            });
            // success response test            
            it("return 200 successful update", async () => {
                const uuid = 'f552f8d1-15fb-4f2a-91d2-f72331d5d8d3';
                updateCounterByUUIDMock.mockResolvedValue("success");
            
                const res = await request(app).patch(`/counters/${uuid}`).send({
                    status: "inactive",   // any body that PASSES validation — the point of this
                                    // test is what happens AFTER validation, so the body
                                    // itself must be valid, only the SERVICE's response
                                    // is what's simulating the conflict
                });
            
                expect(res.status).toBe(200);
                expect(updateCounterByUUIDMock).toHaveBeenCalledWith(uuid, { status: CounterStatus.INACTIVE });
            });
    })

})