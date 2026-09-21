import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { accessCheck } from "../../middlewares/auth.middleware.js";
import { UserRole } from "../../db/models/user.model.js";
import { getUsersQuerySchema } from "./user.schema.js";
import { listUsersHandler } from "./user.controller.js";

const userRouter = Router();

userRouter.get("/", accessCheck([UserRole.ADMIN, UserRole.CASHIER]), validateQuery(getUsersQuerySchema), listUsersHandler);

export default userRouter;