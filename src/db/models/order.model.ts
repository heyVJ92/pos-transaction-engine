export enum OrderStatus {
    DRAFT = "draft",
    HOLD = "hold",
    COMPLETED = "completed",
    INPROCESS = "in_process",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}

export interface IOrderList {
    id: number;
    uuid: string;
    cashier: {
        uuid: string;
        firstName: string;
        lastName: string;
    },
    counter: {
        uuid: string;
        name: string;
        code: string;
    },
    orderNumber: string;
    discount: number;
    subTotal: number;
    tax: number;
    total: number;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface IOrderDetail extends IOrderList{
        items: {
            uuid:      string;
            quantity:  number;
            sellPrice: number;
            costPrice: number;
            tax:       number;
            total:     number;
            product: {
                uuid: string;
                name: string;
                sku:  string;
            };
        }[];
}

export type IOrderListPublic = Omit<IOrderList, "id">;

export type IOrderDetailPublic = Omit<IOrderDetail, "id">;