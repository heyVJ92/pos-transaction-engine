export interface IInventory {
    id : number;
    uuid: string;
    productId : number;
    availableStock : number;
    reservedStock: number;
    createdAt : Date;
    updatedAt: Date;
}