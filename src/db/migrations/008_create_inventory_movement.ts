export const up = `
    CREATE TYPE movement_type AS ENUM ('initial', 'reserved', 'confirmed', 'reverted', 'restock', 'expired');

    CREATE TABLE inventory_movement (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        order_id INTEGER REFERENCES orders(id),
        quantity NUMERIC(10) NOT NULL CHECK (quantity >= 0),
        movement_type movement_type NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS inventory_movement;
    DROP TYPE IF EXISTS movement_type;
`