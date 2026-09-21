import Router from "express";
import { addOrderItemHandler, checkoutOrderHandler, createDraftOrderHandler, deleteOrderItemHandler, editOrderItemHandler, getOrderListHandler, holdOrderHandler, getOrderDetailHandler, cancelOrderHandler, paymentHandler, revertOrderHandler } from "./order.controller.js";
import { validateQuery } from "../../middlewares/validate.js";
import { accessCheck } from "../../middlewares/auth.middleware.js";
import { UserRole } from "../../db/models/user.model.js";
import {createOrderBodySchema, editOrderItemBodySchema, getOrderListQuerySchema, itemOrderDetailBodySchema, payOrderBodySchema, uuidParamSchema, orderAndItemParamSchema} from "./order.schema.js"
const orderRouter = Router();

const bothRoles = accessCheck([UserRole.ADMIN, UserRole.CASHIER]);

orderRouter.post("/", bothRoles, validateQuery(createOrderBodySchema, "body"), createDraftOrderHandler);
orderRouter.get("/", bothRoles, validateQuery(getOrderListQuerySchema, "query"), getOrderListHandler);
orderRouter.post("/:uuid/items", bothRoles, validateQuery(uuidParamSchema, "params"), validateQuery(itemOrderDetailBodySchema, "body"), addOrderItemHandler);
orderRouter.patch("/:uuid/items/:itemUuid", bothRoles, validateQuery(orderAndItemParamSchema, "params"), validateQuery(editOrderItemBodySchema, "body"), editOrderItemHandler);
orderRouter.delete("/:uuid/items/:itemUuid", bothRoles, validateQuery(orderAndItemParamSchema, "params"), deleteOrderItemHandler);
orderRouter.get("/:uuid", bothRoles, validateQuery(uuidParamSchema, "params"), getOrderDetailHandler)
orderRouter.patch("/:uuid/checkout", bothRoles, validateQuery(uuidParamSchema, "params"), checkoutOrderHandler);
orderRouter.patch("/:uuid/revert", bothRoles, validateQuery(uuidParamSchema, "params"), revertOrderHandler);
orderRouter.patch("/:uuid/hold", bothRoles, validateQuery(uuidParamSchema, "params"), holdOrderHandler);
orderRouter.patch("/:uuid/cancel", bothRoles, validateQuery(uuidParamSchema, "params"), cancelOrderHandler);
orderRouter.patch("/:uuid/payment", bothRoles, validateQuery(uuidParamSchema, "params"), validateQuery(payOrderBodySchema, "body"), paymentHandler);

export default orderRouter;