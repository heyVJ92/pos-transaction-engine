import { pool } from "../../config/database.js";
import { MovementType } from "../../db/models/inventory_movement.model.js";
import { ProductStatus, type IProduct, type IProductDetail, type ProductCategory } from "../../db/models/product.model.js";
import { handleDbError } from "../../utils/db-errors.js";
import { insertInventory } from "../inventory/inventory.repository.js";
import type { GetProductQuery, PostProductBody, UpdateProductBody } from "./product.schema.js";

interface ProductRow {
    id:         number;
    uuid:       string;
    name:       string;
    sku:        string;
    category:   string;
    cost_price: number;
    sell_price: number;
    available_stock: number;
    reserved_stock: number;
    min_qty: number,
    max_qty: number | null,
    tax: number,
    status:     string;
    created_at:  Date;
    updated_at:  Date;
}

interface ProductDetailRow extends ProductRow {
    weight: number
}

function rowToProductDetail (row: ProductDetailRow): IProductDetail {
    return {
    id:         row.id,
    uuid:       row.uuid,
    name:       row.name,
    sku:        row.sku,
    category:   row.category as ProductCategory,
    costPrice:  Number(row.cost_price),
    sellPrice:  Number(row.sell_price),
    tax:        Number(row.tax),
    weight:     Number(row.weight),
    availableStock: Number(row.available_stock),
    reservedStock: Number(row.reserved_stock),
    minQty:     Number(row.min_qty),
    maxQty:     row.max_qty !== null ? Number(row.max_qty) : null,
    status:     row.status as ProductStatus,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
    }
}


function rowToProduct (row: ProductRow): IProduct {
    return {
    id:         row.id,
    uuid:       row.uuid,
    name:       row.name,
    sku:        row.sku,
    category:   row.category as ProductCategory,
    costPrice:  Number(row.cost_price),
    sellPrice:  Number(row.sell_price),
    availableStock: Number(row.available_stock),
    reservedStock: Number(row.reserved_stock),
    tax:        Number(row.tax),
    minQty:     Number(row.min_qty),
    maxQty:     row.max_qty !== null ? Number(row.max_qty) : null,
    status:     row.status as ProductStatus,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
    }
}

export interface QueryResult {
    data: IProduct[],
    total: number
}


// Find All Method from here
function buildWhereClause(params: GetProductQuery): {
    sql: string;
    values: unknown[];
    nextIndex: number;
} {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.category !== undefined) {
        conditions.push(`P.category = $${idx++}`);
        values.push(params.category);
    }
    if (params.lowStock) {
            conditions.push(`I.available_stock <= P.min_qty`);
        }
    if (params.status !== undefined) {
        conditions.push(`P.status = $${idx++}`);
        values.push(params.status);
    }

    if (params.search !== undefined) {
        conditions.push(
            `(P.name ILIKE $${idx} OR P.sku ILIKE $${idx})`
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

const sortMap: Record<string, string> = {
    "available_stock": "I.available_stock",
    "name":            "P.name",
    "sell_price":      "P.sell_price",
    "category":        "P.category",
    "created_at":      "P.created_at",
};

const PRODUCT_INVENTORY_SQL = `FROM products P LEFT JOIN inventory I ON I.product_id = P.id`
export async function findManyProducts(params: GetProductQuery): Promise<QueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);
    
    const sortCol = params.sort ? (sortMap[params.sort] ?? "P.created_at") : "P.created_at";
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total ${PRODUCT_INVENTORY_SQL} ${where}`;
    const dataSql  = `
        SELECT P.id, P.uuid, P.name, P.sku, P.category, P.cost_price, P.tax, P.sell_price, P.min_qty, P.max_qty, P.status, P.created_at, P.updated_at, I.available_stock, I.reserved_stock
        ${PRODUCT_INVENTORY_SQL}
        ${where}
        ORDER BY ${sortCol} ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // Independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<ProductRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        data: dataResult.rows.map(rowToProduct),
        total,
    };
}



// Insert Method from here
const INSERT_PRODUCT_INVENTORY_SQL = `
    INSERT INTO products 
        (name, sku, category, cost_price, sell_price, weight, tax, min_qty, max_qty, status)
    VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (sku) DO NOTHING
    RETURNING id
`;

export const addNewProduct = async(body: PostProductBody): Promise<boolean> => {
    const client = await pool.connect();
    const {availableStock, ...productReqBody } = body; 
    try {
        await client.query("BEGIN");
        const result = await client.query(INSERT_PRODUCT_INVENTORY_SQL, [
            productReqBody.name,
            productReqBody.sku,
            productReqBody.category,
            productReqBody.costPrice,
            productReqBody.sellPrice,
            productReqBody.weight,
            productReqBody.tax,
            productReqBody.minQty,
            productReqBody.maxQty ??  null,
            ProductStatus.ACTIVE
        ])
        if((result.rowCount ?? 0) === 0) {
            await client.query("ROLLBACK");
            return false
        };
        const product_id = result.rows[0].id
        const createInventory = await insertInventory(client, product_id, availableStock);
        if(!createInventory) {
            await client.query("ROLLBACK");
            return false;
        }
        await client.query("COMMIT");
        return true
    } catch (err) {
        await client.query("ROLLBACK");
        handleDbError(err)
        throw err        
    } finally {
        client.release();
    }
}

// Detail Method from here
export const findSingleProduct = async(uuid: string): Promise<IProductDetail | null> => {
    console.log(`SELECT P.id, P.uuid, P.name, P.sku, P.category, P.cost_price, P.sell_price, P.tax, P.weight, P.min_qty, P.max_qty, P.status, P.created_at, P.updated_at, I.available_stock, I.reserved_stock ${PRODUCT_INVENTORY_SQL} where P.uuid = $1`);
    const { rows } = await pool.query(`SELECT P.id, P.uuid, P.name, P.sku, P.category, P.cost_price, P.sell_price, P.tax, P.weight, P.min_qty, P.max_qty, P.status, P.created_at, P.updated_at, I.available_stock, I.reserved_stock ${PRODUCT_INVENTORY_SQL} where P.uuid = $1`, [uuid]);
    return rows.length > 0 ?  rowToProductDetail(rows[0]!) : null
}

// Delete Method from here
export const setProductInactive = async (uuid: string): Promise<void> => {
    await pool.query(
        `UPDATE products SET status = $1, updated_at = NOW() WHERE uuid = $2`,
        [ProductStatus.INACTIVE, uuid]
    );
};


// Update Method from here
const columnMap: Record<string, string> = {
    name:      "name",
    sku:       "sku",
    category:  "category",
    costPrice: "cost_price",
    sellPrice: "sell_price",
    tax:       "tax",
    weight:    "weight",
    minQty: "min_qty",
    maxQty: "max_qty",
};

const buildUpdateSql = (body: UpdateProductBody): { sql: string; values: unknown[] } => {
    const clauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
        const column = columnMap[key];
        if (!column) continue; // skip unknown fields
        clauses.push(`${column} = $${idx}`);
        values.push(value);
        idx++;
    }

    // always update updated_at
    clauses.push(`updated_at = NOW()`);

    return {
        sql: clauses.join(", "),
        values,
    };
};

export const updateProduct = async(uuid: string, reqBody: UpdateProductBody): Promise<void> => {
    const {sql, values} = buildUpdateSql(reqBody);
    try {
        const result = await pool.query(`UPDATE products SET ${sql} where uuid = $${values.length+1} and status = $${values.length+2} RETURNING uuid`, [...values, uuid, ProductStatus.ACTIVE]);
    } catch (err) {
        handleDbError(err); // converts PG errors to DatabaseError
        throw err;
    }
}