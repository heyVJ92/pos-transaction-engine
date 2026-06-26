// src/utils/db-errors.ts

interface PostgresError extends Error {
    code: string;
    detail?: string;
}

export const isPostgresError = (err: unknown): err is PostgresError => {
    return typeof err === "object" && err !== null && "code" in err;
};

const PG_ERROR_CODES: Record<string, string> = {
    "23505": "UNIQUE_VIOLATION",
    "23503": "FOREIGN_KEY_VIOLATION",
    "23502": "NOT_NULL_VIOLATION",
    "40P01": "DEADLOCK_DETECTED",
    "55P03": "LOCK_NOT_AVAILABLE",
};

export class DatabaseError extends Error {
    constructor(
        public readonly code: string,
        public readonly detail?: string
    ) {
        super(code);
        this.name = "DatabaseError";
    }
}

export const handleDbError = (err: unknown): never => {
    if (isPostgresError(err)) {
        const code = PG_ERROR_CODES[err.code] ?? "DATABASE_ERROR";
        throw new DatabaseError(code, err.detail);
    }
    throw err;
};