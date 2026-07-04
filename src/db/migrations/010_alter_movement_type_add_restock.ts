export const up = `
    ALTER TYPE movement_type ADD VALUE 'restock';
`

// THIS DOWN MIGRATION SHOULD NOT RUN WITH PROPER SUPERVISION

// export const down = `
//     -- Rollback: recreate movement_type without 'restock'
//     CREATE TYPE movement_type_new AS ENUM (
//         'initial', 'reserved', 'confirmed', 'reverted', 'expired'
//     );
    
//     ALTER TABLE inventory_movement
//         ALTER COLUMN movement_type TYPE movement_type_new
//         USING movement_type::text::movement_type_new;
    
//     DROP TYPE movement_type;
    
//     ALTER TYPE movement_type_new RENAME TO movement_type;
// `;