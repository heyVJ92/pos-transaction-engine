import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import {getInventoryQuerySchema, uuidParamSchema, restockBodySchema, inventoryMovementQuerySchema} from "./inventory.schema.js";
import {listInventoriesHandler, restockHandler, movementsListHandler} from "./inventory.controller.js"

const inventoryRouter = Router();

inventoryRouter.get(
    "/", 
    validateQuery(getInventoryQuerySchema, "query"),
    listInventoriesHandler
)

inventoryRouter.put(
    "/:product_uuid/restock", 
    validateQuery(uuidParamSchema, "params"),
    validateQuery(restockBodySchema, "body"),
    restockHandler
)

inventoryRouter.get(
    "/:product_uuid/movements", 
    validateQuery(uuidParamSchema, "params"),
    validateQuery(inventoryMovementQuerySchema, "query"),
    movementsListHandler
);

export default inventoryRouter;