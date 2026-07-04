export const up = `
    ALTER TABLE products
    ADD COLUMN min_qty NUMERIC(10) NOT NULL DEFAULT 0,
    ADD COLUMN max_qty NUMERIC(10);
`

export const down = `
    ALTER TABLE products
    DROP COLUMN min_qty,
    DROP COLUMN max_qty;
`