export const up = `
    CREATE TYPE payment_mode AS ENUM ('cash', 'card', 'upi');

    CREATE TABLE payment (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        order_id INTEGER NOT NULL REFERENCES orders(id) UNIQUE,
        mode payment_mode NOT NULL,
        amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
        amount_tendered NUMERIC(10, 2) NOT NULL CHECK (amount_tendered >= amount),
        change NUMERIC(10, 2) NOT NULL CHECK (change >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS payment;
    DROP TYPE IF EXISTS payment_mode;
`