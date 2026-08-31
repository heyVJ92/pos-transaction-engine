import type { PoolClient } from "pg";
import { IDEMPOTENCY_DECISION, IDEMPOTENCY_OPERATION, type IdempotencyDecision } from "../../db/models/idempotency.model.js";
import { classifyIdempotencyDuplicate, hashProcessPaymentRequest } from "../../utils/idempotency.utils.js";
import { claimIdempotency } from "./idempotency.repository.js";
import type { PaymentMode } from "../../api/orders/order.schema.js";
import { sendError } from "../../utils/response.js";
import {type  Response } from "express"
export const beginIdempotentOperation = async(client: PoolClient, user_id: number, orderUuid: string, key: string, mode: PaymentMode, amountTendered: number) :Promise<IdempotencyDecision> => {
        const current_request_hash = hashProcessPaymentRequest(orderUuid, mode, amountTendered);
        const claim = await claimIdempotency(client, {user_id, operation: IDEMPOTENCY_OPERATION.PROCESS_PAYMENT, request_hash: current_request_hash, key});
        if(claim.claim_status) return { type:  IDEMPOTENCY_DECISION.EXECUTE, record: claim.returned_row }
        return classifyIdempotencyDuplicate(claim.returned_row, current_request_hash);
}


export const handleIdempotencyDecision = (
        res: Response,
        decision: IdempotencyDecision
    ): void => {
        switch (decision.type) {
            case IDEMPOTENCY_DECISION.HASH_CONFLICT:
                sendError(
                    res,
                    "IDEMPOTENCY_KEY_CONFLICT",
                    "Idempotency key was already used with a different request",
                    409
                );
                return;
    
            case IDEMPOTENCY_DECISION.IN_PROGRESS:
                sendError(
                    res,
                    "IDEMPOTENCY_IN_PROGRESS",
                    "A request with this idempotency key is already being processed",
                    409
                );
                return;
    
            case IDEMPOTENCY_DECISION.REPLAY_SUCCESS:
            case IDEMPOTENCY_DECISION.REPLAY_FAILURE:
                res.status(decision.http_status).json(decision.response_body);
                return;
    
            case IDEMPOTENCY_DECISION.EXECUTE:
                throw new Error("EXECUTE decision reached controller");
        }
};