import { Router } from "express";
import userRouter from "./users/user.routes.js";
import productRouter from "./products/product.route.js"

const router = Router();

router.use("/users", userRouter);
router.use("/products", productRouter);

export default router;