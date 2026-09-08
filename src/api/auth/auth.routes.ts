import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { postLoginBodySchema } from "./auth.schema.js";
import { loginHandler } from "./auth.controller.js";

const authRouter = Router();

authRouter.post("/login", validateQuery(postLoginBodySchema, "body"), loginHandler);

export default authRouter;