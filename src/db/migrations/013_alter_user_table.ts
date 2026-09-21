export const up = `
    ALTER TABLE users
        ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '',
        ADD COLUMN last_login_at TIMESTAMPTZ;

    ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;
`

export const down = `
    ALTER TABLE users
        DROP COLUMN password_hash,
        DROP COLUMN last_login_at;
`