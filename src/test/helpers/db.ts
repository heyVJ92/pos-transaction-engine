import { pool } from "../../config/database.js";
import { IDEMPOTENCY_OPERATION, type IdempotencyStatus } from "../../db/models/idempotency.model.js";

/**
 * Wipes every table this test suite touches and resets identity sequences,
 * so every test starts from a genuinely empty, known state.
 * CASCADE handles FK order for us — no need to list tables in dependency order.
 */
export const resetDb = async (): Promise<void> => {
    await pool.query(`
        TRUNCATE TABLE
            inventory_movement,
            order_items,
            orders,
            counter_sessions,
            counters,
            inventory,
            products,
            users
        RESTART IDENTITY CASCADE
    `);
};

export interface BaseFixtures {
    userId: number;
    sessionId: number;
    productId: number;
    productUuid: string;
}

/**
 * Seeds the minimum valid graph needed to hit POST /orders/:uuid/items:
 * one user, one counter, one open counter_session, one product with an
 * inventory row set to `availableStock`.
 */
export const seedBaseFixtures = async (availableStock: number): Promise<BaseFixtures> => {
    const { rows: userRows } = await pool.query<{ id: number }>(
        `INSERT INTO users (first_name, last_name, email, role)
         VALUES ('Test', 'Cashier', 'race-test-cashier@test.local', 'cashier')
         RETURNING id`
    );
    const userId = userRows[0]!.id;

    const { rows: counterRows } = await pool.query<{ id: number }>(
        `INSERT INTO counters (name, code) VALUES ('Race Test Counter', 'RACE-01') RETURNING id`
    );
    const counterId = counterRows[0]!.id;

    const { rows: sessionRows } = await pool.query<{ id: number }>(
        `INSERT INTO counter_sessions (counter_id, user_id) VALUES ($1, $2) RETURNING id`,
        [counterId, userId]
    );
    const sessionId = sessionRows[0]!.id;

    const { rows: productRows } = await pool.query<{ id: number; uuid: string }>(
        `INSERT INTO products (name, sku, category, cost_price, sell_price, tax)
         VALUES ('Race Test Widget', 'SKU-RACE-001', 'others', 10, 20, 0)
         RETURNING id, uuid`
    );
    const productId = productRows[0]!.id;
    const productUuid = productRows[0]!.uuid;

    await pool.query(
        `INSERT INTO inventory (product_id, available_stock) VALUES ($1, $2)`,
        [productId, availableStock]
    );

    return { userId, sessionId, productId, productUuid };
};

/** Creates one empty draft order — call twice for two "cashiers". */
export const createDraftOrder = async (sessionId: number, userId: number): Promise<string> => {
    const { rows } = await pool.query<{ uuid: string }>(
        `INSERT INTO orders (counter_session_id, user_id, status)
         VALUES ($1, $2, 'draft') RETURNING uuid`,
        [sessionId, userId]
    );
    return rows[0]!.uuid;
};

export interface InventorySnapshot {
    availableStock: number;
    reservedStock: number;
}

/** Direct DB read, bypassing the API — for asserting ground truth after the race. */
export const getInventory = async (
    productId: number
): Promise<InventorySnapshot> => {

    console.log("GET INVENTORY START", {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
    });

    const { rows } = await pool.query<{
        available_stock: string;
        reserved_stock: string;
    }>(
        `SELECT available_stock, reserved_stock
         FROM inventory
         WHERE product_id = $1`,
        [productId]
    );

    console.log("GET INVENTORY QUERY FINISHED", {
        rows,
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
    });

    const row = rows[0]!;

    return {
        availableStock: Number(row.available_stock),
        reservedStock: Number(row.reserved_stock),
    };
};

/** Call once in afterAll — leaving the pool open across test files causes Jest to hang on exit. */
export const closeDb = async (): Promise<void> => {
    await pool.end();
};

type PaymentVerificationState = {
    orderStatus: string;
    paymentCount: number;
    idempotencyStatus: IdempotencyStatus;
    idempotencyHttpStatus: number | null;
};

export const getPaymentVerificationState = async (
    orderUuid: string,
    idempotencyKey: string
): Promise<PaymentVerificationState> => {

    const { rows: orderRows } = await pool.query<{
        id: number;
        status: string;
        user_id: number;
    }>(
        `SELECT id, status, user_id
         FROM orders
         WHERE uuid = $1`,
        [orderUuid]
    );

    const order = orderRows[0];

    if (!order) {
        throw new Error("Test verification failed: order not found");
    }

    const { rows: idempotencyRows } = await pool.query<{
        status: IdempotencyStatus;
        http_status: number | null;
    }>(
        `SELECT status, http_status
         FROM idempotency
         WHERE key = $1
           AND user_id = $2
           AND operation = $3`,
        [
            idempotencyKey,
            order.user_id,
            IDEMPOTENCY_OPERATION.PROCESS_PAYMENT
        ]
    );

    const idempotency = idempotencyRows[0];

    if (!idempotency) {
        throw new Error("Test verification failed: idempotency row not found");
    }

    const { rows: paymentInfo } = await pool.query<{
        count: number;
    }>(
        `SELECT count(*)
         FROM payments
         WHERE order_id = $1`,
        [
            order.id
        ]
    );

    const paymentRow = paymentInfo[0];

    if (!paymentRow) {
        throw new Error("Test verification failed: payment Count not found");
    }

    return {
        orderStatus: order.status,
        paymentCount: paymentRow.count,
        idempotencyStatus: idempotency.status,
        idempotencyHttpStatus: idempotency.http_status
    };
};