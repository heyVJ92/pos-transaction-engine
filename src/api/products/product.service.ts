import { ProductStatus, type IProduct } from "../../db/models/product.model.js";
import { findManyProducts, addNewProduct, findSingleProduct, setProductInactive, updateProduct } from "./product.repository.js";
import type { GetProductQuery, PostProductBody, UpdateProductBody } from "./product.schema.js";


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

export const getProductDetails = async(uuid: string): Promise<IProduct | null> => {
    const result = await findSingleProduct(uuid)
    return result
}

export const removeProduct = async (uuid: string): Promise<"not_found" | "already_inactive" | "success"> => {
    console.log(uuid, "uuid------2");
    const product = await findSingleProduct(uuid);
    console.log(product,"product");
    if (!product) return "not_found";
    if (product.status === ProductStatus.INACTIVE) return "already_inactive";

    await setProductInactive(uuid);
    
    return "success";
};

export const updateProductByUUID = async (uuid: string, body: UpdateProductBody): Promise<"not_found" | "already_inactive" | "success"> => {
    console.log(body, "--------body");

    const product = await findSingleProduct(uuid);
    if (!product) return "not_found";
    if (product.status === ProductStatus.INACTIVE) return "already_inactive";
    await updateProduct(uuid, body);
    return "success"
};