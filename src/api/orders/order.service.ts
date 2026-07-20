import { findSingleCounterSession } from "../counters/sessions/counter-session.repository.js";
import type { createOrderSchemaBody, getOrderListSchemaBody, ItemOrderDetailBody } from "./order.schema.js";
import {addItemTransaction, cancelOrderById, findAllOrders, findOrderByUuid, findSingleOrder, InsertDraftOrder, processPayment, removeItemTransaction, updateOrderStatus, type CreateOrderResult} from "./order.repository.js"
import {OrderStatus, type IOrderDetail, type IOrderList} from "../../db/models/order.model.js"
import { findSingleProduct } from "../products/product.repository.js";

export const createDraftOrder = async (body: createOrderSchemaBody): Promise<"INVALID_SESSION" | CreateOrderResult> => {
    const session = await findSingleCounterSession(body.sessionUuid);
    if(!session) return "INVALID_SESSION";
    return await InsertDraftOrder(session.id,body.discount, session.userId)
}

interface sendPaginated {
    data: IOrderList[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const getOrderList = async (params: getOrderListSchemaBody): Promise<sendPaginated> => {
    const {data, total} = await findAllOrders(params)
    return {
        data,
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total/ params.limit)
    }
}

interface AddItemSuccessResponse {
    message: "ITEM_ADDED";
    data?: {
        uuid: string;
        productName: string;
        sku: string;
        quantity: number;
        sellPrice: number;
        total: number;
        orderTotal: number;
        tax: number;
        subTotal: number,
        orderUuid: string
    }
}

interface AddItemErrorResponse {
    message: "PRODUCT_NOT_FOUND" | "INSUFFICIENT_STOCK" | "ORDER_NOT_FOUND" | "SOMETHING_WENT_WRONG" | "ORDER_NOT_IN_DRAFT";
    data? : {
        productName: string;
        sku: string;
        requested: number;
        available: number;
    } 
}

export const addOrderItem = async(
    orderUuid: string,
    itemBody: ItemOrderDetailBody
): Promise<AddItemErrorResponse | AddItemSuccessResponse> => {

    // 1. validate both exist
    const [product, order] = await Promise.all([
        findSingleProduct(itemBody.productUuid),
        findSingleOrder(orderUuid)
    ]);

    if (!product) return { message: "PRODUCT_NOT_FOUND" };
    if (!order)   return { message: "ORDER_NOT_FOUND" };
    if (order.status !== OrderStatus.DRAFT) return { message: "ORDER_NOT_IN_DRAFT" }; // later move to draft

    // 2. pre-lock stock check (optimisation)
    if (product.availableStock < itemBody.quantity) {
        return {
            message: "INSUFFICIENT_STOCK",
            data: {
                productName: product.name,
                sku: product.sku,
                requested: itemBody.quantity,
                available: product.availableStock
            }
        };
    }

    // 3. transaction: lock → check again → update inventory → insert item → recalculate totals
    const result = await addItemTransaction(order.id, product, itemBody);
    if (!result) return { message: "SOMETHING_WENT_WRONG" };

    return { message: "ITEM_ADDED", data: result };
};

interface RemoveItemSuccessResponse {
    message: "ITEM_REMOVED";
    data?: {
        uuid: string;
        productName: string;
        sku: string;
        quantity: number;
        orderUuid: string;
        subTotal: number;
        tax: number;
        orderTotal: number;
    }
}

interface RemoveItemErrorResponse {
    message: "ORDER_NOT_FOUND" | "ORDER_NOT_IN_DRAFT" | "ITEM_NOT_FOUND";
}

export const removeOrderItem = async(
    orderUuid: string,
    itemUuid: string
): Promise<RemoveItemErrorResponse | RemoveItemSuccessResponse> => {

    const order = await findSingleOrder(orderUuid);
    if (!order) return { message: "ORDER_NOT_FOUND" };
    if (order.status !== OrderStatus.DRAFT) return { message: "ORDER_NOT_IN_DRAFT" };

    const result = await removeItemTransaction(order.id, itemUuid);
    if (!result) return { message: "ITEM_NOT_FOUND" };

    return { message: "ITEM_REMOVED", data: result };
};

export const getOrderDetails = async (orderUuid: string): Promise<IOrderDetail | null> => {
    return await findOrderByUuid(orderUuid);
}

const NON_HOLDABLE_STATUSES: OrderStatus[] = [OrderStatus.HOLD, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.EXPIRED];
const NON_CANCELABLE_STATUSES: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.EXPIRED];

interface HoldOrderSuccessResponse {
    message: "ORDER_HELD";
    data: {
        uuid: string;
        status: OrderStatus;
    }
}

interface HoldOrderErrorResponse {
    message: "ORDER_NOT_HOLDABLE";
    reason: string;
}

export const holdOrder = async(orderUuid: string): Promise<HoldOrderErrorResponse | HoldOrderSuccessResponse> => {
    const order = await findSingleOrder(orderUuid);
    if (!order) return { message: "ORDER_NOT_HOLDABLE", reason: "ORDER_NOT_FOUND" };
    if (NON_HOLDABLE_STATUSES.includes(order.status)) return { message: "ORDER_NOT_HOLDABLE", reason: `This order can't be put on hold as its already ${order.status}.` };

    const result = await updateOrderStatus(order.id, OrderStatus.HOLD);
    return { message: "ORDER_HELD", data: result };
};

export const cancelOrder = async (
    orderUuid: string
): Promise<"not_found" | "cannot_cancel" | "success"> => {
    return cancelOrderById(orderUuid);
    // status check happens inside transaction with lock
    // no pre-check needed — avoids TOCTOU race condition
};

// src/api/orders/order.service.ts

export const processOrderPayment = async (
    orderUuid: string
): Promise<"not_found" | "invalid_status" | "success" | "failed"> => {
    return processPayment(orderUuid);
};