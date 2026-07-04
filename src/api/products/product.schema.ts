import * as z from "zod";
import { ProductCategory, ProductStatus } from "../../db/models/product.model.js";


// Get Query Schema
export const getProductQuerySchema = z.object({
    category: z.enum(ProductCategory).optional(),
    status: z.enum(ProductStatus).optional(),
    search: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sort:   z.enum(["name", "category", "cost_price", "sell_price"]).optional(),
    order:  z.enum(["asc", "desc"]).optional(),
}).strict()

export type GetProductQuery = z.infer<typeof getProductQuerySchema>

// Post body schema
export const addProductBodySchema = z.object({
    name: z.string(),
    sku: z.string(),
    category: z.enum(ProductCategory),
    weight: z.coerce.number().default(0),
    costPrice: z.coerce.number().default(0),
    sellPrice: z.coerce.number().default(0),
    tax: z.coerce.number().default(0),
})

export type PostProductBody = z.infer<typeof addProductBodySchema>

export const uuidParamSchema = z.object({
    uuid: z.string()
})

// update body schema
export const updateProductBodySchema = z.object({
    name: z.string().optional(),
    sku: z.string().optional(),
    category: z.enum(ProductCategory).optional(),
    costPrice: z.coerce.number().optional(),
    sellPrice: z.coerce.number().optional(),
    weight: z.coerce.number().optional(),
    tax: z.coerce.number().optional(),
})

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>
