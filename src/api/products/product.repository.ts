import { pool } from "../../config/database.js";
import { ProductStatus, type IProduct, type ProductCategory } from "../../db/models/product.model.js";
import { handleDbError } from "../../utils/db-errors.js";
import type { GetProductQuery, PostProductBody, UpdateProductBody } from "./product.schema.js";

interface ProductRow {
    id:         number;
    uuid:       string;
    name:       string;
    sku:        string;
    category:   string;
    cost_price: number;
    sell_price: number;
    tax:        number;
    weight:     number;
    status:     string;
    created_at:  Date;
    updated_at:  Date;
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
    tax:        Number(row.tax),
    weight:     Number(row.weight),
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
        conditions.push(`category = $${idx++}`);
        values.push(params.category);
    }

    if (params.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        values.push(params.status);
    }

    if (params.search !== undefined) {
        // $idx is referenced 3 times — push the value once, increment idx once
        conditions.push(
            `(name ILIKE $${idx} OR category ILIKE $${idx} OR sku ILIKE $${idx})`
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

export async function findManyProducts(params: GetProductQuery): Promise<QueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);

    const sortCol   = params.sort  ?? "created_at";
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total FROM products ${where}`;
    const dataSql  = `
        SELECT id, uuid, name, sku, category, cost_price, sell_price, tax, weight, status, created_at, updated_at
        FROM products
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
const INSERT_PRODUCT_SQL = `
    INSERT INTO products 
        (name, sku, category, cost_price, sell_price, weight, tax, status)
    VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (sku) DO NOTHING
    RETURNING uuid
`;

export const addNewProduct = async(body: PostProductBody): Promise<boolean> => {
    const result = await pool.query(INSERT_PRODUCT_SQL, [
        body.name,
        body.sku,
        body.category,
        body.costPrice,
        body.sellPrice,
        body.weight,
        body.tax,
        ProductStatus.ACTIVE
    ])
    return (result.rowCount ?? 0) > 0
}

// Detail Method from here
export const findSingleProduct = async(uuid: string): Promise<IProduct | null> => {
    const { rows } = await pool.query('SELECT * FROM products where uuid = $1', [uuid]);
    return rows.length > 0 ?  rowToProduct(rows[0]!) : null
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

export const updateProduct = async(uuid: string, body: UpdateProductBody): Promise<void> => {
    const {sql, values} = buildUpdateSql(body);
    try {
        await pool.query(`UPDATE products SET ${sql} where uuid = $${values.length+1} and status = $${values.length+2} RETURNING uuid`, [...values, uuid, ProductStatus.ACTIVE]);
    } catch (err) {
        handleDbError(err); // converts PG errors to DatabaseError
    }
}