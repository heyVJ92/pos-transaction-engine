import * as z from "zod";
import { CounterStatus } from "../../db/models/counter.model.js";


// Get Query Schema
export const getCounterQuerySchema = z.object({
    status: z.enum(CounterStatus).optional(),
    search: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sort:   z.enum(["name", "code"]).optional(),
    order:  z.enum(["asc", "desc"]).optional(),
}).strict()

export type GetCounterQuery = z.infer<typeof getCounterQuerySchema>

// Post body schema
export const addCounterBodySchema = z.object({
    name: z.string(),
    code: z.string(),
})

export type PostCounterBody = z.infer<typeof addCounterBodySchema>

export const uuidParamSchema = z.object({
    uuid: z.string()
})

// update body schema
export const updateCounterBodySchema = z.object({
    name: z.string().optional(),
    code: z.string().optional(),
})

export type UpdateCounterBody = z.infer<typeof updateCounterBodySchema>
