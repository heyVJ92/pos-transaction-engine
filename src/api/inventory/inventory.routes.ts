import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { accessCheck } from "../../middlewares/auth.middleware.js";
import { UserRole } from "../../db/models/user.model.js";
import {getInventoryQuerySchema, uuidParamSchema, restockBodySchema, inventoryMovementQuerySchema} from "./inventory.schema.js";
import {listInventoriesHandler, restockHandler, movementsListHandler} from "./inventory.controller.js"

const inventoryRouter = Router();

inventoryRouter.get(
    "/",
    accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
    validateQuery(getInventoryQuerySchema, "query"),
    listInventoriesHandler
)

inventoryRouter.put(
    "/:product_uuid/restock",
    accessCheck([UserRole.ADMIN]),
    validateQuery(uuidParamSchema, "params"),
    validateQuery(restockBodySchema, "body"),
    restockHandler
)

inventoryRouter.get(
    "/:product_uuid/movements",
    accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
    validateQuery(uuidParamSchema, "params"),
    validateQuery(inventoryMovementQuerySchema, "query"),
    movementsListHandler
);

export default inventoryRouter;