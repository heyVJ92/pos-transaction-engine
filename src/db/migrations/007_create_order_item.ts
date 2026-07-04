export const up = `
    CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        sell_price NUMERIC(10,2) NOT NULL,
        cost_price NUMERIC(10,2) NOT NULL,
        tax NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS order_items;
`;