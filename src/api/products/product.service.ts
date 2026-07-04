import { ProductStatus, type IProduct } from "../../db/models/product.model.js";
import { DatabaseError } from "../../utils/db-errors.js";
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
    const product = await findSingleProduct(uuid);
    if (!product) return "not_found";
    if (product.status === ProductStatus.INACTIVE) return "already_inactive";

    await setProductInactive(uuid);
    
    return "success";
};

export const updateProductByUUID = async (uuid: string, body: UpdateProductBody): Promise<"not_found" | "already_inactive" | "sku_conflict" | "success"> => {
    const product = await findSingleProduct(uuid);
    if (!product) return "not_found";
    if (product.status === ProductStatus.INACTIVE) return "already_inactive";

    // sku unchanged → drop it from the update so the unique check never fires for it
    const { sku, ...rest } = body;
    const updateBody = sku !== undefined && sku === product.sku ? rest : body;

    try {
        await updateProduct(uuid, updateBody);
        return "success";
    } catch (err) {
        if(err instanceof DatabaseError && err.code === "UNIQUE_VIOLATION"){
            return "sku_conflict";
        }
        throw err; // unexpected → bubble up to global handler
    }
};