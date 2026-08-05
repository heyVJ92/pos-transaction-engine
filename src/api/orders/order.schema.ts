import * as z from "zod";

export const createOrderBodySchema = z.object({
    sessionUuid: z.uuid()
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

export const editOrderItemBodySchema = z.object({
    // 0 is valid on purpose — it means "remove this line", handled the same as DELETE
    quantity: z.coerce.number().min(0)
})

export type EditOrderItemBody = z.infer<typeof editOrderItemBodySchema>

export const orderAndItemParamSchema = z.object({
    uuid:     z.uuid(),
    itemUuid: z.uuid()
});

export const uuidParamSchema = z.object({
    uuid: z.uuid()
})

export const paymentModeSchema = z.enum(["cash", "card", "upi"]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

export const payOrderBodySchema = z.object({
    mode: paymentModeSchema,
    amountTendered: z.coerce.number().min(0)
})

export type PayOrderBody = z.infer<typeof payOrderBodySchema>