import Router from "express";
import { addOrderItemHandler, checkoutOrderHandler, createDraftOrderHandler, deleteOrderItemHandler, editOrderItemHandler, getOrderListHandler, holdOrderHandler, getOrderDetailHandler, cancelOrderHandler, paymentHandler, revertOrderHandler } from "./order.controller.js";
import { validateQuery } from "../../middlewares/validate.js";
import {createOrderBodySchema, editOrderItemBodySchema, getOrderListQuerySchema, itemOrderDetailBodySchema, payOrderBodySchema, uuidParamSchema, orderAndItemParamSchema} from "./order.schema.js"
const orderRouter = Router();


orderRouter.post("/", validateQuery(createOrderBodySchema, "body"), createDraftOrderHandler);
orderRouter.get("/", validateQuery(getOrderListQuerySchema, "query"), getOrderListHandler);
orderRouter.post("/:uuid/items", validateQuery(uuidParamSchema, "params"), validateQuery(itemOrderDetailBodySchema, "body"), addOrderItemHandler);
orderRouter.patch("/:uuid/items/:itemUuid", validateQuery(orderAndItemParamSchema, "params"), validateQuery(editOrderItemBodySchema, "body"), editOrderItemHandler);
orderRouter.delete("/:uuid/items/:itemUuid", validateQuery(orderAndItemParamSchema, "params"), deleteOrderItemHandler);
orderRouter.get("/:uuid", validateQuery(uuidParamSchema, "params"), getOrderDetailHandler)
orderRouter.patch("/:uuid/checkout", validateQuery(uuidParamSchema, "params"), checkoutOrderHandler);
orderRouter.patch("/:uuid/revert", validateQuery(uuidParamSchema, "params"), revertOrderHandler);
orderRouter.patch("/:uuid/hold", validateQuery(uuidParamSchema, "params"), holdOrderHandler);
orderRouter.patch("/:uuid/cancel", validateQuery(uuidParamSchema, "params"), cancelOrderHandler);
orderRouter.patch("/:uuid/payment", validateQuery(uuidParamSchema, "params"), validateQuery(payOrderBodySchema, "body"), paymentHandler);

export default orderRouter;