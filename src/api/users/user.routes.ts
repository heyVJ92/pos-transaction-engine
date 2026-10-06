import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { accessCheck } from "../../middlewares/auth.middleware.js";
import { UserRole } from "../../db/models/user.model.js";
import { getUsersQuerySchema, updateSelfBodySchema } from "./user.schema.js";
import { listUsersHandler, getCurrentUserHandler, updateCurrentUserHandler } from "./user.controller.js";

const userRouter = Router();

userRouter.get("/", accessCheck([UserRole.ADMIN, UserRole.CASHIER]), validateQuery(getUsersQuerySchema), listUsersHandler);

// Registered ahead of any future "/:uuid" route — "me" must never be swallowed by a uuid param match.
userRouter.get("/me", accessCheck([UserRole.ADMIN, UserRole.CASHIER]), getCurrentUserHandler);
userRouter.patch("/me", accessCheck([UserRole.ADMIN, UserRole.CASHIER]), validateQuery(updateSelfBodySchema, "body"), updateCurrentUserHandler);

export default userRouter;