import type { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { IInventory } from "../../db/models/inventory.model.js";
import { MovementType, type IInventoryMovement, type IInventoryMovementPublic } from "../../db/models/inventory_movement.model.js";
import type { ProductCategory, ProductStatus } from "../../db/models/product.model.js";
import { handleDbError } from "../../utils/db-errors.js";
import type { GetInventoryQuery, InventoryMovementQueryBody, RestockBody } from "./inventory.schema.js";

interface InventoryRow {
    id:         number;
    uuid:       string;
    product_id : number;
    product_uuid : string;
    name: string,
    sku: string,
    category: ProductCategory,
    cost_price: number,
    sell_price: number,
    tax: number,
    weight: number,
    product_status: ProductStatus,
    available_stock : number;
    reserved_stock: number;
    created_at:  Date;
    updated_at:  Date;
}


const rowToInventory = (row: InventoryRow): IInventory => {
    return {
        id: row.id,
        uuid: row.uuid,
        productId: row.product_id,
        product: {
            uuid: row.product_uuid,
            name: row.name,
            sku: row.sku,
            category: row.category,
            costPrice: row.cost_price,
            sellPrice: row.sell_price,
            tax: row.tax,
            weight: row.weight,
            status: row.product_status,
        },
        availableStock: row.available_stock,
        reservedStock: row.reserved_stock,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

export interface QueryResult {
    data: IInventory[],
    total: number
}

const INVENTORY_SELECT_COLUMN = `SELECT I.id, I.uuid, I.product_id, P.uuid as product_uuid, P.name, P.sku, P.category as product_category, P.cost_price, P.sell_price, P.tax, P.weight, P.status as product_status, I.available_stock, I.reserved_stock, I.created_at, I.updated_at`;

const INVENTORY_JOIN_SQL = ` FROM inventory as I INNER JOIN products as P on P.id = I.product_id`;

const buildWhereClause = (params: GetInventoryQuery): {
    sql: string;
    values: unknown[];
    nextIndex: number;
} => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if(params.category){
        conditions.push(`P.category = $${idx++}`);
        values.push(params.category)
    }

    if (params.search !== undefined) {
        // $idx is referenced 3 times — push the value once, increment idx once
        conditions.push(
            `(P.name ILIKE $${idx} OR P.category = $${idx} OR P.sku ILIKE $${idx})`
        );
        values.push(`%${params.search}%`);
        idx++;
    }

    return {
        sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
        nextIndex: idx,
    };
}

export async function findManyInventories(params: GetInventoryQuery): Promise<QueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);

    const sortCol   = params.sort  ?? "I.created_at";
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total ${INVENTORY_JOIN_SQL} ${where}`;
    const dataSql  = `${INVENTORY_SELECT_COLUMN} ${INVENTORY_JOIN_SQL} ${where}
        ORDER BY ${sortCol} ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // Independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<InventoryRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        data: dataResult.rows.map(rowToInventory),
        total,
    };
}

const INSERT_INVENTORY_SQL = `INSERT INTO inventory (product_id, available_stock, reserved_stock) VALUES ($1, $2, $3) ON CONFLICT (product_id) DO NOTHING RETURNING UUID`

export const insertInventory = async(client: PoolClient, product_id: number, availableStock: number): Promise<boolean> => {
    const result = await client.query(INSERT_INVENTORY_SQL, [product_id, availableStock, 0])
        if((result.rowCount ?? 0) === 0){
            return false
        }

        await client.query(`INSERT INTO inventory_movement (product_id, quantity, movement_type, stock_before, stock_after)
                VALUES ($1, $2, $3, $4, $5)`,
                [product_id, availableStock, MovementType.INITIAL, 0, availableStock]
            );
        return (result.rowCount ?? 0) > 0;
}

const RESTOCK_INVENTORY_SQL = `UPDATE inventory SET available_stock = available_stock + $2, updated_at = NOW() where product_id = $1`

export const restockInventoryStock = async(productId: number, reqBody: RestockBody): Promise<boolean> => {
    const {quantity, unitCost} = reqBody;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        // 1. get current stock BEFORE update
        const inventory = await client.query(
            'SELECT available_stock FROM inventory WHERE product_id = $1 FOR UPDATE',
            [productId]
        );
        const stockBefore = Number(inventory.rows[0]?.available_stock ?? 0);

        // 2. update stock
        await client.query(RESTOCK_INVENTORY_SQL, [productId, quantity]);

        // 3. insert movement WITH before/after
        await client.query(
            `INSERT INTO inventory_movement 
            (product_id, quantity, movement_type, stock_before, stock_after, unit_cost)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [productId, quantity, MovementType.RESTOCK, stockBefore, stockBefore + quantity, unitCost]
        );
        await client.query("COMMIT")
        return true;
    } catch (err) {
        await client.query("ROLLBACK")
        handleDbError(err);
        throw err;
    } finally {
        client.release();
    }
}

const createInventoryMovementSql = (productId: number, params: InventoryMovementQueryBody): {
    where: string;
    values: unknown[];
    nextIndex: number
} => {
  let idx = 1;
  let conditions: string[] = [`P.id = $${idx++}`];
  let values: unknown[] = [productId];
  
  if(params.movementType){
    conditions.push(`IM.movement_type = $${idx++}`);
    values.push(params.movementType);
  }
  if(params.startDate){
    conditions.push(`IM.created_at >= $${idx++}`);
    values.push(params.startDate);
  }
  if(params.endDate){
    conditions.push(`IM.created_at <= $${idx++}`);
    values.push(params.endDate);
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
    nextIndex: idx
  }
}


// Inventory Movement 
interface InventoryMovementRow {
    id:         number;
    uuid:       string;
    product_id : number;
    product_uuid : string;
    order_id: number | null;
    order_uuid: string | null;
    order_number: string | null;
    quantity : number;
    stock_before: number;
    stock_after: number;
    unit_cost: number | null;
    movement_type: MovementType;
    created_at:  Date;
}


const rowToInventoryMovement = (row: InventoryMovementRow): IInventoryMovement => {
    return {
        id: row.id,
        uuid: row.uuid,
        productId: row.product_id,
        productUuid: row.product_uuid,
        orderId: row.order_id,
        orderUuid: row.order_uuid,
        orderNumber: row.order_number,
        quantity: Number(row.quantity),
        stockBefore: Number(row.stock_before),
        stockAfter: Number(row.stock_after),
        unitCost: row.unit_cost !== null ? Number(row.unit_cost) : null,
        movementType: row.movement_type,
        createdAt: row.created_at,
    }
}

let MOVEMENT_SELECT_COLUMN = `SELECT IM.product_id, IM.quantity, IM.stock_before, IM.stock_after, IM.movement_type, IM.created_at, P.id as product_id, P.uuid as product_uuid, O.id as order_id, O.uuid as order_uuid, O.order_number as order_number `

let MOVEMENT_JOIN = `FROM inventory_movement IM INNER JOIN products P on P.id = IM.product_id LEFT JOIN orders O on O.id = IM.order_id`

export interface MovementQueryResult {
    data: IInventoryMovement[],
    total: number
}

export const getAllInventoryMovementByProductId = async(productId: number, params: InventoryMovementQueryBody): Promise<MovementQueryResult> => {
    const {where, values, nextIndex} = createInventoryMovementSql(productId, params)
    
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;
    
    console.log("where", `${MOVEMENT_SELECT_COLUMN} ${MOVEMENT_JOIN} ${where} 
        ORDER BY IM.created_at ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `);

    console.log("values", values);
    const countSql = `SELECT COUNT(*) AS total ${MOVEMENT_JOIN} ${where}`;
    const dataSql  = `${MOVEMENT_SELECT_COLUMN} ${MOVEMENT_JOIN} ${where} 
        ORDER BY IM.created_at ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // Independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<InventoryMovementRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        data: dataResult.rows.map(rowToInventoryMovement),
        total,
    };
}