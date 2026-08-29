import type { PoolClient } from "pg";
import { pool } from "../../config/database.js";
import { handleDbError } from "../../utils/db-errors.js";
import { IDEMPOTENCY_STATUS, type IIdempotency, type IdempotencyClaimInput, type IdempotencyClaimResult, type IdempotencyOperation, type IdempotencyResultStatus, type IdempotencyResultUpdate } from "../../db/models/idempotency.model.js";

export const claimIdempotency = async(client: PoolClient,claimInput: IdempotencyClaimInput) : Promise<IdempotencyClaimResult> => {
    const {user_id, operation, request_hash, key} = claimInput;
        const result = await client.query<IIdempotency>("INSERT INTO idempotency (user_id, operation, request_hash, key) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, operation, key) DO NOTHING RETURNING *", [user_id, operation, request_hash, key])
        if((result.rowCount ?? 0) === 0) {
            const existingRow = await findIdempotencyByScope(client, user_id, operation, key)

            if (!existingRow) {
                throw new Error(
                  "Idempotency conflict occurred but existing record was not found"
                );
              }
            return {
                claim_status: false,
                returned_row: existingRow
            }
        };
        const insertedRow = result.rows[0];
        
        if (!insertedRow) {
            throw new Error("Idempotency claim succeeded but no row was returned");
        }
        return {
            claim_status: true,
            returned_row: insertedRow
        }
}



export const findIdempotencyByScope = async(client: PoolClient, user_id: number, operation: IdempotencyOperation, key: string): Promise<IIdempotency | null>=> {
    const result = await client.query<IIdempotency>("SELECT * FROM idempotency where user_id = $1 and operation = $2 and key = $3", [user_id, operation, key])
    return result.rows[0] ?? null
}

const markIdempotencyResult = async (client: PoolClient, idempotency_id: number, status: IdempotencyResultStatus, request: IdempotencyResultUpdate): Promise<IIdempotency> => {
    const {http_status, response_body} = request;
    const result = await client.query<IIdempotency>("UPDATE idempotency SET http_status = $1, response_body = $2, status = $3, updated_at = Now() where id = $4 and status = $5 RETURNING *", [http_status, response_body, status, idempotency_id, IDEMPOTENCY_STATUS.IN_PROGRESS ] );
    if((result.rowCount ?? 0) === 0){
        throw new Error(`Idempotency row not updated to ${status === IDEMPOTENCY_STATUS.SUCCESS ? "SUCCESS" : "FAILED"}!`)
    }
    return result.rows[0]!;
}


export const markIdempotencySuccess = (client: PoolClient, idempotency_id: number, request: IdempotencyResultUpdate): Promise<IIdempotency> => {
    return markIdempotencyResult(client, idempotency_id, IDEMPOTENCY_STATUS.SUCCESS, request);
}

export const markIdempotencyFailure = (client: PoolClient, idempotency_id: number, request: IdempotencyResultUpdate): Promise<IIdempotency> => {
    return markIdempotencyResult(client, idempotency_id, IDEMPOTENCY_STATUS.FAILED, request);
}