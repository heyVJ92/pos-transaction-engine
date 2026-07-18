import { ProductStatus, type IProduct, type IProductDetail } from "../../db/models/product.model.js";
import { DatabaseError } from "../../utils/db-errors.js";
import { findManyProducts, addNewProduct, findSingleProduct, setProductStatus, updateProduct } from "./product.repository.js";
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

export const getProductDetails = async(uuid: string): Promise<IProductDetail | null> => {
    return await findSingleProduct(uuid)
}

export const changeStatusOfProduct = async (uuid: string): Promise<"not_found" | "activated" | "deactivated"> => {
    const product = await findSingleProduct(uuid);
    if (!product) return "not_found";
    const updateStatus = product.status === ProductStatus.INACTIVE ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;

    const updated = await setProductStatus(uuid, updateStatus);
    if(!updated) return "not_found"
    return updateStatus === ProductStatus.ACTIVE ? "activated" : "deactivated";
};

export const updateProductByUUID = async (uuid: string, body: UpdateProductBody): Promise<"not_found" | "already_inactive" | "sku_conflict" | "success"> => {
    const product = await findSingleProduct(uuid);
    if (!product) return "not_found";
    if (product.status === ProductStatus.INACTIVE) return "already_inactive";

    // sku unchanged → drop it from the update so the unique check never fires for it
    const { sku, ...rest } = body;
    const updateBody = sku !== undefined && sku === product.sku ? rest : body;

    try {
        const updated = await updateProduct(uuid, updateBody);
        return updated ? "success" : "not_found";
    } catch (err) {
        if(err instanceof DatabaseError && err.code === "UNIQUE_VIOLATION"){
            return "sku_conflict";
        }
        throw err; // unexpected → bubble up to global handler
    }
};