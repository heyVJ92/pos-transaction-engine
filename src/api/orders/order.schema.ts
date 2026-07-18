import * as z from "zod";

export const createOrderBodySchema = z.object({
    sessionUuid: z.uuid(),
    discount: z.coerce.number().min(0).max(100).default(0)
})

export type createOrderSchemaBody = z.infer<typeof createOrderBodySchema>

export const getOrderListQuerySchema = z.object({
    search: z.string().optional(),
    orderNumber: z.string().optional(),
    userName: z.string().optional(),
    counterName: z.string().optional(),
    counterCode: z.string().optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sort:   z.enum(["order_number", "userName", "total", "discount", "createdAt"]).optional(),
    order:  z.enum(["asc", "desc"]).optional(),
}).strict();

export type getOrderListSchemaBody = z.infer<typeof getOrderListQuerySchema>

export const getOrderDetailHandler = z.object({
    uuid: z.uuid()
})

export const itemOrderDetailBodySchema = z.object({
    productUuid: z.uuid(),
    quantity: z.coerce.number().min(1)
})

export type ItemOrderDetailBody = z.infer<typeof itemOrderDetailBodySchema>

export const orderAndItemParamSchema = z.object({
    uuid:     z.uuid(),
    itemUuid: z.uuid()
});

export const uuidParamSchema = z.object({
    uuid: z.uuid()
})