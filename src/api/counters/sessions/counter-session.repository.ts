import { pool } from "../../../config/database.js";
import { CounterSessionStatus, type ICounterSession } from "../../../db/models/counter_session.model.js";
import { handleDbError } from "../../../utils/db-errors.js";
import type { GetCounterSessionQuery, UpdateCounterSessionBody } from "./counter-session.schema.js";

// Enriched row — JOINs counters + users (API_PATTERNS.md §13)
interface CounterSessionRow {
    id:                 number;
    uuid:               string;
    opening_balance:    number;
    closing_balance:    number | null;
    total_orders:       number;
    total_amount:       number;
    status:             string;
    opened_at:          Date;
    closed_at:          Date | null;
    created_at:         Date;
    updated_at:         Date;
    counter_id:          number;
    counter_uuid:       string;
    counter_name:       string;
    counter_code:       string;
    user_id:             number;
    cashier_uuid:       string;
    cashier_first_name: string;
    cashier_last_name:  string;
}

function rowToCounterSession (row: CounterSessionRow): ICounterSession {
    return {
    id:              row.id,
    uuid:            row.uuid,
    counterId:       row.counter_id,
    counter: {
        uuid: row.counter_uuid,
        name: row.counter_name,
        code: row.counter_code,
    },
    userId:       row.user_id,
    cashier: {
        uuid:      row.cashier_uuid,
        firstName: row.cashier_first_name,
        lastName:  row.cashier_last_name,
    },
    openingBalance:  Number(row.opening_balance),
    closingBalance:  row.closing_balance !== null ? Number(row.closing_balance) : null,
    totalOrders:     Number(row.total_orders),
    totalAmount:     Number(row.total_amount),
    status:          row.status as CounterSessionStatus,
    openedAt:        row.opened_at,
    closedAt:        row.closed_at,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    }
}

const SESSION_JOIN_SQL = `
    FROM counter_sessions cs
    INNER JOIN counters c ON c.id = cs.counter_id
    INNER JOIN users u ON u.id = cs.user_id
`;

const SESSION_SELECT_COLUMNS = `
    cs.id, cs.uuid, cs.opening_balance, cs.closing_balance, cs.total_orders, cs.total_amount,
    cs.status, cs.opened_at, cs.closed_at, cs.created_at, cs.updated_at,
    c.id AS counter_id, c.uuid AS counter_uuid, c.name AS counter_name, c.code AS counter_code,
    u.id AS user_id,u.uuid AS cashier_uuid, u.first_name AS cashier_first_name, u.last_name AS cashier_last_name
`;

export interface QueryResult {
    data: ICounterSession[],
    total: number
}


// Find All Method from here
function buildWhereClause(params: GetCounterSessionQuery): {
    sql: string;
    values: unknown[];
    nextIndex: number;
} {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.counterUuid !== undefined) {
        conditions.push(`c.uuid = $${idx++}`);
        values.push(params.counterUuid);
    }

    if (params.userUuid !== undefined) {
        conditions.push(`u.uuid = $${idx++}`);
        values.push(params.userUuid);
    }

    if (params.status !== undefined) {
        conditions.push(`cs.status = $${idx++}`);
        values.push(params.status);
    }

    return {
        sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
        nextIndex: idx,
    };
}

export async function findManyCounterSessions(params: GetCounterSessionQuery): Promise<QueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);

    const sortCol   = `cs.${params.sort ?? "opened_at"}`;
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total ${SESSION_JOIN_SQL} ${where}`;
    const dataSql  = `
        SELECT ${SESSION_SELECT_COLUMNS}
        ${SESSION_JOIN_SQL}
        ${where}
        ORDER BY ${sortCol} ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // Independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<CounterSessionRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        data: dataResult.rows.map(rowToCounterSession),
        total,
    };
}



// Insert Method from here — ids are already resolved from uuid by the service layer (API_PATTERNS.md §12)
const INSERT_COUNTER_SESSION_SQL = `
    INSERT INTO counter_sessions
        (counter_id, user_id, opening_balance, status)
    VALUES
        ($1, $2, $3, $4)
    RETURNING uuid
`;

export const addNewCounterSession = async(counterId: number, userId: number, openingBalance: number): Promise<boolean> => {
    try {
        const result = await pool.query(INSERT_COUNTER_SESSION_SQL, [
            counterId,
            userId,
            openingBalance,
            CounterSessionStatus.OPEN
        ])
        return (result.rowCount ?? 0) > 0
    } catch (err) {
        handleDbError(err); // converts PG error → DatabaseError
        throw err;          // unreachable, satisfies TypeScript
    }
}

// Detail Method from here
export const findSingleCounterSession = async(uuid: string): Promise<ICounterSession | null> => {
    const { rows } = await pool.query<CounterSessionRow>(`
        SELECT ${SESSION_SELECT_COLUMNS}
        ${SESSION_JOIN_SQL}
        WHERE cs.uuid = $1
    `, [uuid]);
    return rows.length > 0 ?  rowToCounterSession(rows[0]!) : null
}

// Delete (close) Method from here
export const setCounterSessionClosed = async (uuid: string): Promise<void> => {
    await pool.query(
        `UPDATE counter_sessions SET status = $1, closed_at = NOW(), updated_at = NOW() WHERE uuid = $2`,
        [CounterSessionStatus.CLOSED, uuid]
    );
};


// Update Method from here
const columnMap: Record<string, string> = {
    closingBalance: "closing_balance",
};

const buildUpdateSql = (body: UpdateCounterSessionBody): { sql: string; values: unknown[] } => {
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

export const updateCounterSession = async(uuid: string, body: UpdateCounterSessionBody): Promise<void> => {
    const {sql, values} = buildUpdateSql(body);
    try {
        await pool.query(`UPDATE counter_sessions SET ${sql} where uuid = $${values.length+1} and status = $${values.length+2} RETURNING uuid`, [...values, uuid, CounterSessionStatus.OPEN]);
    } catch (err) {
        handleDbError(err); // converts PG error → DatabaseError
        throw err;          // unreachable, satisfies TypeScript
    }
}
