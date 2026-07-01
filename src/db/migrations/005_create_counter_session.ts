export const up = `
    CREATE TYPE counter_session_status AS ENUM ('open', 'closed');

    CREATE TABLE counter_sessions (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        counter_id INTEGER NOT NULL REFERENCES counters(id) ON DELETE RESTRICT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
        closing_balance NUMERIC(10,2),
        total_orders INTEGER NOT NULL DEFAULT 0,
        total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        status counter_session_status NOT NULL DEFAULT 'open',
        opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS counter_sessions;
    DROP TYPE IF EXISTS counter_session_status;
`;
