export const up = `
    CREATE TABLE inventory (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE RESTRICT,
        available_stock NUMERIC(10) NOT NULL CHECK (available_stock >= 0),
        reserved_stock NUMERIC(10) NOT NULL CHECK (reserved_stock >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS inventory;
`