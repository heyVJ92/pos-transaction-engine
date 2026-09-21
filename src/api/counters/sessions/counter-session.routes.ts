import { Router } from "express";
import { validateQuery } from "../../../middlewares/validate.js";
import { accessCheck } from "../../../middlewares/auth.middleware.js";
import { UserRole } from "../../../db/models/user.model.js";
import { getCounterSessionQuerySchema, addCounterSessionBodySchema, uuidParamSchema, updateCounterSessionBodySchema } from "./counter-session.schema.js";
import { listCounterSessionsHandler, addCounterSessionHandler, counterSessionDetailsHandler, counterSessionDeleteHandler, counterSessionUpdateHandler } from "./counter-session.controller.js";

const counterSessionRouter = Router();
counterSessionRouter.get(
  "/",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(getCounterSessionQuerySchema, "query"),
  listCounterSessionsHandler,
);

counterSessionRouter.post(
  "/",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(addCounterSessionBodySchema, "body"),
  addCounterSessionHandler,
)

counterSessionRouter.get(
  "/:uuid",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(uuidParamSchema, "params"),
  counterSessionDetailsHandler
)

counterSessionRouter.delete(
  "/:uuid",
  accessCheck([UserRole.ADMIN]),
  validateQuery(uuidParamSchema, "params"),
  counterSessionDeleteHandler
)

counterSessionRouter.put(
  "/:uuid",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(uuidParamSchema, "params"),
  validateQuery(updateCounterSessionBodySchema, "body"),
  counterSessionUpdateHandler
)

export default counterSessionRouter;
