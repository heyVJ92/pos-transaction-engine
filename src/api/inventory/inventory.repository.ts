import type { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import type { IInventory } from "../../db/models/inventory.model.js";
import { MovementType } from "../../db/models/inventory_movement.model.js";
import type { ProductCategory, ProductStatus } from "../../db/models/product.model.js";
import { handleDbError } from "../../utils/db-errors.js";
import type { GetInventoryQuery, PostInventoryBody } from "./inventory.schema.js";

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

        await client.query(`INSERT INTO inventory_movement (product_id, quantity, movement_type)
                VALUES ($1, $2, $3)`,
                [product_id, availableStock, MovementType.INITIAL]
            );
        return (result.rowCount ?? 0) > 0;
}