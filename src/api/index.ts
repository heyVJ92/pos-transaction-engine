import { Router } from "express";
import userRouter from "./users/user.routes.js";
import productRouter from "./products/product.routes.js"
import counterRouter from "./counters/counter.routes.js"
import counterSessionRouter from "./counters/sessions/counter-session.routes.js"
import inventoryRouter from "./inventory/inventory.routes.js";
import orderRouter from "./orders/order.routes.js";
import { temporaryAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use("/users", userRouter);
router.use("/products", temporaryAuth, productRouter);
router.use("/counters", temporaryAuth, counterRouter);
router.use("/counter-sessions", temporaryAuth, counterSessionRouter);
router.use("/inventory", temporaryAuth, inventoryRouter)
router.use("/orders", temporaryAuth, orderRouter)

export default router;