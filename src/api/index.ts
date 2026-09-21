import { Router } from "express";
import userRouter from "./users/user.routes.js";
import productRouter from "./products/product.routes.js"
import counterRouter from "./counters/counter.routes.js"
import counterSessionRouter from "./counters/sessions/counter-session.routes.js"
import inventoryRouter from "./inventory/inventory.routes.js";
import orderRouter from "./orders/order.routes.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import authRouter from "./auth/auth.routes.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", requireAuth, userRouter);
router.use("/products", requireAuth, productRouter);
router.use("/counters", requireAuth, counterRouter);
router.use("/counter-sessions", requireAuth, counterSessionRouter);
router.use("/inventory", requireAuth, inventoryRouter)
router.use("/orders", requireAuth, orderRouter)

export default router;