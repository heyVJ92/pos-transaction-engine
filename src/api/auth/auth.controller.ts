import type { Request, Response, NextFunction } from "express";
import type { PostLoginBody } from "./auth.schema.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import { login } from "./auth.service.js";

export const loginHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const reqBody = res.locals["validatedBody"] as PostLoginBody;
    const result = await login(reqBody);

    if (result === "INVALID_CREDENTIALS") {
        sendError(res, "INVALID_CREDENTIALS", "Invalid credentials.", 401);
        return;
    }

    sendSuccess(res, "Login successful.", { accessToken: result.accessToken });
};