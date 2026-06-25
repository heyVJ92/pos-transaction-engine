import { pool } from "../../config/database.js";
import { ProductStatus, type IProduct, type ProductCategory, type IProductPublic } from "../../db/models/product.model.js";
import type { GetProductQuery, PostProductBody } from "./product.schema.js";

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
    createdAt:  Date;
    updatedAt:  Date;
}

function rowToProduct (row: ProductRow): IProduct {
    return {
    id:         row.id,
    uuid:       row.uuid,
    name:       row.name,
    sku:        row.sku,
    category:   row.category as ProductCategory,
    costPrice:  row.cost_price,
    sellPrice:  row.sell_price,
    tax:        row.tax,
    weight:     row.weight,
    status:     row.category as ProductStatus,
    createdAt:  row.createdAt,
    updatedAt:  row.updatedAt,
    }
}

export interface QueryResult {
    data: IProduct[],
    total: number
}

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




const INSERT_PRODUCT_SQL = `
    INSERT INTO products 
        (name, sku, category, cost_price, sell_price, weight, tax, status)
    VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (sku) DO NOTHING
    RETURNING uuid
`;

export const addNewProduct = async(body: PostProductBody): Promise<boolean> => {
    console.log("body", body);
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