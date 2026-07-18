import { inventoryMovementQuerySchema, type InventoryMovementQueryBody, type RestockBody } from "./inventory.schema.js";
import { getAllInventoryMovementByProductId, restockInventoryStock } from "./inventory.repository.js";
import { findSingleProduct } from "../products/product.repository.js";
import { ProductStatus } from "../../db/models/product.model.js";
import type { IInventoryMovement, IInventoryMovementPublic } from "../../db/models/inventory_movement.model.js";

export const restockInventory = async(product_uuid: string, reqBody: RestockBody): Promise<"NOT_FOUND" | "SUCCESS"> => {
    const product = await findSingleProduct(product_uuid);
    if(!product) return "NOT_FOUND";
    const restock = await restockInventoryStock(product.id, reqBody)
    return restock ? "SUCCESS" : "NOT_FOUND";
}


interface InventoryMovementPage {
    data: IInventoryMovement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const getAllInventoryMovement = async (product_uuid: string, params: InventoryMovementQueryBody): Promise<InventoryMovementPage | "NOT_FOUND"> => {
    const product = await findSingleProduct(product_uuid);
    if(!product) return "NOT_FOUND";
    const {data, total} = await getAllInventoryMovementByProductId(product.id, params);
    return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit)
    }
}