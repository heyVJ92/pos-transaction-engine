// ===== IMPORTS =====
// import describe/it/expect/jest/beforeAll/beforeEach from "@jest/globals"
import { describe, it, jest, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
// import type-only the real service function we're about to mock — types only, no side effects
import type { login } from "../../../api/auth/auth.service.js";

// ===== DECLARE (not import) what needs mocking =====
let app: Express;
let loginMock: jest.Mock<typeof login>;

// ===== beforeAll =====
beforeAll(async () => {
    // 1. jest.unstable_mockModule() on the real service's path
    //    - stub EVERY named export of that module, not just the ones this file tests
    jest.unstable_mockModule("../../../api/auth/auth.service.js", () => ({
        login: jest.fn(),
    }));

    // 2. dynamically `await import()` that same service path -> grab the mocked fn, cast as jest.Mock
    const service = await import("../../../api/auth/auth.service.js");
    loginMock = service.login as jest.Mock<typeof login>;

    // 3. dynamically `await import()` the app -> assign to `app`
    //    (this pulls in the mocked service transitively, since step 1 ran first)
    app = (await import("../../../app.js")).default;
});

describe("auth.controller", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe("POST /auth/login", () => {
        // body validation tests
        it("returns 400 VALIDATION_ERROR when email is missing", async () => {
            const res = await request(app).post("/auth/login").send({ password: "password123" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(loginMock).not.toHaveBeenCalled();
        });

        it("returns 400 VALIDATION_ERROR when email is not a valid email format", async () => {
            const res = await request(app).post("/auth/login").send({ email: "not-an-email", password: "password123" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(loginMock).not.toHaveBeenCalled();
        });

        it("returns 400 VALIDATION_ERROR when password is under 8 characters", async () => {
            const res = await request(app).post("/auth/login").send({ email: "user@test.local", password: "short" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("VALIDATION_ERROR");
            expect(loginMock).not.toHaveBeenCalled();
        });

        // invalid credentials
        // Note: login() collapses "no matching user", "wrong password", and "inactive user" into
        // the same "INVALID_CREDENTIALS" return value — with the service mocked, those 3 causes are
        // indistinguishable here. They're verified for real (against the DB + bcrypt) in
        // src/test/integration/auth/login.test.ts instead; this is the one controller-level case.
        it("returns 401 INVALID_CREDENTIALS when the service reports invalid credentials", async () => {
            loginMock.mockResolvedValue("INVALID_CREDENTIALS");
            const res = await request(app).post("/auth/login").send({ email: "user@test.local", password: "password123" });
            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
        });

        // success response test
        it("returns 200 with { accessToken } on valid credentials, and nothing else", async () => {
            loginMock.mockResolvedValue({ accessToken: "signed.jwt.token" });
            const res = await request(app).post("/auth/login").send({ email: "user@test.local", password: "password123" });
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual({ accessToken: "signed.jwt.token" });
            expect(loginMock).toHaveBeenCalledWith({ email: "user@test.local", password: "password123" });
        });
    });
});
