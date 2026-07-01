import { Router } from "express";
import { validateQuery } from "../../../middlewares/validate.js";
import { getCounterSessionQuerySchema, addCounterSessionBodySchema, uuidParamSchema, updateCounterSessionBodySchema } from "./counter-session.schema.js";
import { listCounterSessionsHandler, addCounterSessionHandler, counterSessionDetailsHandler, counterSessionDeleteHandler, counterSessionUpdateHandler } from "./counter-session.controller.js";

const counterSessionRouter = Router();
counterSessionRouter.get(
  "/",
  validateQuery(getCounterSessionQuerySchema, "query"),
  listCounterSessionsHandler,
);

counterSessionRouter.post(
  "/",
  validateQuery(addCounterSessionBodySchema, "body"),
  addCounterSessionHandler,
)

counterSessionRouter.get(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  counterSessionDetailsHandler
)

counterSessionRouter.delete(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  counterSessionDeleteHandler
)

counterSessionRouter.put(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  validateQuery(updateCounterSessionBodySchema, "body"),
  counterSessionUpdateHandler
)

export default counterSessionRouter;
