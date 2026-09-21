import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { accessCheck } from "../../middlewares/auth.middleware.js";
import { UserRole } from "../../db/models/user.model.js";
import { getCounterQuerySchema, addCounterBodySchema, uuidParamSchema, updateCounterBodySchema } from "./counter.schema.js";
import { listCountersHandler, addCounterHandler, counterDetailsHandler, counterDeleteHandler, counterUpdateHandler } from "./counter.controller.js";

const counterRouter = Router();
counterRouter.get(
  "/",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(getCounterQuerySchema, "query"),
  listCountersHandler,
);

counterRouter.post(
  "/",
  accessCheck([UserRole.ADMIN]),
  validateQuery(addCounterBodySchema, "body"),
  addCounterHandler,
)

counterRouter.get(
  "/:uuid",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(uuidParamSchema, "params"),
  counterDetailsHandler
)

counterRouter.delete(
  "/:uuid",
  accessCheck([UserRole.ADMIN]),
  validateQuery(uuidParamSchema, "params"),
  counterDeleteHandler
)

counterRouter.patch(
  "/:uuid",
  accessCheck([UserRole.ADMIN]),
  validateQuery(uuidParamSchema, "params"),
  validateQuery(updateCounterBodySchema, "body"),
  counterUpdateHandler
)

export default counterRouter;
