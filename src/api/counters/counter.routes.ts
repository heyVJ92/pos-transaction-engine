import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { getCounterQuerySchema, addCounterBodySchema, uuidParamSchema, updateCounterBodySchema } from "./counter.schema.js";
import { listCountersHandler, addCounterHandler, counterDetailsHandler, counterDeleteHandler, counterUpdateHandler } from "./counter.controller.js";

const counterRouter = Router();
counterRouter.get(
  "/",
  validateQuery(getCounterQuerySchema, "query"),
  listCountersHandler,
);

counterRouter.post(
  "/",
  validateQuery(addCounterBodySchema, "body"),
  addCounterHandler,
)

counterRouter.get(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  counterDetailsHandler
)

counterRouter.delete(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  counterDeleteHandler
)

counterRouter.put(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  validateQuery(updateCounterBodySchema, "body"),
  counterUpdateHandler
)

export default counterRouter;
