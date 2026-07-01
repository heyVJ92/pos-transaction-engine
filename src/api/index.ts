import { Router } from "express";
import userRouter from "./users/user.routes.js";
import productRouter from "./products/product.routes.js"
import counterRouter from "./counters/counter.routes.js"
import counterSessionRouter from "./counters/sessions/counter-session.routes.js"

const router = Router();

router.use("/users", userRouter);
router.use("/products", productRouter);
router.use("/counters", counterRouter);
router.use("/counter-sessions", counterSessionRouter);

export default router;