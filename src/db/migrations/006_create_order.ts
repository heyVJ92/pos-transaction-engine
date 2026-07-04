export const up = `
    CREATE TYPE order_status AS ENUM ('hold', 'completed', 'in_process', 'cancelled', 'expired');
    CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        counter_session_id INTEGER NOT NULL REFERENCES counter_sessions(id) ON DELETE RESTRICT,
        discount NUMERIC(10,2) DEFAULT 0,
        sub_total NUMERIC(10,2) DEFAULT 0,
        tax NUMERIC(10,2) DEFAULT 0,
        total NUMERIC(10,2) DEFAULT 0,
        status order_status NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`;

export const down = `
    DROP TABLE IF EXISTS orders;
    DROP TYPE IF EXISTS order_status;
`