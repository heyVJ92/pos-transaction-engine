import { Router } from "express";
import userRouter from "./users/user.routes.js";
import productRouter from "./products/product.routes.js"
import counterRouter from "./counters/counter.routes.js"
import counterSessionRouter from "./counters/sessions/counter-session.routes.js"
import inventoryRouter from "./inventory/inventory.routes.js";
import orderRouter from "./orders/order.routes.js";

const router = Router();

router.use("/users", userRouter);
router.use("/products", productRouter);
router.use("/counters", counterRouter);
router.use("/counter-sessions", counterSessionRouter);
router.use("/inventory", inventoryRouter)
router.use("/orders", orderRouter)

export default router;