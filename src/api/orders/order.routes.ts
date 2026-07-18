import Router from "express";
import { addOrderItemHandler, createDraftOrderHandler, deleteOrderItemHandler, getOrderListHandler } from "./order.controller.js";
import { validateQuery } from "../../middlewares/validate.js";
import {createOrderBodySchema, getOrderListQuerySchema, itemOrderDetailBodySchema, uuidParamSchema, orderAndItemParamSchema} from "./order.schema.js"
const orderRouter = Router();


orderRouter.post("/", validateQuery(createOrderBodySchema, "body"), createDraftOrderHandler);
orderRouter.get("/", validateQuery(getOrderListQuerySchema, "query"), getOrderListHandler);
orderRouter.post("/:uuid/items", validateQuery(uuidParamSchema, "params"), validateQuery(itemOrderDetailBodySchema, "body"), addOrderItemHandler);
orderRouter.delete("/:uuid/items/:itemUuid", validateQuery(orderAndItemParamSchema, "params"), deleteOrderItemHandler);

export default orderRouter;