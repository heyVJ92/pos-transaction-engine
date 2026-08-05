export const up = `
    ALTER TABLE IF EXISTS inventory
    DROP COLUMN soft_reserved
`

export const down = `
    ALTER TABLE IF EXISTS inventory
    ADD COLUMN soft_reserved NUMERIC(10) NOT NULL DEFAULT 0 CHECK (soft_reserved >= 0);
`