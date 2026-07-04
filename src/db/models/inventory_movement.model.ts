export enum MovementType {
    INITIAL = "initial",
    RESERVED = "reserved",
    CONFIRMED = "confirmed",
    REVERTED = "reverted",
    EXPIRED = "expired"
}


export interface IInventoryMovement {
    id:           number;
    uuid:         string;
    productId:    number;
    orderId:      number | null;  // nullable — INITIAL has no order
    quantity:     number;
    movementType: MovementType;
    createdAt:    Date;
}

export type IInventoryMovementPublic = Omit<IInventoryMovement, "id">;