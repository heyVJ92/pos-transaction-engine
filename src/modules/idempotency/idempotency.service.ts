import type { PoolClient } from "pg";
import { IDEMPOTENCY_DECISION, IDEMPOTENCY_OPERATION, type IdempotencyDecision } from "../../db/models/idempotency.model.js";
import { classifyIdempotencyDuplicate, hashProcessPaymentRequest } from "../../utils/idempotency.utils.js";
import { claimIdempotency } from "./idempotency.repository.js";
import type { PaymentMode } from "../../api/orders/order.schema.js";

export const beginIdempotentOperation = async(client: PoolClient, user_id: number, orderUuid: string, key: string, mode: PaymentMode, amountTendered: number) :Promise<IdempotencyDecision> => {
        const current_request_hash = hashProcessPaymentRequest(orderUuid, mode, amountTendered);
        const claim = await claimIdempotency(client, {user_id, operation: IDEMPOTENCY_OPERATION.PROCESS_PAYMENT, request_hash: current_request_hash, key});
        if(claim.claim_status) return { type:  IDEMPOTENCY_DECISION.EXECUTE, record: claim.returned_row }
        return classifyIdempotencyDuplicate(claim.returned_row, current_request_hash);
}