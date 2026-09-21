// Isolated unit tests for requireAuth/accessCheck — cross-cutting middlewares, not tied to one
// route, so they're exercised by calling them directly against mock req/res/next objects rather
// than through supertest + a real route (mocking Express Request/Response has less value here than
// asserting the exact status/error-code/next() behavior of the middleware functions themselves).
//
// requireAuth:  stockapi/src/middlewares/auth.middleware.ts
// accessCheck:  stockapi/src/middlewares/auth.middleware.ts — now wired into every resource route
//               (see docs/decisions.md 2026-09-10), but still tested here in isolation rather than
//               via any one specific route, since the assertions are about the middleware's own
//               contract (status/code/next), not any particular route's behavior.
//
// ===== IMPORTS =====
import { describe, it, jest, expect, beforeAll, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import type { verifyAccessToken } from "../../../utils/jwt.js";
import { UserRole } from "../../../db/models/user.model.js";

// ===== DECLARE (not import) what needs mocking =====
let requireAuth: typeof import("../../../middlewares/auth.middleware.js")["requireAuth"];
let accessCheck: typeof import("../../../middlewares/auth.middleware.js")["accessCheck"];

let verifyAccessTokenMock: jest.Mock<typeof verifyAccessToken>;

// ===== mock req/res/next helpers =====
const mockRequest = (overrides: Partial<Request> = {}): Request =>
    ({ headers: {}, ...overrides } as unknown as Request);

const mockResponse = (): Response => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res) as unknown as Response["status"];
    res.json = jest.fn().mockReturnValue(res) as unknown as Response["json"];
    return res;
};

const mockNext = (): NextFunction => jest.fn() as unknown as NextFunction;

// ===== beforeAll =====
beforeAll(async () => {
    // 1. jest.unstable_mockModule() on the real jwt util's path
    //    - stub EVERY named export of that module, not just the one this file tests
    jest.unstable_mockModule("../../../utils/jwt.js", () => ({
        verifyAccessToken: jest.fn(),
        signAccessToken: jest.fn(),
    }));

    // 2. dynamically `await import()` that same jwt path -> grab the mocked fn, cast as jest.Mock
    const jwt = await import("../../../utils/jwt.js");
    verifyAccessTokenMock = jwt.verifyAccessToken as unknown as jest.Mock<typeof verifyAccessToken>;

    // 3. dynamically `await import()` the middleware -> this pulls in the mocked jwt util
    //    transitively, since step 1 ran first
    const middleware = await import("../../../middlewares/auth.middleware.js");
    requireAuth = middleware.requireAuth;
    accessCheck = middleware.accessCheck;
});

describe("auth.middleware — requireAuth", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it("calls next() and sets req.user = { id, role } for a valid Bearer token", () => {
        verifyAccessTokenMock.mockReturnValue({ sub: "5", role: UserRole.ADMIN });
        const req = mockRequest({ headers: { authorization: "Bearer valid.token.here" } });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req, res, next);

        expect(verifyAccessTokenMock).toHaveBeenCalledWith("valid.token.here");
        expect(req.user).toEqual({ id: 5, role: UserRole.ADMIN });
        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 401 UNAUTHORIZED when the Authorization header is missing", () => {
        const req = mockRequest();
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Authentication required." },
        });
        expect(next).not.toHaveBeenCalled();
        expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    });

    it("returns 401 UNAUTHORIZED when the Authorization header does not start with \"Bearer \"", () => {
        const req = mockRequest({ headers: { authorization: "Basic dXNlcjpwYXNz" } });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Authentication required." },
        });
        expect(next).not.toHaveBeenCalled();
        expect(verifyAccessTokenMock).not.toHaveBeenCalled();
    });

    it("returns 401 UNAUTHORIZED when the token is malformed / not a valid JWT", () => {
        verifyAccessTokenMock.mockImplementation(() => {
            throw new Error("jwt malformed");
        });
        const req = mockRequest({ headers: { authorization: "Bearer not-a-jwt" } });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 UNAUTHORIZED when the token is expired", () => {
        verifyAccessTokenMock.mockImplementation(() => {
            throw new Error("jwt expired");
        });
        const req = mockRequest({ headers: { authorization: "Bearer expired.token.here" } });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
        });
        expect(next).not.toHaveBeenCalled();
    });

    // verifyAccessToken throws "Malformed access token payload" when a validly-signed token is
    // missing sub/role or has the wrong types for them — distinct from an invalid signature, but
    // requireAuth's catch block is generic, so the response is identical to the other failure cases.
    it("returns 401 UNAUTHORIZED when the token is validly signed but its payload is missing sub/role", () => {
        verifyAccessTokenMock.mockImplementation(() => {
            throw new Error("Malformed access token payload");
        });
        const req = mockRequest({ headers: { authorization: "Bearer well-signed.but.incomplete" } });
        const res = mockResponse();
        const next = mockNext();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
        });
        expect(next).not.toHaveBeenCalled();
    });
});

describe("auth.middleware — accessCheck (RBAC)", () => {
    it("calls next() when req.user.role is in the allowed roles list", () => {
        const req = mockRequest({ user: { id: 1, role: UserRole.ADMIN } });
        const res = mockResponse();
        const next = mockNext();

        accessCheck([UserRole.ADMIN, UserRole.CASHIER])(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 403 FORBIDDEN when req.user.role is not in the allowed roles list", () => {
        const req = mockRequest({ user: { id: 2, role: UserRole.CASHIER } });
        const res = mockResponse();
        const next = mockNext();

        accessCheck([UserRole.ADMIN])(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 FORBIDDEN when req.user is undefined", () => {
        const req = mockRequest(); // no `user` set — requireAuth never ran ahead of this middleware
        const res = mockResponse();
        const next = mockNext();

        accessCheck([UserRole.ADMIN, UserRole.CASHIER])(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
        });
        expect(next).not.toHaveBeenCalled();
    });
});
