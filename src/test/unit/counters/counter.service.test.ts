// ===== IMPORTS =====
import { describe, it, jest, expect, beforeAll, beforeEach } from "@jest/globals";
// import type-only the real repository function(s) we're about to mock — types only, no side effects
import type { findManyCounters, addNewCounter, findSingleCounter, setCounterInactive, updateCounter } from "../../../api/counters/counter.repository.js";
import { CounterStatus, type ICounter } from "../../../db/models/counter.model.js";
import { DatabaseError } from "../../../utils/db-errors.js";

// ===== DECLARE (not import) what needs mocking =====
// declare a mock variable per repository function we'll control, and the service
// functions under test (imported for real, after the repository mock is registered)
let listCounters: typeof import("../../../api/counters/counter.service.js")["listCounters"];
let addCounter: typeof import("../../../api/counters/counter.service.js")["addCounter"];
let getCounterDetails: typeof import("../../../api/counters/counter.service.js")["getCounterDetails"];
let removeCounter: typeof import("../../../api/counters/counter.service.js")["removeCounter"];
let updateCounterByUUID: typeof import("../../../api/counters/counter.service.js")["updateCounterByUUID"];

let findManyCountersMock: jest.Mock<typeof findManyCounters>;
let addNewCounterMock: jest.Mock<typeof addNewCounter>;
let findSingleCounterMock: jest.Mock<typeof findSingleCounter>;
let setCounterInactiveMock: jest.Mock<typeof setCounterInactive>;
let updateCounterMock: jest.Mock<typeof updateCounter>;

const UUID = "f552f8d1-15fb-4f2a-91d2-f72331d5d8d3";

const mockCounter = (overrides: Partial<ICounter> = {}): ICounter => ({
    id: 1,
    uuid: UUID,
    name: "Counter 1",
    code: "C01",
    status: CounterStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

// ===== beforeAll =====
beforeAll(async () => {
    // 1. jest.unstable_mockModule() on the real repository's path
    //    - stub EVERY named export of that module, not just the ones this file tests
    jest.unstable_mockModule("../../../api/counters/counter.repository.js", () => ({
        findManyCounters: jest.fn(),
        addNewCounter: jest.fn(),
        findSingleCounter: jest.fn(),
        setCounterInactive: jest.fn(),
        updateCounter: jest.fn(),
    }));

    // 2. dynamically `await import()` that same repository path -> grab the mocked fns, cast as jest.Mock
    const repository = await import("../../../api/counters/counter.repository.js");
    findManyCountersMock = repository.findManyCounters as jest.Mock<typeof findManyCounters>;
    addNewCounterMock = repository.addNewCounter as jest.Mock<typeof addNewCounter>;
    findSingleCounterMock = repository.findSingleCounter as jest.Mock<typeof findSingleCounter>;
    setCounterInactiveMock = repository.setCounterInactive as jest.Mock<typeof setCounterInactive>;
    updateCounterMock = repository.updateCounter as jest.Mock<typeof updateCounter>;

    // 3. dynamically `await import()` the service -> this pulls in the mocked
    //    repository transitively, since step 1 ran first
    const service = await import("../../../api/counters/counter.service.js");
    listCounters = service.listCounters;
    addCounter = service.addCounter;
    getCounterDetails = service.getCounterDetails;
    removeCounter = service.removeCounter;
    updateCounterByUUID = service.updateCounterByUUID;
});

describe("counter.service", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe("listCounters", () => {
        it("returns repo data paginated with page/limit taken from the input params", async () => {
            const counters = [mockCounter(), mockCounter({ id: 2, uuid: "a1a1a1a1-15fb-4f2a-91d2-f72331d5d8d3", code: "C02" })];
            findManyCountersMock.mockResolvedValue({ data: counters, total: 25 });

            const params = { page: 2, limit: 10 } as Parameters<typeof listCounters>[0];
            const result = await listCounters(params);

            expect(findManyCountersMock).toHaveBeenCalledWith(params);
            expect(result).toEqual({
                data: counters,
                total: 25,
                page: 2,
                limit: 10,
                totalPages: 3, // Math.ceil(25 / 10)
            });
        });

        it("returns totalPages: 0 when there are no matching counters", async () => {
            findManyCountersMock.mockResolvedValue({ data: [], total: 0 });

            const params = { page: 1, limit: 10 } as Parameters<typeof listCounters>[0];
            const result = await listCounters(params);

            expect(result.totalPages).toBe(0);
        });
    });

    describe("addCounter", () => {
        const body = { name: "Counter 1", code: "C01" };

        it("resolves true when the repo creates the counter", async () => {
            addNewCounterMock.mockResolvedValue(true);
            await expect(addCounter(body)).resolves.toBe(true);
            expect(addNewCounterMock).toHaveBeenCalledWith(body);
        });

        it("resolves false when the repo hits a duplicate code (ON CONFLICT DO NOTHING)", async () => {
            addNewCounterMock.mockResolvedValue(false);
            await expect(addCounter(body)).resolves.toBe(false);
        });
    });

    describe("getCounterDetails", () => {
        it("resolves the counter returned by the repo", async () => {
            const counter = mockCounter();
            findSingleCounterMock.mockResolvedValue(counter);

            await expect(getCounterDetails(UUID)).resolves.toEqual(counter);
            expect(findSingleCounterMock).toHaveBeenCalledWith(UUID);
        });

        it("resolves null when the repo finds no counter", async () => {
            findSingleCounterMock.mockResolvedValue(null);
            await expect(getCounterDetails(UUID)).resolves.toBeNull();
        });
    });

    describe("removeCounter", () => {
        it("returns not_found when the counter doesn't exist", async () => {
            findSingleCounterMock.mockResolvedValue(null);

            await expect(removeCounter(UUID)).resolves.toBe("not_found");
            expect(setCounterInactiveMock).not.toHaveBeenCalled();
        });

        it("returns already_inactive without touching the repo update when the counter is already inactive", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.INACTIVE }));

            await expect(removeCounter(UUID)).resolves.toBe("already_inactive");
            expect(setCounterInactiveMock).not.toHaveBeenCalled();
        });

        it("returns not_found when the counter is active but the update affects no rows (race condition)", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            setCounterInactiveMock.mockResolvedValue(false);

            await expect(removeCounter(UUID)).resolves.toBe("not_found");
        });

        it("returns success and deactivates an active counter", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            setCounterInactiveMock.mockResolvedValue(true);

            await expect(removeCounter(UUID)).resolves.toBe("success");
            expect(setCounterInactiveMock).toHaveBeenCalledWith(UUID);
        });
    });

    describe("updateCounterByUUID", () => {
        it("returns not_found when the counter doesn't exist", async () => {
            findSingleCounterMock.mockResolvedValue(null);

            await expect(updateCounterByUUID(UUID, { name: "New name" })).resolves.toBe("not_found");
            expect(updateCounterMock).not.toHaveBeenCalled();
        });

        it("returns already_inactive without calling the repo update when the counter is inactive and not being reactivated", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.INACTIVE }));

            await expect(updateCounterByUUID(UUID, { name: "New name" })).resolves.toBe("already_inactive");
            expect(updateCounterMock).not.toHaveBeenCalled();
        });

        it("proceeds to update (reactivation) when the counter is inactive and body.status is active", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.INACTIVE }));
            updateCounterMock.mockResolvedValue(true);

            const body = { status: CounterStatus.ACTIVE };
            await expect(updateCounterByUUID(UUID, body)).resolves.toBe("success");
            expect(updateCounterMock).toHaveBeenCalledWith(UUID, body);
        });

        it("returns code_conflict when the repo throws a UNIQUE_VIOLATION DatabaseError", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            updateCounterMock.mockRejectedValue(new DatabaseError("UNIQUE_VIOLATION"));

            await expect(updateCounterByUUID(UUID, { code: "C01" })).resolves.toBe("code_conflict");
        });

        it("returns not_found when the repo update affects no rows without throwing (race condition)", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            updateCounterMock.mockResolvedValue(false);

            await expect(updateCounterByUUID(UUID, { name: "New name" })).resolves.toBe("not_found");
        });

        it("returns success and calls the repo with (uuid, body) on a normal update", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            updateCounterMock.mockResolvedValue(true);

            const body = { name: "New name" };
            await expect(updateCounterByUUID(UUID, body)).resolves.toBe("success");
            expect(updateCounterMock).toHaveBeenCalledWith(UUID, body);
        });

        it("rethrows errors that aren't a UNIQUE_VIOLATION DatabaseError instead of swallowing them as a conflict", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            updateCounterMock.mockRejectedValue(new DatabaseError("DEADLOCK_DETECTED"));

            await expect(updateCounterByUUID(UUID, { name: "New name" })).rejects.toThrow();
        });

        it("rethrows a plain (non-DatabaseError) error unchanged", async () => {
            findSingleCounterMock.mockResolvedValue(mockCounter({ status: CounterStatus.ACTIVE }));
            const unexpected = new Error("connection lost");
            updateCounterMock.mockRejectedValue(unexpected);

            await expect(updateCounterByUUID(UUID, { name: "New name" })).rejects.toBe(unexpected);
        });
    });
});