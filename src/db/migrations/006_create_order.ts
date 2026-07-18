export const up = `
    CREATE SEQUENCE order_number_seq START 1;
    
    CREATE TYPE order_status AS ENUM ('draft', 'hold', 'completed', 'in_process', 'cancelled', 'expired');

    CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        counter_session_id INTEGER NOT NULL REFERENCES counter_sessions(id) ON DELETE RESTRICT,
        discount NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= 100),
        sub_total NUMERIC(10,2) NOT NULL DEFAULT 0,
        tax NUMERIC(10,2) NOT NULL DEFAULT 0,
        total NUMERIC(10,2) NOT NULL DEFAULT 0,
        order_number VARCHAR(20) NOT NULL UNIQUE DEFAULT 'OID' || LPAD(nextval('order_number_seq')::text, 7, '0'),
        status order_status NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS orders;
    DROP TYPE IF EXISTS order_status;
    DROP SEQUENCE IF EXISTS order_number_seq;
`;