import { Router } from "express";
import userRouter from "./users/user.routes.js";

const router = Router();

router.use("/users", userRouter);

export default router;