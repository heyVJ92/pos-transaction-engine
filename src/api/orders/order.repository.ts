import { pool } from "../../config/database.js";
import type { PoolClient } from "pg";
import { OrderStatus, type IOrderDetail, type IOrderList } from "../../db/models/order.model.js"
import type { IProductDetail } from "../../db/models/product.model.js";
import { handleDbError, isPostgresError } from "../../utils/db-errors.js";
import type { getOrderListSchemaBody, ItemOrderDetailBody, PaymentMode } from "./order.schema.js";

interface OrderTotalsRow {
    order_uuid: string;
    sub_total: string;
    tax: string;
    order_total: string;
}

interface OrderTotals {
    orderUuid: string;
    subTotal: number;
    tax: number;
    orderTotal: number;
}

// shared by every item-level mutation that must recompute order totals inside the same
// transaction as the mutation itself (add/remove/edit all called this identical block before)
const recalculateOrderTotals = async (client: PoolClient, order_id: number): Promise<OrderTotals> => {
    const { rows } = await client.query<OrderTotalsRow>(
        `UPDATE orders SET
            sub_total = (
                SELECT COALESCE(SUM(quantity * sell_price), 0)
                FROM order_items WHERE order_id = $1
            ),
            tax = (
                SELECT COALESCE(SUM(quantity * (sell_price * tax / 100)), 0)
                FROM order_items WHERE order_id = $1
            ),
            total = sub_total - (sub_total * discount / 100) + tax,
            updated_at = NOW()
         WHERE id = $1 RETURNING uuid as order_uuid, sub_total, tax, total as order_total`,
        [order_id]
    );
    const row = rows[0]!;
    return {
        orderUuid: row.order_uuid,
        subTotal: Number(row.sub_total),
        tax: Number(row.tax),
        orderTotal: Number(row.order_total)
    };
};


interface OrderRow {
    id: number,
    uuid: string,
    order_number: string,
    user_id: number,
    user_uuid: string,
    first_name: string,
    last_name: string,
    counter_id: number,
    counter_uuid: string,
    counter_name: string,
    counter_code: string,
    discount: number,
    tax: number,
    sub_total: number,
    total: number,
    status: OrderStatus,
    created_at: Date,
    updated_at: Date,
}

const rowToOrderList = (row: OrderRow): IOrderList => {
    return {
    id: row.id,
    uuid: row.uuid,
    cashier: {
        uuid: row.user_uuid,
        firstName: row.first_name,
        lastName: row.last_name,
    },
    counter: {
        uuid: row.counter_uuid,
        name: row.counter_name,
        code: row.counter_code,
    },
    orderNumber: row.order_number,
    discount: Number(row.discount),
    subTotal: Number(row.sub_total),
    tax: Number(row.tax),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
    }
}

export type CreateOrderResult = {
    uuid: string,
    orderNumber: string,
    status: OrderStatus
}

export const InsertDraftOrder = async (session_id: number, user_id: number): Promise<CreateOrderResult> => {
    const result = await pool.query(`INSERT INTO orders (counter_session_id, user_id, status) VALUES ($1, $2, $3) RETURNING *`, [session_id, user_id, OrderStatus.DRAFT])

    const {uuid, order_number, status} = result.rows[0]
    return {
        uuid,
        orderNumber: order_number,
        status
    }
}

// findAllOrders
const createWhereClause = (params: getOrderListSchemaBody): {
    where: string,
    values: unknown[],
    nextIndex: number
} => {
    let conditions = [];
    let values = [];
    let idx = 1;
    if(params.counterCode){
        conditions.push(`C.code ILIKE $${idx++}`)
        values.push(`%${params.counterCode}%`)
    }
    if(params.counterName){
        conditions.push(`C.name ILIKE $${idx++}`)
        values.push(`%${params.counterName}%`)
    }
    if(params.orderNumber){
        conditions.push(`O.order_number ILIKE $${idx++}`)
        values.push(`%${params.orderNumber}%`)
    }
    if(params.userName){
        conditions.push(`CONCAT(U.first_name, ' ', U.last_name) ILIKE $${idx++}`);
        values.push(`%${params.userName}%`);
    }
    if(params.search){
        conditions.push(`(CONCAT(U.first_name, ' ', U.last_name) ILIKE $${idx} OR O.order_number ILIKE $${idx} OR C.code ILIKE $${idx} OR C.name ILIKE $${idx})`)
        values.push(`%${params.search}%`);
        idx++
    }
    return {
        where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : " ",
        values,
        nextIndex: idx
    }

}

const SELECT_ORDERS_SQL = `SELECT O.id, O.uuid, O.order_number, O.discount, O.tax, O.sub_total, O.total, O.status, O.created_at, O.updated_at, U.id as user_id, U.uuid as user_uuid, U.first_name, U.last_name, C.id as counter_id, C.uuid as counter_uuid, C.name as counter_name, C.code as counter_code`;
const JOIN_ORDERS_SQL = `from orders O LEFT JOIN users U on U.id = O.user_id INNER JOIN counter_sessions CS on CS.id = O.counter_session_id INNER JOIN counters C on C.id = CS.counter_id`;

interface listQueryResult {
    data: IOrderList[],
    total: number
}

export const findAllOrders = async (params: getOrderListSchemaBody): Promise<listQueryResult> => {
    const {where, values, nextIndex} = createWhereClause(params);
    const sort = params.sort ?? "O.updated_at";
    const sortOrder = params.order ?? "desc";
    const offset = (params.page - 1) * params.limit
    
    const [countResult, result] = await Promise.all([
        pool.query<{total: string}>(`SELECT COUNT(O.id) as total ${JOIN_ORDERS_SQL} ${where}`, values),
        pool.query<OrderRow>(`${SELECT_ORDERS_SQL} ${JOIN_ORDERS_SQL} ${where}
           ORDER BY ${sort} ${sortOrder.toUpperCase()} LIMIT $${nextIndex} OFFSET $${nextIndex + 1}   `, [...values, params.limit, offset])
    ]);
    return {
        data: result.rows.map((orderRow) => rowToOrderList(orderRow)),
        total: Number(countResult.rows[0]?.total ?? 0)
    }
}


export const findSingleOrder = async(uuid: string): Promise<{id: number, status: OrderStatus} | null> => {
    const { rows } = await pool.query(`SELECT O.id, O.status from orders O where O.uuid = $1`, [uuid]);
    return rows.length > 0 ?  rows[0] : null
}

export interface OrderStatusResult {
    uuid: string;
    status: OrderStatus;
}

export const updateOrderStatus = async (order_id: number, status: OrderStatus): Promise<OrderStatusResult> => {
    const { rows } = await pool.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING uuid, status`,
        [status, order_id]
    );
    return rows[0]
}


interface ItemAddRow {
    uuid: string,
    quantity: number,
    sell_price: number,
    cost_price: number,
    total: number,
    tax: number,
    sub_total: number,
    order_total: number,
    order_uuid: string
};

interface ItemAddPublic {
    uuid: string,
    productName: string,
    sku: string,
    quantity: number,
    sellPrice: number,
    costPrice: number,
    total: number,
    tax: number,
    subTotal: number,
    orderTotal: number,
    orderUuid: string
};

const itemAddResult = (addItemRow: ItemAddRow, product_name: string, sku: string ): ItemAddPublic => {
   return {
    uuid: addItemRow.uuid,
    productName: product_name,
    sku,
    quantity: addItemRow.quantity,
    sellPrice: Number(addItemRow.sell_price),
    costPrice: Number(addItemRow.cost_price),
    orderUuid: addItemRow.order_uuid,
    total: Number(addItemRow.total),
    tax: Number(addItemRow.tax),
    subTotal: Number(addItemRow.sub_total),
    orderTotal: Number(addItemRow.order_total)
   }
}

export const addItemTransaction = async (
    order_id: number,
    product: IProductDetail,
    itemBody: ItemOrderDetailBody
): Promise<ItemAddPublic | null> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // lock inventory row
        const inventory = await client.query(
            `SELECT available_stock FROM inventory 
             WHERE product_id = $1 FOR UPDATE`,
            [product.id]
        );

        const available = Number(inventory.rows[0]?.available_stock ?? 0);
        if (available < itemBody.quantity) {
            await client.query("ROLLBACK");
            return null;
        }

        // update inventory
        await client.query(
            `UPDATE inventory 
             SET available_stock = available_stock - $1,
                 reserved_stock = reserved_stock + $1,
                 updated_at = NOW()
             WHERE product_id = $2`,
            [itemBody.quantity, product.id]
        );

        console.log(`object`, order_id, product.id, itemBody.quantity, 
            product.sellPrice, product.costPrice, product.tax);
        // insert order item
        const result = await client.query<ItemAddRow>(
            `INSERT INTO order_items 
            (order_id, product_id, quantity, sell_price, cost_price, tax)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (order_id, product_id) 
            DO UPDATE SET quantity = order_items.quantity + EXCLUDED.quantity
            RETURNING uuid, quantity, sell_price, cost_price`,
            [order_id, product.id, itemBody.quantity, 
             product.sellPrice, product.costPrice, product.tax]
        );
        console.log("result",result);
        // recalculate order totals
        const orderDetails = await client.query(
            `WITH totals AS (
            SELECT
                COALESCE(SUM(quantity * sell_price), 0) AS sub_total,
                COALESCE(SUM(quantity * (sell_price * tax / 100)), 0) AS tax
            FROM order_items WHERE order_id = $1
            )
            UPDATE orders SET
            sub_total = totals.sub_total,
            tax = totals.tax,
            total = totals.sub_total - (totals.sub_total * orders.discount / 100) + totals.tax,
            updated_at = NOW()
            FROM totals
            WHERE orders.id = $1
            RETURNING uuid AS order_uuid, orders.sub_total, orders.tax, orders.total AS order_total`,
            [order_id]
        );

        await client.query("COMMIT");
        const orderRow = orderDetails.rows[0];
        const row = result.rows[0];
        if (!row) return null;
        return itemAddResult({...row,...orderRow}, product.name, product.sku);

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};

export interface EditItemInsufficientStock {
    productName: string;
    sku: string;
    requested: number;
    available: number;
}

export interface ItemEditPublic {
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

export type EditItemTransactionResult =
    | { outcome: "not_found" }
    | { outcome: "insufficient_stock"; data: EditItemInsufficientStock }
    | { outcome: "removed"; data: ItemRemovePublic }
    | { outcome: "success"; data: ItemEditPublic };

export const editItemTransaction = async (
    order_id: number,
    item_uuid: string,
    newQuantity: number
): Promise<EditItemTransactionResult> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // lock the order item row first (same lock order as removeItemTransaction),
        // read its current quantity under lock — the client's view of "current qty" is
        // never trusted, the delta is always computed from this locked read
        const itemResult = await client.query<{
            uuid: string;
            product_id: number;
            quantity: number;
            sell_price: string;
            cost_price: string;
            product_name: string;
            sku: string;
        }>(
            `SELECT OI.uuid, OI.product_id, OI.quantity, OI.sell_price, OI.cost_price, P.name as product_name, P.sku
             FROM order_items OI
             INNER JOIN products P ON P.id = OI.product_id
             WHERE OI.uuid = $1 AND OI.order_id = $2
             FOR UPDATE`,
            [item_uuid, order_id]
        );

        const item = itemResult.rows[0];
        if (!item) {
            await client.query("ROLLBACK");
            return { outcome: "not_found" };
        }

        // 0 means "remove this line" — order_items.quantity has CHECK (quantity > 0),
        // so this must be a DELETE, not an UPDATE ... SET quantity = 0
        if (newQuantity === 0) {
            await client.query(
                `UPDATE inventory SET
                    available_stock = available_stock + $1,
                    reserved_stock = reserved_stock - $1,
                    updated_at = NOW()
                 WHERE product_id = $2`,
                [item.quantity, item.product_id]
            );
            await client.query(`DELETE FROM order_items WHERE uuid = $1`, [item_uuid]);

            const totals = await recalculateOrderTotals(client, order_id);
            await client.query("COMMIT");
            return {
                outcome: "removed",
                data: {
                    uuid: item.uuid,
                    productName: item.product_name,
                    sku: item.sku,
                    quantity: 0,
                    orderUuid: totals.orderUuid,
                    subTotal: totals.subTotal,
                    tax: totals.tax,
                    orderTotal: totals.orderTotal
                }
            };
        }

        const delta = newQuantity - item.quantity;

        if (delta !== 0) {
            const inventory = await client.query<{ available_stock: string }>(
                `SELECT available_stock FROM inventory WHERE product_id = $1 FOR UPDATE`,
                [item.product_id]
            );
            const available = Number(inventory.rows[0]?.available_stock ?? 0);

            if (delta > 0 && available < delta) {
                await client.query("ROLLBACK");
                return {
                    outcome: "insufficient_stock",
                    data: {
                        productName: item.product_name,
                        sku: item.sku,
                        requested: newQuantity,
                        // this line's current qty is already reserved against this order —
                        // the real ceiling for "requested" is what's free plus what's already held
                        available: available + item.quantity
                    }
                };
            }

            // one statement handles both directions — a negative delta flips the arithmetic:
            // available_stock - (-3) = +3 back to available, reserved_stock + (-3) = -3 off reserved
            await client.query(
                `UPDATE inventory SET
                    available_stock = available_stock - $1,
                    reserved_stock = reserved_stock + $1,
                    updated_at = NOW()
                 WHERE product_id = $2`,
                [delta, item.product_id]
            );
        }

        await client.query(
            `UPDATE order_items SET quantity = $1 WHERE uuid = $2`,
            [newQuantity, item_uuid]
        );

        const totals = await recalculateOrderTotals(client, order_id);
        await client.query("COMMIT");
        return {
            outcome: "success",
            data: {
                uuid: item.uuid,
                productName: item.product_name,
                sku: item.sku,
                quantity: newQuantity,
                sellPrice: Number(item.sell_price),
                costPrice: Number(item.cost_price),
                orderUuid: totals.orderUuid,
                subTotal: totals.subTotal,
                tax: totals.tax,
                orderTotal: totals.orderTotal
            }
        };

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};

interface RemoveItemRow {
    uuid: string,
    product_id: number,
    quantity: number,
    product_name: string,
    sku: string
}

export interface ItemRemovePublic {
    uuid: string,
    productName: string,
    sku: string,
    quantity: number,
    orderUuid: string,
    subTotal: number,
    tax: number,
    orderTotal: number
}

export const removeItemTransaction = async (
    order_id: number,
    item_uuid: string
): Promise<ItemRemovePublic | null> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // lock the order item row (and implicitly serialize against concurrent addItemTransaction on the same order)
        const itemResult = await client.query<RemoveItemRow>(
            `SELECT OI.uuid, OI.product_id, OI.quantity, P.name as product_name, P.sku
             FROM order_items OI
             INNER JOIN products P ON P.id = OI.product_id
             WHERE OI.uuid = $1 AND OI.order_id = $2
             FOR UPDATE`,
            [item_uuid, order_id]
        );

        const item = itemResult.rows[0];
        if (!item) {
            await client.query("ROLLBACK");
            return null;
        }

        // restore inventory
        await client.query(
            `UPDATE inventory
             SET available_stock = available_stock + $1,
                 reserved_stock = reserved_stock - $1,
                 updated_at = NOW()
             WHERE product_id = $2`,
            [item.quantity, item.product_id]
        );

        // remove order item
        await client.query(`DELETE FROM order_items WHERE uuid = $1`, [item_uuid]);

        const totals = await recalculateOrderTotals(client, order_id);
        await client.query("COMMIT");
        return {
            uuid: item.uuid,
            productName: item.product_name,
            sku: item.sku,
            quantity: item.quantity,
            orderUuid: totals.orderUuid,
            subTotal: totals.subTotal,
            tax: totals.tax,
            orderTotal: totals.orderTotal
        };

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};

// ─── Row type ────────────────────────────────────────────────────────────────
// Order detial = all the common data for order
interface OrderDetailRow {
    // order fields (same on every row)
    id:                  number;
    uuid:                string;
    order_number:        string;
    status:              string;
    discount:            string;
    sub_total:           string;
    tax:                 string;
    total:               string;
    created_at:          Date;
    updated_at:          Date;
    
    // cashier fields (same on every row)
    cashier_uuid:        string;
    cashier_first_name:  string;
    cashier_last_name:   string;
    
    // counter fields (same on every row)
    counter_uuid:        string;
    counter_name:        string;
    counter_code:        string;
}

// Item row = item related data where separate for each item
interface ItemRow {
    // item fields (different on each row — one per item)
    item_uuid:           string | null;  // null if order has no items
    item_quantity:       number | null;
    item_sell_price:     string | null;
    item_cost_price:     string | null;
    item_tax:            string | null;

    // product fields per item (different on each row)
    product_uuid:        string | null;
    product_name:        string | null;
    product_sku:         string | null;
}


// ─── Row mapper ──────────────────────────────────────────────────────────────
// Multiple rows → single IOrderDetail object
// This is the key pattern: collapse repeated order data, build items array
const rowsToOrderDetail = (orderDetail: OrderDetailRow, itemRows: ItemRow[]): IOrderDetail => {
    return {
        id:          orderDetail.id,
        uuid:        orderDetail.uuid,
        orderNumber: orderDetail.order_number,
        status:      orderDetail.status as OrderStatus,
        discount:    Number(orderDetail.discount),
        subTotal:    Number(orderDetail.sub_total),
        tax:         Number(orderDetail.tax),
        total:       Number(orderDetail.total),
        createdAt:   orderDetail.created_at,
        updatedAt:   orderDetail.updated_at,

        cashier: {
            uuid:      orderDetail.cashier_uuid,
            firstName: orderDetail.cashier_first_name,
            lastName:  orderDetail.cashier_last_name,
        },

        counter: {
            uuid: orderDetail.counter_uuid,
            name: orderDetail.counter_name,
            code: orderDetail.counter_code,
        },

        // map each row to one item
        // filter out null item_uuid — handles empty orders (no items yet)
        items: itemRows
            .filter(r => r.item_uuid !== null)
            .map(r => ({
                uuid:      r.item_uuid!,
                quantity:  r.item_quantity!,
                sellPrice: Number(r.item_sell_price),
                costPrice: Number(r.item_cost_price),
                tax:       Number(r.item_tax),
                total:     r.item_quantity! * Number(r.item_sell_price),
                product: {
                    uuid: r.product_uuid!,
                    name: r.product_name!,
                    sku:  r.product_sku!,
                }
            }))
    };
};

// ─── SQL ─────────────────────────────────────────────────────────────────────
// LEFT JOIN order_items — keeps order even if no items yet (DRAFT with nothing scanned)
// INNER JOIN products — only needed when item exists (safe because LEFT JOIN)
const FIND_ORDER_DETAIL_SQL = `
    SELECT
        -- order
        O.id,
        O.uuid,
        O.order_number,
        O.status,
        O.discount,
        O.sub_total,
        O.tax,
        O.total,
        O.created_at,
        O.updated_at,

        -- cashier
        U.uuid        AS cashier_uuid,
        U.first_name  AS cashier_first_name,
        U.last_name   AS cashier_last_name,

        -- counter
        C.uuid        AS counter_uuid,
        C.name        AS counter_name,
        C.code        AS counter_code

    FROM orders O
    INNER JOIN users U
        ON U.id = O.user_id
    INNER JOIN counter_sessions CS
        ON CS.id = O.counter_session_id
    INNER JOIN counters C
        ON C.id = CS.counter_id
    WHERE O.uuid = $1
`;

const FIND_ITEMS_SQL = `
    SELECT
        -- item (nullable — LEFT JOIN)
        OI.uuid       AS item_uuid,
        OI.quantity   AS item_quantity,
        OI.sell_price AS item_sell_price,
        OI.cost_price AS item_cost_price,
        OI.tax        AS item_tax,

        -- product per item (nullable — LEFT JOIN)
        P.uuid        AS product_uuid,
        P.name        AS product_name,
        P.sku         AS product_sku

    FROM order_items OI
    INNER JOIN orders O
        ON OI.order_id = O.id
    LEFT JOIN products P
        ON P.id = OI.product_id
    WHERE O.uuid = $1
    ORDER BY OI.created_at ASC  -- items in scan order
`;

// ─── Repository function ─────────────────────────────────────────────────────
export const findOrderByUuid = async (uuid: string): Promise<IOrderDetail | null> => {
    const [orderResult, itemsResult] = await Promise.all([
        pool.query<OrderDetailRow>(
            FIND_ORDER_DETAIL_SQL,
            [uuid]
        ),
        pool.query<ItemRow>(
            FIND_ITEMS_SQL,
            [uuid]
        )
    ])
    if (orderResult.rows.length === 0) return null;

    const order = orderResult.rows[0]!;
    const items = itemsResult.rows;

    return rowsToOrderDetail(order, items)
};

export const checkoutOrderByUuid = async (
    orderUuid: string
): Promise<"not_found" | "not_draft" | "empty_order" | OrderStatusResult> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // lock + validate status inside the transaction (not a pre-check) — avoids the
        // TOCTOU gap a separate findSingleOrder-then-act sequence would have
        const orderResult = await client.query<{ id: number; uuid: string; status: OrderStatus }>(
            `SELECT id, uuid, status FROM orders WHERE uuid = $1 FOR UPDATE`,
            [orderUuid]
        );

        const order = orderResult.rows[0];
        if (!order) {
            await client.query("ROLLBACK");
            return "not_found";
        }
        if (order.status !== OrderStatus.DRAFT) {
            await client.query("ROLLBACK");
            return "not_draft";
        }

        const { rows: items } = await client.query<{ product_id: number; quantity: number }>(
            `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
            [order.id]
        );

        if (items.length === 0) {
            await client.query("ROLLBACK");
            return "empty_order";
        }

        // Integrity failsafe, not a gate: reserved_stock should always be >= what this
        // order itself committed at add-time. A mismatch means something upstream
        // corrupted the reservation — flag it and let the sale proceed anyway rather than
        // strand a paying customer over a data-integrity issue that isn't theirs
        // (docs/order-payment-redesign-review.md §2). Read-only, so no row locks needed —
        // one batched query instead of locking per item.
        // TODO: once the audit-trail table exists, write this flag there instead of
        // console.error — right now nothing reads this log.
        const productIds = items.map(i => i.product_id);
        const { rows: inventoryRows } = await client.query<{ product_id: number; reserved_stock: string }>(
            `SELECT product_id, reserved_stock FROM inventory WHERE product_id = ANY($1::int[])`,
            [productIds]
        );
        const reservedByProduct = new Map(inventoryRows.map(r => [r.product_id, Number(r.reserved_stock)]));
        for (const item of items) {
            const reserved = reservedByProduct.get(item.product_id) ?? 0;
            if (reserved < item.quantity) {
                console.error(
                    `[checkout-integrity] order ${order.uuid} product ${item.product_id}: reserved_stock=${reserved} < committed quantity=${item.quantity}`
                );
            }
        }

        const { rows: updated } = await client.query<OrderStatusResult>(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING uuid, status`,
            [OrderStatus.INPROCESS, order.id]
        );

        await client.query("COMMIT");
        return updated[0]!;

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};

export const revertOrderToDraftByUuid = async (
    orderUuid: string
): Promise<"not_found" | "not_in_process" | OrderStatusResult> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const orderResult = await client.query<{ id: number; uuid: string; status: OrderStatus }>(
            `SELECT id, uuid, status FROM orders WHERE uuid = $1 FOR UPDATE`,
            [orderUuid]
        );

        const order = orderResult.rows[0];
        if (!order) {
            await client.query("ROLLBACK");
            return "not_found";
        }
        if (order.status !== OrderStatus.INPROCESS) {
            await client.query("ROLLBACK");
            return "not_in_process";
        }

        // pure status flip — items were reserved at add-time, not at checkout, so
        // checkout never moved any stock and reverting doesn't need to move any back
        const { rows: updated } = await client.query<OrderStatusResult>(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING uuid, status`,
            [OrderStatus.DRAFT, order.id]
        );

        await client.query("COMMIT");
        return updated[0]!;

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};

export const cancelOrderById = async (
    orderUuid: string
): Promise<"not_found" | "cannot_cancel" | "success"> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. lock order + get current status
        const orderResult = await client.query<{ id: number; status: OrderStatus }>(
            `SELECT id, status FROM orders WHERE uuid = $1 FOR UPDATE`,
            [orderUuid]
        );

        if (orderResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return "not_found";
        }

        const order = orderResult.rows[0]!;
        const cancellable = [
            OrderStatus.DRAFT,
            OrderStatus.INPROCESS,
            OrderStatus.HOLD
        ];

        if (!cancellable.includes(order.status)) {
            await client.query("ROLLBACK");
            return "cannot_cancel";
        }

        // 2. get all order items
        const { rows: items } = await client.query<{
            product_id: number;
            quantity: number;
        }>(
            `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
            [order.id]
        );

        const isDraft = order.status === OrderStatus.DRAFT;

        // 3. restore inventory — parallel per item
        if (items.length > 0) {
            await Promise.all(
                items.map(item =>
                    client.query(
                        `UPDATE inventory SET
                            available_stock = available_stock + $1,
                            ${isDraft ? 'reserved_stock' : 'reserved_stock'} = 
                            ${isDraft ? 'reserved_stock' : 'reserved_stock'} - $1,
                            updated_at = NOW()
                         WHERE product_id = $2`,
                        [item.quantity, item.product_id]
                    )
                )
            );

            // 4. movement log — only for hard reserved (not draft)
            if (!isDraft) {
                await Promise.all(
                    items.map(item =>
                        client.query(
                            `INSERT INTO inventory_movement 
                             (product_id, order_id, quantity, movement_type)
                             VALUES ($1, $2, $3, 'reverted')`,
                            [item.product_id, order.id, item.quantity]
                        )
                    )
                );
            }
        }

        // 5. update order status
        await client.query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
            [OrderStatus.CANCELLED, order.id]
        );

        await client.query("COMMIT");
        return "success";

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};


// src/api/orders/order.repository.ts

export interface PaymentResult {
    orderUuid: string;
    orderStatus: OrderStatus;
    payment: {
        uuid: string;
        mode: PaymentMode;
        amount: number;
        amountTendered: number;
        change: number;
    };
}

export const processPayment = async (
    orderUuid: string,
    mode: PaymentMode,
    amountTendered: number
): Promise<"not_found" | "invalid_status" | "insufficient_tender" | "already_paid" | PaymentResult> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. lock order + validate status — no gateway/decline modeling here (there's no
        // real payment processor behind this), so the only thing left to validate is tender
        const { rows: orderRows } = await client.query<{
            id: number;
            status: OrderStatus;
            total: string;
        }>(
            `SELECT id, status, total
             FROM orders WHERE uuid = $1 FOR UPDATE`,
            [orderUuid]
        );

        const order = orderRows[0];
        if (!order) {
            await client.query("ROLLBACK");
            return "not_found";
        }
        if (order.status !== OrderStatus.INPROCESS) {
            await client.query("ROLLBACK");
            return "invalid_status";
        }

        const total = Number(order.total);
        if (amountTendered < total) {
            await client.query("ROLLBACK");
            return "insufficient_tender";
        }
        const change = amountTendered - total;

        // 2. get all order items, sorted by product_id — the sort matters, see the lock below
        const { rows: items } = await client.query<{
            product_id: number;
            quantity: number;
            cost_price: string;
        }>(
            `SELECT product_id, quantity, cost_price
             FROM order_items WHERE order_id = $1
             ORDER BY product_id ASC`,
            [order.id]
        );

        // 3. decrement reserved_stock and log a CONFIRMED movement per line — stock is
        // permanently gone here, this is the one place inventory_movement still gets
        // written (docs/decisions.md, 2026-07-30). Locked one product at a time, in
        // ascending product_id order — this transaction touches every line's inventory
        // row at once, so a fixed lock order is required to avoid deadlocking against
        // another concurrent payment/checkout that touches an overlapping set of products.
        for (const item of items) {
            const { rows: inventoryRows } = await client.query<{
                stock_before: string;
                stock_after: string;
            }>(
                `UPDATE inventory
                 SET reserved_stock = reserved_stock - $1, updated_at = NOW()
                 WHERE product_id = $2
                 RETURNING (reserved_stock + $1) AS stock_before, reserved_stock AS stock_after`,
                [item.quantity, item.product_id]
            );
            const stock = inventoryRows[0]!;

            await client.query(
                `INSERT INTO inventory_movement
                 (product_id, order_id, quantity, stock_before, stock_after, unit_cost, movement_type)
                 VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')`,
                [item.product_id, order.id, item.quantity, stock.stock_before, stock.stock_after, item.cost_price]
            );
        }

        // 4. write the payment row — single-tender only for v1. `order_id` is UNIQUE on
        // this table, so a genuine double-insert for the same order fails cleanly here;
        // in practice a double-tap never reaches this far, since the status check above
        // already rejects a second attempt once the first commits (order is no longer
        // in_process) — this is defense in depth, not the primary guard.
        const { rows: paymentRows } = await client.query<{
            uuid: string;
            mode: PaymentMode;
            amount: string;
            amount_tendered: string;
            change: string;
        }>(
            `INSERT INTO payment (order_id, mode, amount, amount_tendered, change)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING uuid, mode, amount, amount_tendered, change`,
            [order.id, mode, total, amountTendered, change]
        );
        const payment = paymentRows[0]!;

        // 5. order → COMPLETED
        const { rows: updatedOrder } = await client.query<{ uuid: string; status: OrderStatus }>(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING uuid, status`,
            [OrderStatus.COMPLETED, order.id]
        );

        await client.query("COMMIT");
        const orderRow = updatedOrder[0]!;
        return {
            orderUuid: orderRow.uuid,
            orderStatus: orderRow.status,
            payment: {
                uuid: payment.uuid,
                mode: payment.mode,
                amount: Number(payment.amount),
                amountTendered: Number(payment.amount_tendered),
                change: Number(payment.change)
            }
        };

    } catch (err) {
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