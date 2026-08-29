export const IDEMPOTENCY_OPERATION = {
    PROCESS_PAYMENT : "process_payment"
} as const;

export type IdempotencyOperation = typeof IDEMPOTENCY_OPERATION[keyof typeof IDEMPOTENCY_OPERATION]


export const IDEMPOTENCY_STATUS = {
    IN_PROGRESS: "in_progress",
    FAILED: "failed",
    SUCCESS: "success"
} as const 

export type IdempotencyStatus = typeof IDEMPOTENCY_STATUS[keyof typeof IDEMPOTENCY_STATUS]

export interface IIdempotency {
    id: number;
    uuid: string;
    user_id: number;
    key: string;
    operation: IdempotencyOperation;
    request_hash: string
    status: IdempotencyStatus;
    http_status: number | null;
    response_body: unknown | null;
    created_at: Date;
    updated_at: Date;
    expires_at: Date | null;
}

export interface IdempotencyClaimInput {
    user_id: number;
    operation: IdempotencyOperation;
    key: string;
    request_hash: string;
}

export interface IdempotencyClaimResult {
    claim_status: boolean;
    returned_row: IIdempotency;
}

export interface IdempotencyResultUpdate {
    http_status: number;
    response_body: unknown;
}

export type  IdempotencyResultStatus = 
| typeof IDEMPOTENCY_STATUS.SUCCESS | typeof IDEMPOTENCY_STATUS.FAILED

export const IDEMPOTENCY_DECISION = {
    EXECUTE: "execute",
    HASH_CONFLICT: "hash_conflict",
    IN_PROGRESS: "in_progress",
    REPLAY_SUCCESS: "replay_success",
    REPLAY_FAILURE: "replay_failure"
} as const

export type IdempotencyDecisionType = typeof IDEMPOTENCY_DECISION[keyof typeof IDEMPOTENCY_DECISION]

export type IdempotencyDecision = |
{
    type: typeof IDEMPOTENCY_DECISION.EXECUTE,
    record: IIdempotency
} |
{
    type: typeof IDEMPOTENCY_DECISION.HASH_CONFLICT,
} |
{
    type: typeof IDEMPOTENCY_DECISION.IN_PROGRESS,
} |
{
    type: typeof IDEMPOTENCY_DECISION.REPLAY_SUCCESS,
    http_status: number;
    response_body: unknown;
} |
{
    type: typeof IDEMPOTENCY_DECISION.REPLAY_FAILURE,
    http_status: number;
    response_body: unknown;
}