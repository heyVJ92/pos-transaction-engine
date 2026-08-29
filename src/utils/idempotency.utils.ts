import { createHash } from "node:crypto";
import { IDEMPOTENCY_DECISION, IDEMPOTENCY_STATUS, type IdempotencyDecision, type IIdempotency } from "../db/models/idempotency.model.js";

export const hashProcessPaymentRequest = (
  orderUuid: string,
  mode: string,
  amountTendered: number
): string => {
  const requestString = JSON.stringify({
    orderUuid,
    mode,
    amountTendered,
  });

  return createHash("sha256")
    .update(requestString)
    .digest("hex");
};

export const classifyIdempotencyDuplicate = (
  existing: IIdempotency,
  current_request_hash: string
): IdempotencyDecision => {
  const {request_hash, status, http_status, response_body} = existing;
  if(request_hash !== current_request_hash){
    // conflict
    return {
      type: IDEMPOTENCY_DECISION.HASH_CONFLICT
    }
  } 
  if (status === IDEMPOTENCY_STATUS.IN_PROGRESS){
    // replay in process
    return {
      type: IDEMPOTENCY_DECISION.IN_PROGRESS
    }
  } 
  if (status === IDEMPOTENCY_STATUS.FAILED){
    // replay Failed
    if (http_status === null) {
      throw new Error("FAILED idempotency record missing http_status");
    }
    return {
      type: IDEMPOTENCY_DECISION.REPLAY_FAILURE,
      http_status,
      response_body
    }
  } 
  if (status === IDEMPOTENCY_STATUS.SUCCESS){
    // replay Success
    if (http_status === null) {
      throw new Error("SUCCESS idempotency record missing http_status");
    }

    return {
      type: IDEMPOTENCY_DECISION.REPLAY_SUCCESS,
      http_status,
      response_body
    }
  } 
  throw new Error(`Unexpected idempotency status: ${status}`);
}