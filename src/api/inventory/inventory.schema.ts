import * as z from "zod";  // use "import * as z" — matches project convention in env.ts
import { ProductCategory } from "../../db/models/product.model.js";

export const getInventoryQuerySchema = z.object({
    category: z.enum(ProductCategory).optional(),
    search: z.string().optional(),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10),
    sort:   z.enum(["name", "category", "cost_price", "sell_price"]).optional(),
    order:  z.enum(["asc", "desc"]).optional(),
}).strict();

export type GetInventoryQuery = z.infer<typeof getInventoryQuerySchema>

export const postInventoryBodySchema = z.object({
    product_uuid: z.string(),
    availableStock: z.coerce.number().default(0)
})

export type PostInventoryBody = z.infer<typeof postInventoryBodySchema>
