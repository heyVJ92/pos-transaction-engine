export enum OrderStatus {
    HOLD = "hold",
    COMPLETED = "completed",
    INPROCESS = "in_process",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}

export interface IOrder {
    id: number;
    uuid: string;
    userId: number;
    orderNumber: string;
    counterSessionId: number;
    discount: number;
    subTotal: number;
    tax: number;
    total: number;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type IOrderPublic = Omit<IOrder, "id">;
