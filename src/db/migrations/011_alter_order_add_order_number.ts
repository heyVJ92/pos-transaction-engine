export const up = `
    -- new sequence
    CREATE SEQUENCE order_number_seq START 1;

    -- add column
    ALTER TABLE orders 
    ADD COLUMN order_number VARCHAR(20) UNIQUE NOT NULL 
    DEFAULT 'OID' || LPAD(nextval('order_number_seq')::text, 7, '0');
`;

export const down = `
    ALTER TABLE orders
    DROP COLUMN order_number;

    DROP SEQUENCE IF EXIST order_number_seq;
`;