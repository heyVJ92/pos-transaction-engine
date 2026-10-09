// Unit tests import this statically but load app.ts lazily (after jest.unstable_mockModule), so
// env.ts would otherwise validate process.env before app.ts's dotenv import has populated it.
import "dotenv/config";
import { UserRole } from "../../db/models/user.model.js";
import { signAccessToken } from "../../utils/jwt.js";

/**
 * Builds an `Authorization` header value for routes behind requireAuth + accessCheck.
 * requireAuth only verifies the JWT (no DB lookup), so unit tests with mocked services can use
 * the default id. Integration tests should pass the seeded user's real id, because services
 * read req.user.id (e.g. idempotency rows are keyed by user).
 * ADMIN is the default because it passes every accessCheck on the resource routes.
 */
export const authHeader = (role: UserRole = UserRole.ADMIN, id = 1): string =>
    `Bearer ${signAccessToken({ id, role })}`;
