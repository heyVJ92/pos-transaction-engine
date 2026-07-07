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
    availableStock: number;
    reservedStock: number;
    minQty: number;
    maxQty: number | null;
    status: ProductStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type IProductPublic = Omit<IProduct, "id">;

// detail extends list — adds tax and weight only
export interface IProductDetail extends IProduct {
    tax:    number;
    weight: number;
}

export type IProductDetailPublic = Omit<IProductDetail, "id">;