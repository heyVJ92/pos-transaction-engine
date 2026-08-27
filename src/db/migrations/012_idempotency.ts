export const up = `
    CREATE TABLE idempotency (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_progress',
        response_body JSONB,
        http_status INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,

        UNIQUE (user_id, operation, key)
    );
`
export const down = `
    DROP TABLE IF EXISTS idempotency;
`