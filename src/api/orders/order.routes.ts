import Router from "express";
import { addOrderItemHandler, createDraftOrderHandler, deleteOrderItemHandler, getOrderListHandler, holdOrderHandler, getOrderDetailHandler, cancelOrderHandler, paymentHandler } from "./order.controller.js";
import { validateQuery } from "../../middlewares/validate.js";
import {createOrderBodySchema, getOrderListQuerySchema, itemOrderDetailBodySchema, uuidParamSchema, orderAndItemParamSchema} from "./order.schema.js"
const orderRouter = Router();


orderRouter.post("/", validateQuery(createOrderBodySchema, "body"), createDraftOrderHandler);
orderRouter.get("/", validateQuery(getOrderListQuerySchema, "query"), getOrderListHandler);
orderRouter.post("/:uuid/items", validateQuery(uuidParamSchema, "params"), validateQuery(itemOrderDetailBodySchema, "body"), addOrderItemHandler);
orderRouter.delete("/:uuid/items/:itemUuid", validateQuery(orderAndItemParamSchema, "params"), deleteOrderItemHandler);
orderRouter.get("/:uuid", validateQuery(uuidParamSchema, "params"), getOrderDetailHandler)
orderRouter.patch("/:uuid/hold", validateQuery(uuidParamSchema, "params"), holdOrderHandler);
orderRouter.patch("/:uuid/cancel", validateQuery(uuidParamSchema, "params"), cancelOrderHandler);
orderRouter.patch("/:uuid/payment", validateQuery(uuidParamSchema, "params"), paymentHandler);

export default orderRouter;