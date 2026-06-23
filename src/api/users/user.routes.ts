import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { getUsersQuerySchema } from "./user.schema.js";
import { listUsersHandler } from "./user.controller.js";

const userRouter = Router();

userRouter.get("/", validateQuery(getUsersQuerySchema), listUsersHandler);
// userRouter.get("/", () => console.log("ssfge"))

export default userRouter;