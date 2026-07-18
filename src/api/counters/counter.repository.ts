import { pool } from "../../config/database.js";
import { CounterStatus, type ICounter } from "../../db/models/counter.model.js";
import { handleDbError } from "../../utils/db-errors.js";
import type { GetCounterQuery, PostCounterBody, UpdateCounterBody } from "./counter.schema.js";

interface CounterRow {
    id:         number;
    uuid:       string;
    name:       string;
    code:       string;
    status:     string;
    created_at:  Date;
    updated_at:  Date;
}

function rowToCounter (row: CounterRow): ICounter {
    return {
    id:         row.id,
    uuid:       row.uuid,
    name:       row.name,
    code:       row.code,
    status:     row.status as CounterStatus,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
    }
}

export interface QueryResult {
    data: ICounter[],
    total: number
}


// Find All Method from here
function buildWhereClause(params: GetCounterQuery): {
    sql: string;
    values: unknown[];
    nextIndex: number;
} {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        values.push(params.status);
    }

    if (params.search !== undefined) {
        // $idx is referenced 2 times — push the value once, increment idx once
        conditions.push(
            `(name ILIKE $${idx} OR code ILIKE $${idx})`
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

export async function findManyCounters(params: GetCounterQuery): Promise<QueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);

    const sortCol   = params.sort  ?? "created_at";
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total FROM counters ${where}`;
    const dataSql  = `
        SELECT id, uuid, name, code, status, created_at, updated_at
        FROM counters
        ${where}
        ORDER BY ${sortCol} ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // Independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<CounterRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        data: dataResult.rows.map(rowToCounter),
        total,
    };
}



// Insert Method from here
const INSERT_COUNTER_SQL = `
    INSERT INTO counters
        (name, code, status)
    VALUES
        ($1, $2, $3)
    ON CONFLICT (code) DO NOTHING
    RETURNING uuid
`;

export const addNewCounter = async(body: PostCounterBody): Promise<boolean> => {
    const result = await pool.query(INSERT_COUNTER_SQL, [
        body.name,
        body.code,
        CounterStatus.ACTIVE
    ])
    return (result.rowCount ?? 0) > 0
}

// Detail Method from here
export const findSingleCounter = async(uuid: string): Promise<ICounter | null> => {
    const { rows } = await pool.query('SELECT * FROM counters where uuid = $1', [uuid]);
    return rows.length > 0 ?  rowToCounter(rows[0]!) : null
}

// Delete Method from here
export const setCounterInactive = async (uuid: string): Promise<boolean> => {
    const result = await pool.query(
        `UPDATE counters SET status = $1, updated_at = NOW() WHERE uuid = $2`,
        [CounterStatus.INACTIVE, uuid]
    );
    return (result.rowCount ?? 0) > 0;
};


// Update Method from here
const columnMap: Record<string, string> = {
    name: "name",
    code: "code",
    status: "status",
};

const buildUpdateSql = (body: UpdateCounterBody): { sql: string; values: unknown[] } => {
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

export const updateCounter = async(uuid: string, body: UpdateCounterBody): Promise<boolean> => {
    const {sql, values} = buildUpdateSql(body);
    const isReactivating = body.status === CounterStatus.ACTIVE;
    const guardStatus = isReactivating ? CounterStatus.INACTIVE : CounterStatus.ACTIVE;
    try {
        const result = await pool.query(`UPDATE counters SET ${sql} where uuid = $${values.length+1} and status = $${values.length+2} RETURNING uuid`, [...values, uuid, guardStatus]);
        return (result.rowCount ?? 0) > 0;
    } catch (err) {
        handleDbError(err); 
        throw err;
    }
}
