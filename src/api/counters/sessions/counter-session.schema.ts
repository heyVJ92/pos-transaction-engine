import * as z from "zod";
import { CounterSessionStatus } from "../../../db/models/counter_session.model.js";


// Get Query Schema
export const getCounterSessionQuerySchema = z.object({
    counterUuid: z.uuid().optional(),
    userUuid: z.uuid().optional(),
    status: z.enum(CounterSessionStatus).optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sort:   z.enum(["opened_at", "closed_at"]).optional(),
    order:  z.enum(["asc", "desc"]).optional(),
}).strict()

export type GetCounterSessionQuery = z.infer<typeof getCounterSessionQuerySchema>

// Post body schema — client always sends uuid, service resolves to internal id (API_PATTERNS.md §12)
export const addCounterSessionBodySchema = z.object({
    counterUuid: z.uuid(),
    userUuid: z.uuid(),
    openingBalance: z.coerce.number().default(0),
})

export type PostCounterSessionBody = z.infer<typeof addCounterSessionBodySchema>

export const uuidParamSchema = z.object({
    uuid: z.uuid()
})

// update body schema
export const updateCounterSessionBodySchema = z.object({
    closingBalance: z.coerce.number().optional(),
})

export type UpdateCounterSessionBody = z.infer<typeof updateCounterSessionBodySchema>
