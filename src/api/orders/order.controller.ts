import type { Request, Response, NextFunction } from "express";
import { sendError, sendPaginated, sendSuccess } from "../../utils/response.js";
import type { createOrderSchemaBody, getOrderListSchemaBody, ItemOrderDetailBody } from "./order.schema.js";
import {addOrderItem, createDraftOrder, getOrderList, removeOrderItem} from "./order.service.js";
import type { IOrderListPublic } from "../../db/models/order.model.js";

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
        case "ORDER_NOT_FOUND": sendError(res, "Order_NOT_FOUND", "No Order found with this id.", 409);
        return;
        case "ORDER_NOT_IN_DRAFT": sendError(res, "ORDER_NOT_IN_DRAFT", "This order is not in progress anymore so can't edit.", 409);
        return;
        case "PRODUCT_NOT_FOUND": sendError(res, "PRODUCT_NOT_FOUND", "No Product found with this id.", 409);
        return;
        case "INSUFFICIENT_STOCK": sendError(res, "INSUFFICIENT_STOCK", "Insufficient Stock", 409);
        return;
        case "ITEM_ADDED": sendSuccess(res, "Item added to order.", response.data);
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