export interface IOrderItem {
    id: number;
    uuid: string;
    productId: number;
    orderId: number;
    quantity: number;
    sellPrice: number;
    costPrice: number;
    createdAt: Date;
}

export type IOrderItemPublic = Omit<IOrderItem, "id">;
