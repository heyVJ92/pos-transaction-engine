import type { GetInventoryQuery, PostInventoryBody } from "./inventory.schema.js";
import { findManyInventories } from "./inventory.repository.js";
import type { IInventory } from "../../db/models/inventory.model.js";
import { findSingleProduct } from "../products/product.repository.js";
import { ProductStatus } from "../../db/models/product.model.js";

interface InventoryPage {
    data: IInventory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export const getAllInventoris = async (params: GetInventoryQuery): Promise<InventoryPage> => {
    const {data, total} = await findManyInventories(params);
    return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit)
    }
}

// export const addInventory = async({product_uuid, availableStock}: PostInventoryBody): Promise<"not_found" | "product_inactive" | "already_mapped" | "success"> => {
//     const product = await findSingleProduct(product_uuid);
//     if(!product) return "not_found"
//     if(product.status === ProductStatus.INACTIVE) return "product_inactive"

//     return await addNewInventory(product.id, availableStock);
// }