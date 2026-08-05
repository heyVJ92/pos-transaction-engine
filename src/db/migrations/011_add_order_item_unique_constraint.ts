// Backs the ON CONFLICT (order_id, product_id) upsert in addItemTransaction
// (order.repository.ts) — that clause has existed since order_items was first created but
// never had a matching constraint, so Postgres rejected it outright the moment a second
// insert for the same product on the same order was attempted ("there is no unique or
// exclusion constraint matching the ON CONFLICT specification"). No existing rows can
// violate this: every insert attempt that would have created a duplicate failed the
// transaction before committing, so there's nothing to deduplicate first.
export const up = `
    ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_product_id_key UNIQUE (order_id, product_id)
`;

export const down = `
    ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_order_id_product_id_key
`;
