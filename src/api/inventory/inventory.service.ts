import { inventoryMovementQuerySchema, type GetInventoryQuery, type InventoryMovementQueryBody, type RestockBody } from "./inventory.schema.js";
import { findManyInventories, getAllInventoryMovementByProductId, restockInventoryStock } from "./inventory.repository.js";
import type { IInventory } from "../../db/models/inventory.model.js";
import { findSingleProduct } from "../products/product.repository.js";
import { ProductStatus } from "../../db/models/product.model.js";
import type { IInventoryMovement, IInventoryMovementPublic } from "../../db/models/inventory_movement.model.js";

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

export const restockInventory = async(product_uuid: string, reqBody: RestockBody): Promise<"NOT_FOUND" | "SUCCESS"> => {
    const product = await findSingleProduct(product_uuid);
    if(!product) return "NOT_FOUND";
    const restock = await restockInventoryStock(product.id, reqBody)
    return "SUCCESS";
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