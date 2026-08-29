import { findSingleCounterSession } from "../counters/sessions/counter-session.repository.js";
import type { createOrderSchemaBody, EditOrderItemBody, getOrderListSchemaBody, ItemOrderDetailBody, PayOrderBody } from "./order.schema.js";
import {addItemTransaction, cancelOrderById, checkoutOrderByUuid, editItemTransaction, findAllOrders, findOrderByUuid, findSingleOrder, InsertDraftOrder, processPayment, removeItemTransaction, revertOrderToDraftByUuid, updateOrderStatus, type OrderStatusResult, type CreateOrderResult, type PaymentResult} from "./order.repository.js"
import {OrderStatus, type IOrderDetail, type IOrderList} from "../../db/models/order.model.js"
import { findSingleProduct } from "../products/product.repository.js";
import { pool } from "../../config/database.js";
import { handleDbError, isPostgresError } from "../../utils/db-errors.js";
import { beginIdempotentOperation } from "../../modules/idempotency/idempotency.service.js";
import { IDEMPOTENCY_DECISION, type IdempotencyDecision, type IdempotencyResultUpdate } from "../../db/models/idempotency.model.js";
import { markIdempotencyFailure, markIdempotencySuccess } from "../../modules/idempotency/idempotency.repository.js";

export const createDraftOrder = async (body: createOrderSchemaBody): Promise<"INVALID_SESSION" | CreateOrderResult> => {
    const session = await findSingleCounterSession(body.sessionUuid);
    if(!session) return "INVALID_SESSION";
    return await InsertDraftOrder(session.id, session.userId)
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
        costPrice: number;
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

interface EditItemSuccessResponse {
    message: "ITEM_EDITED";
    data?: {
        uuid: string;
        productName: string;
        sku: string;
        quantity: number;
        sellPrice: number;
        costPrice: number;
        orderUuid: string;
        subTotal: number;
        tax: number;
        orderTotal: number;
    }
}

// quantity edited down to 0 — the line is gone, so this carries no price fields,
// same shape as removeOrderItem's success response
interface EditItemRemovedResponse {
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

interface EditItemErrorResponse {
    message: "INSUFFICIENT_STOCK" | "ORDER_NOT_FOUND" | "ORDER_NOT_IN_DRAFT" | "ITEM_NOT_FOUND";
    data?: {
        productName: string;
        sku: string;
        requested: number;
        available: number;
    }
}

export const editOrderItem = async (
    orderUuid: string,
    itemUuid: string,
    body: EditOrderItemBody
): Promise<EditItemErrorResponse | EditItemSuccessResponse | EditItemRemovedResponse> => {

    const order = await findSingleOrder(orderUuid);
    if (!order) return { message: "ORDER_NOT_FOUND" };
    if (order.status !== OrderStatus.DRAFT) return { message: "ORDER_NOT_IN_DRAFT" };

    const result = await editItemTransaction(order.id, itemUuid, body.quantity);
    if (result.outcome === "not_found") return { message: "ITEM_NOT_FOUND" };
    if (result.outcome === "insufficient_stock") return { message: "INSUFFICIENT_STOCK", data: result.data };
    if (result.outcome === "removed") return { message: "ITEM_REMOVED", data: result.data };
    return { message: "ITEM_EDITED", data: result.data };
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

export const checkoutOrder = async (
    orderUuid: string
): Promise<"not_found" | "not_draft" | "empty_order" | OrderStatusResult> => {
    return checkoutOrderByUuid(orderUuid);
    // status/empty checks happen inside the transaction with the order locked —
    // same TOCTOU reasoning as cancelOrder below
};

// in_process -> draft, so the cashier can edit the cart again before re-checking out.
// No permission gate — consistent with this workspace having no auth/roles model yet
// (docs/decisions.md, 2026-07-30 entry).
export const revertOrderToDraft = async (
    orderUuid: string
): Promise<"not_found" | "not_in_process" | OrderStatusResult> => {
    return revertOrderToDraftByUuid(orderUuid);
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
    orderUuid: string,
    user_id: number,
    body: PayOrderBody,
    idempotencyKey: string
): Promise<"not_found" | "invalid_status" | "insufficient_tender" | "already_paid" | PaymentResult | IdempotencyDecision> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const idempotency_decision = await beginIdempotentOperation(client, user_id, orderUuid, idempotencyKey, body.mode, body.amountTendered)
        if(idempotency_decision.type !== IDEMPOTENCY_DECISION.EXECUTE){
            await client.query("COMMIT");
            return idempotency_decision
        }
        const result = await processPayment(client, orderUuid, body.mode, body.amountTendered);
        if(typeof result !== "string") {
            await markIdempotencySuccess(
                client,
                idempotency_decision.record.id,
                mapPaymentSuccessToIdempotencyResult(result)
            );
        } else {
            const failure = mapPaymentFailureToIdempotencyResult(result);

            await markIdempotencyFailure(
                client,
                idempotency_decision.record.id,
                failure
            );
        }
        await client.query("COMMIT");
        return result;
      }  catch (err) {
            await client.query("ROLLBACK");
            if (isPostgresError(err) && err.code === "23505") {
                return "already_paid";
            }
            handleDbError(err);
            throw err;
        } finally {
            client.release();
        }
};


type PaymentFailure =
    | "not_found"
    | "invalid_status"
    | "insufficient_tender";

const mapPaymentFailureToIdempotencyResult = (
    result: PaymentFailure
): IdempotencyResultUpdate => {
    switch (result) {
        case "not_found":
            return {
                http_status: 404,
                response_body: {
                    success: false,
                    error: {
                        code: "ORDER_NOT_FOUND",
                        message: "Order not found"
                    }
                }
            };

        case "invalid_status":
            return {
                http_status: 409,
                response_body: {
                    success: false,
                    error: {
                        code: "INVALID_STATUS",
                        message: "Order is not awaiting payment"
                    }
                }
            };

        case "insufficient_tender":
            return {
                http_status: 409,
                response_body: {
                    success: false,
                    error: {
                        code: "INSUFFICIENT_TENDER",
                        message: "Amount tendered is less than the order total"
                    }
                }
            };
    }
};

const mapPaymentSuccessToIdempotencyResult = (
    result: PaymentResult
): IdempotencyResultUpdate => {
    return {
        http_status: 200,
        response_body: {
            success: true,
            message: "Payment successful. Order completed.",
            data: result
        }
    };
};