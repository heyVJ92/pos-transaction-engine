export const up = `
    CREATE TYPE user_status AS ENUM ('active', 'inactive');
    CREATE TYPE user_role AS ENUM ('admin', 'cashier');

    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role user_role NOT NULL,
        status user_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
`
export const down = `
    DROP TABLE IF EXISTS users;
    DROP TYPE IF EXISTS user_status;
    DROP TYPE IF EXISTS user_role;
`