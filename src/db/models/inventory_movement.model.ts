import type { ProductStatus } from "./product.model.js";

export enum MovementType {
    INITIAL = "initial",
    RESERVED = "reserved",
    CONFIRMED = "confirmed",
    REVERTED = "reverted",
    EXPIRED = "expired",
    RESTOCK =  "restock"
}


export interface IInventoryMovement {
    id:           number;
    uuid:         string;
    productId:    number;
    productUuid:  string;
    orderId:      number | null;  // nullable — INITIAL has no order
    orderUuid:    string | null;
    orderNumber:  string | null;
    quantity:     number;
    movementType: MovementType;
    stockBefore:  number;
    stockAfter:   number;
    unitCost:     number | null;
    createdAt:    Date;
}

export type IInventoryMovementPublic = Omit<IInventoryMovement, "id" | "productId" | "orderId">;