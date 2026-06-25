import type { IProduct } from "../../db/models/product.model.js";
import { findManyProducts, addNewProduct } from "./product.repository.js";
import type { GetProductQuery, PostProductBody } from "./product.schema.js";


interface ProductsPage {
    data: IProduct[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function listProducts(params: GetProductQuery): Promise<ProductsPage> {
    const {data, total} = await findManyProducts(params);
    return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit)
    }
}

export const addProduct = async(body: PostProductBody): Promise<boolean> => {
    return await addNewProduct(body)
}