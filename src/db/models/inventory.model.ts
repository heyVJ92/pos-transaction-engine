import type { ProductCategory, ProductStatus } from "./product.model.js";

export interface IInventory {
    id : number;
    uuid: string;
    productId : number;
    product: {
        uuid: string;
        name: string;
        sku: string;
        category: ProductCategory;
        costPrice: number;
        sellPrice: number;
        tax: number;
        weight: number;
        status: ProductStatus;
    };
    availableStock : number;
    reservedStock: number;
    soft_reserved: number;
    createdAt : Date;
    updatedAt: Date;
}


export type IInventoryPublic = Omit<IInventory, "id" | "productId">