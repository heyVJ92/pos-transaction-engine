import { pool } from "../../config/database.js";
import { OrderStatus, type IOrderDetail, type IOrderList } from "../../db/models/order.model.js"
import type { IProductDetail } from "../../db/models/product.model.js";
import { handleDbError } from "../../utils/db-errors.js";
import type { getOrderListSchemaBody, ItemOrderDetailBody } from "./order.schema.js";


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

export const InsertDraftOrder = async (session_id: number, discount: number, user_id: number): Promise<CreateOrderResult> => {
    const result = await pool.query(`INSERT INTO orders (counter_session_id, discount, user_id, status) VALUES ($1, $2, $3, $4) RETURNING *`, [session_id, discount, user_id, OrderStatus.DRAFT])

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
                 soft_reserved = soft_reserved + $1,
                 updated_at = NOW()
             WHERE product_id = $2`,
            [itemBody.quantity, product.id]
        );

        // insert order item
        const result = await client.query<ItemAddRow>(
            `INSERT INTO order_items 
             (order_id, product_id, quantity, sell_price, cost_price, tax)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING uuid, quantity, sell_price, cost_price`,
            [order_id, product.id, itemBody.quantity, 
             product.sellPrice, product.costPrice, product.tax]
        );

        // recalculate order totals
        const orderDetails = await client.query(
            `UPDATE orders SET
                sub_total = (
                    SELECT COALESCE(SUM(quantity * sell_price), 0) 
                    FROM order_items WHERE order_id = $1
                ),
                tax = (
                    SELECT COALESCE(SUM(quantity * (sell_price * tax / 100)), 0) 
                    FROM order_items WHERE order_id = $1
                ),
                total =  sub_total - (sub_total * discount / 100) + tax,
                updated_at = NOW()
             WHERE id = $1 RETURNING uuid as order_uuid, sub_total, tax, total as order_total`,
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
                 soft_reserved = soft_reserved - $1,
                 updated_at = NOW()
             WHERE product_id = $2`,
            [item.quantity, item.product_id]
        );

        // remove order item
        await client.query(`DELETE FROM order_items WHERE uuid = $1`, [item_uuid]);

        // recalculate order totals
        const orderDetails = await client.query(
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

        await client.query("COMMIT");
        const orderRow = orderDetails.rows[0];
        return {
            uuid: item.uuid,
            productName: item.product_name,
            sku: item.sku,
            quantity: item.quantity,
            orderUuid: orderRow.order_uuid,
            subTotal: Number(orderRow.sub_total),
            tax: Number(orderRow.tax),
            orderTotal: Number(orderRow.order_total)
        };

    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
};