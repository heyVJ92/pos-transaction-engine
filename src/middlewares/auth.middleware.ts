import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { sendError } from "../utils/response.js";
import type { UserRole } from "../db/models/user.model.js";

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        sendError(res, "UNAUTHORIZED", "Authentication required.", 401);
        return;
    }

    const token = authHeader.slice("Bearer ".length);

    try {
        const payload = verifyAccessToken(token);
        req.user = { id: Number(payload.sub), role: payload.role };
        next();
    } catch (err) {
        sendError(res, "UNAUTHORIZED", "Invalid or expired token.", 401);
        return;
    }
};


export const accessCheck = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            sendError(res, "FORBIDDEN", "You do not have permission to perform this action.", 403);
            return;
        }
        next();
    };
};