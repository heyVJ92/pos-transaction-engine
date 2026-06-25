export enum ProductCategory {
    BEVERAGES = "beverages",
    SNACKS = "snacks",
    GROCERY = "grocery",
    DAIRY = "dairy",
    OTHERS = "others"
}

export enum ProductStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}

export interface IProduct {
    id : number;
    uuid : string;
    name : string;
    sku : string;
    category : ProductCategory;
    costPrice: number;
    sellPrice: number;
    tax: number;
    weight: number;
    status: ProductStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type IProductPublic = Omit<IProduct, "id">;