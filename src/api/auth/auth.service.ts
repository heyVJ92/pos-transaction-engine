import bcrypt from "bcrypt";
import type { PostLoginBody } from "./auth.schema.js";
import { findActiveUserByEmail } from "./auth.repository.js";
import { signAccessToken } from "../../utils/jwt.js";

export interface LoginSuccess {
    accessToken: string;
}

export const login = async (reqBody: PostLoginBody): Promise<LoginSuccess | "INVALID_CREDENTIALS"> => {
    const userRow = await findActiveUserByEmail(reqBody.email);
    if (!userRow) return "INVALID_CREDENTIALS";

    const matched = await bcrypt.compare(reqBody.password, userRow.passwordHash);
    if (!matched) return "INVALID_CREDENTIALS";

    const accessToken = signAccessToken({ id: userRow.id, role: userRow.role });
    return { accessToken };
};