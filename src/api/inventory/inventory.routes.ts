import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import {getInventoryQuerySchema, postInventoryBodySchema} from "./inventory.schema.js";
import {listInventoriesHandler} from "./inventory.controller.js"

const inventoryRouter = Router();

inventoryRouter.get(
    "/", 
    validateQuery(getInventoryQuerySchema, "query"),
    listInventoriesHandler
)

// inventoryRouter.post(
//     "/",
//     validateQuery(postInventoryBodySchema, "body"),
//     addInventoryHandler
// )

export default inventoryRouter;