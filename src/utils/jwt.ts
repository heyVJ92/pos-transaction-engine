import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { UserRole } from "../db/models/user.model.js";
import { ACCESS_TOKEN_EXPIRES_IN } from "./constants.js";

export interface AccessTokenPayload {
    sub: string;
    role: UserRole;
}

export const signAccessToken = (payload: { id: number; role: UserRole }): string => {
    return jwt.sign(
        { sub: String(payload.id), role: payload.role },
        env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if(typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.role !== "string"){
        throw new Error("Malformed access token payload");
    }
    return {sub: decoded.sub, role: decoded.role as UserRole}
};