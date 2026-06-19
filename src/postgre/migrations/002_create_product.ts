export const up = `
    CREATE TYPE product_category AS ENUM ('beverages', 'snacks', 'grocery', 'dairy', 'other');
    CREATE TYPE product_status AS ENUM ('active', 'inactive');

    CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(50) UNIQUE NOT NULL,
        category product_category NOT NULL,
        cost_price NUMERIC(10, 2) NOT NULL,
        sell_price NUMERIC(10, 2) NOT NULL,
        tax NUMERIC(5, 2) NOT NULL DEFAULT 0,
        weight NUMERIC(10, 3),
        status product_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`;

export const down = `
    DROP TABLE IF EXISTS products;
    DROP TYPE IF EXISTS product_category;
    DROP TYPE IF EXISTS product_status;
`;