export const up = `
    ALTER TABLE inventory_movement
    ADD COLUMN stock_before NUMERIC(10) NOT NULL DEFAULT 0,
    ADD COLUMN stock_after NUMERIC(10) NOT NULL DEFAULT 0,
    ADD COLUMN unit_cost NUMERIC(10,2);
`

export const down = `
    ALTER TABLE inventory_movement
    DROP COLUMN stock_before,
    DROP COLUMN stock_after,
    DROP COLUMN unit_cost;
`;