import { pool } from "../../config/database.js";
import type { IUser, IUserPublic } from "../../db/models/user.model.js";
import { UserRole, UserStatus } from "../../db/models/user.model.js";
import type { GetUsersQuery } from "./user.schema.js";

interface UserRow {
    id:         number;
    uuid:       string;
    first_name: string;
    last_name:  string;
    email:      string;
    role:       string;
    status:     string;
    created_at: Date;
    updated_at: Date;
}

function rowToUser(row: UserRow): IUser {
    return {
        id:        row.id,
        uuid:      row.uuid,
        firstName: row.first_name,
        lastName:  row.last_name,
        email:     row.email,
        role:      row.role as UserRole,
        status:    row.status as UserStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function buildWhereClause(params: GetUsersQuery): {
    sql: string;
    values: unknown[];
    nextIndex: number;
} {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.role !== undefined) {
        conditions.push(`role = $${idx++}`);
        values.push(params.role);
    }

    if (params.status !== undefined) {
        conditions.push(`status = $${idx++}`);
        values.push(params.status);
    }

    if (params.search !== undefined) {
        // $idx is referenced 3 times — push the value once, increment idx once
        conditions.push(
            `(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`
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

export interface UserQueryResult {
    users: IUser[];
    total: number;
}

export async function findManyUsers(params: GetUsersQuery): Promise<UserQueryResult> {
    const { sql: where, values, nextIndex } = buildWhereClause(params);

    const sortCol   = params.sort  ?? "created_at";
    const sortOrder = params.order ?? "desc";
    const offset    = (params.page - 1) * params.limit;

    const countSql = `SELECT COUNT(*) AS total FROM users ${where}`;
    const dataSql  = `
        SELECT id, uuid, first_name, last_name, email, role, status, created_at, updated_at
        FROM users
        ${where}
        ORDER BY ${sortCol} ${sortOrder.toUpperCase()}
        LIMIT $${nextIndex} OFFSET $${nextIndex + 1}
    `;

    // Independent reads — run concurrently to halve latency
    const [countResult, dataResult] = await Promise.all([
        pool.query<{ total: string }>(countSql, values),
        pool.query<UserRow>(dataSql, [...values, params.limit, offset]),
    ]);

    // pg returns COUNT(*) as a string; noUncheckedIndexedAccess requires ?.
    const total = Number(countResult.rows[0]?.total ?? 0);

    return {
        users: dataResult.rows.map(rowToUser),
        total,
    };
}
