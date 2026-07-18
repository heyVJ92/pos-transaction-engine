import * as z from "zod";  // use "import * as z" — matches project convention in env.ts
import { MovementType } from "../../db/models/inventory_movement.model.js";

export const restockBodySchema = z.object({
    quantity: z.coerce.number().min(1),
    unitCost: z.coerce.number().min(0)
})

export type RestockBody = z.infer<typeof restockBodySchema>

export const uuidParamSchema = z.object({
    product_uuid: z.uuid()
})


export const inventoryMovementQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),    
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10),
    order:  z.enum(["asc", "desc"]).optional(),
    movementType: z.enum(MovementType).optional()
}).strict();

export type InventoryMovementQueryBody = z.infer<typeof inventoryMovementQuerySchema>