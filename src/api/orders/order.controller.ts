import type { Request, Response, NextFunction } from "express";
import { sendError, sendPaginated, sendSuccess } from "../../utils/response.js";
import type { createOrderSchemaBody, EditOrderItemBody, getOrderListSchemaBody, ItemOrderDetailBody, PayOrderBody } from "./order.schema.js";
import {addOrderItem, cancelOrder, checkoutOrder, createDraftOrder, editOrderItem, getOrderDetails, getOrderList, holdOrder, processOrderPayment, removeOrderItem, revertOrderToDraft} from "./order.service.js";
import type { IOrderDetailPublic, IOrderListPublic } from "../../db/models/order.model.js";
import { isIdempotencyDecision } from "../../db/models/idempotency.model.js";
import { handleIdempotencyDecision } from "../../modules/idempotency/idempotency.service.js";

export const createDraftOrderHandler = async (req: Request,res: Response,next: NextFunction): Promise<void> =>{
    const reqBody = res.locals["validatedBody"] as createOrderSchemaBody;
    const result = await createDraftOrder(reqBody);
    if(result === "INVALID_SESSION"){
        sendError(res, "INVALID_SESSION", "Invalid Session uuid", 409);
        return;
    } 
    sendSuccess(res, "Order added Successfully", result, 201)
}

export const getOrderListHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const query = res.locals["validatedQuery"] as getOrderListSchemaBody;
    const {data, ...meta} = await getOrderList(query)
    const publicRecord: IOrderListPublic[] = data.map(({id, ...rest}) => rest)
    sendPaginated(res, "Order added Successfully", publicRecord, meta)
}

export const addOrderItemHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {uuid: orderUuid} = res.locals["validatedParams"];
    const itemBody = res.locals["validatedBody"] as ItemOrderDetailBody;
    const response = await addOrderItem(orderUuid, itemBody)
    switch (response.message) {
        case "ORDER_NOT_FOUND": sendError(res, "ORDER_NOT_FOUND", "No Order found with this id.", 409);
        return;
        case "ORDER_NOT_IN_DRAFT": sendError(res, "ORDER_NOT_IN_DRAFT", "This order is not in progress anymore so can't edit.", 409);
        return;
        case "PRODUCT_NOT_FOUND": sendError(res, "PRODUCT_NOT_FOUND", "No Product found with this id.", 409);
        return;
        case "INSUFFICIENT_STOCK": sendError(res, "INSUFFICIENT_STOCK", "Insufficient Stock", 409, response.data);
        return;
        case "SOMETHING_WENT_WRONG": sendError(res, "SOMETHING_WENT_WRONG", "Something went wrong", 500, response.data);
        return;
        case "ITEM_ADDED": sendSuccess(res, "Item added to order.", response.data);
        return;
    }
}

export const editOrderItemHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {uuid: orderUuid, itemUuid} = res.locals["validatedParams"] as {uuid: string, itemUuid: string};
    const body = res.locals["validatedBody"] as EditOrderItemBody;
    const response = await editOrderItem(orderUuid, itemUuid, body)
    switch (response.message) {
        case "ORDER_NOT_FOUND": sendError(res, "ORDER_NOT_FOUND", "No Order found with this id.", 409);
        return;
        case "ORDER_NOT_IN_DRAFT": sendError(res, "ORDER_NOT_IN_DRAFT", "This order is not in progress anymore so can't edit.", 409);
        return;
        case "ITEM_NOT_FOUND": sendError(res, "ITEM_NOT_FOUND", "No item found with this id in the order.", 409);
        return;
        case "INSUFFICIENT_STOCK": sendError(res, "INSUFFICIENT_STOCK", "Insufficient Stock", 409, response.data);
        return;
        case "ITEM_REMOVED": sendSuccess(res, "Item removed from order.", response.data);
        return;
        case "ITEM_EDITED": sendSuccess(res, "Item quantity updated.", response.data);
        return;
    }
}

export const deleteOrderItemHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {uuid: orderUuid, itemUuid} = res.locals["validatedParams"] as {uuid: string, itemUuid: string};
    const response = await removeOrderItem(orderUuid, itemUuid);
    switch (response.message) {
        case "ORDER_NOT_FOUND": sendError(res, "ORDER_NOT_FOUND", "No Order found with this id.", 409);
        return;
        case "ORDER_NOT_IN_DRAFT": sendError(res, "ORDER_NOT_IN_DRAFT", "This order is not in progress anymore so can't edit.", 409);
        return;
        case "ITEM_NOT_FOUND": sendError(res, "ITEM_NOT_FOUND", "No item found with this id in the order.", 409);
        return;
        case "ITEM_REMOVED": sendSuccess(res, "Item removed from order.", response.data);
        return;
    }
}

export const holdOrderHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const {uuid: orderUuid} = res.locals["validatedParams"] as {uuid: string};
    const response = await holdOrder(orderUuid);
    switch (response.message) {
        case "ORDER_NOT_HOLDABLE": sendError(res, "ORDER_NOT_HOLDABLE", response.reason, 409);
        return;
        case "ORDER_HELD": sendSuccess(res, "Order put on hold.", response.data);
        return;
    }
}

export const getOrderDetailHandler = async (req: Request, res: Response, next: NextFunction) : Promise<void> => {
        const {uuid: orderUuid} = res.locals["validatedParams"] as {uuid: string};
        const result = await getOrderDetails(orderUuid);
        if(!result) {
            sendError(res, "NOT_FOUND", "No details found for this Order", 404)
             return;
            }
        const {id, ...data} =  result;
        sendSuccess(res, `Order details fetched successfully.`, data);
}

export const checkoutOrderHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { uuid } = res.locals["validatedParams"];
    const result = await checkoutOrder(uuid);

    if (result === "not_found") {
        sendError(res, "ORDER_NOT_FOUND", "Order not found", 404);
        return;
    }
    if (result === "not_draft") {
        sendError(res, "ORDER_NOT_IN_DRAFT", "Only a draft order can be checked out", 409);
        return;
    }
    if (result === "empty_order") {
        sendError(res, "ORDER_EMPTY", "Cannot check out an order with no items", 409);
        return;
    }
    sendSuccess(res, "Order checked out. Ready for payment.", result);
};

export const revertOrderHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { uuid } = res.locals["validatedParams"];
    const result = await revertOrderToDraft(uuid);

    if (result === "not_found") {
        sendError(res, "ORDER_NOT_FOUND", "Order not found", 404);
        return;
    }
    if (result === "not_in_process") {
        sendError(res, "ORDER_NOT_IN_PROCESS", "Only an order in process can be reverted to draft", 409);
        return;
    }
    sendSuccess(res, "Order reverted to draft. Cart is editable again.", result);
};

export const cancelOrderHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { uuid } = res.locals["validatedParams"];
    const result = await cancelOrder(uuid);

    switch (result) {
        case "not_found":
            sendError(res, "ORDER_NOT_FOUND", "Order not found", 404);
            return;
        case "cannot_cancel":
            sendError(res, "CANNOT_CANCEL", "Order cannot be cancelled in its current status", 409);
            return;
        case "success":
            sendSuccess(res, "Order cancelled successfully.");
            return;
    }
};

export const paymentHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { uuid } = res.locals["validatedParams"];
    if (!req.user) {
        throw new Error("Authenticated user missing");
    }
    const {id: user_id} = req.user;
    const body = res.locals["validatedBody"] as PayOrderBody;
    const idempotencyKey = req.get("Idempotency-Key");
    if (!idempotencyKey?.trim()) {
        sendError(
            res,
            "IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Key header is required",
            400
        );
        return;
    }

    const result = await processOrderPayment(uuid, user_id, body, idempotencyKey);
    if (isIdempotencyDecision(result)) {
        handleIdempotencyDecision(res, result);
        return;
    }

    if (result === "not_found") {
        sendError(res, "ORDER_NOT_FOUND", "Order not found", 404);
        return;
    }
    if (result === "invalid_status") {
        sendError(res, "INVALID_STATUS", "Order is not awaiting payment", 409);
        return;
    }
    if (result === "insufficient_tender") {
        sendError(res, "INSUFFICIENT_TENDER", "Amount tendered is less than the order total", 409);
        return;
    }
    if (result === "already_paid") {
        sendError(res, "ALREADY_PAID", "This order has already been paid", 409);
        return;
    }
    sendSuccess(res, "Payment successful. Order completed.", result);
};