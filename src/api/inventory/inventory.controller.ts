import type { Request, Response, NextFunction } from "express";
import { getAllInventoris, getAllInventoryMovement, restockInventory } from "./inventory.service.js"
import { sendError, sendPaginated, sendSuccess } from "../../utils/response.js";
import type { IInventoryPublic } from "../../db/models/inventory.model.js";
import type { InventoryMovementQueryBody, RestockBody } from "./inventory.schema.js";
import type { IInventoryMovementPublic } from "../../db/models/inventory_movement.model.js";

export const listInventoriesHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const query = res.locals["validatedQuery"];
    const {data, ...metaData} = await getAllInventoris(query);
    const inventoryPublicData: IInventoryPublic[] = data.map(({id, productId, ...rest}) => rest);
    sendPaginated(
        res,
        "Inventory List succussfully fetched.",
        inventoryPublicData,
        metaData
    )
}

export const restockHandler = async(req: Request,res: Response,next: NextFunction): Promise<void> => {
    const product_uuid = res.locals["validatedParams"].product_uuid;
    const reqBody = res.locals["validatedBody"] as RestockBody;
    const result = await restockInventory(product_uuid, reqBody);
    switch(result) {
        case "NOT_FOUND":
            sendError(res, "PRODUCT_NOT_FOUND", "Product not found", 404);
            return;
        case "SUCCESS":
            sendSuccess(res, "Stock updated successfully.");
            return;
    }
}
export const movementsListHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const product_uuid = res.locals["validatedParams"].product_uuid;
    const query = res.locals["validatedQuery"] as InventoryMovementQueryBody;
    const result = await getAllInventoryMovement(product_uuid, query);
    if(result === "NOT_FOUND"){
        sendError(res, "PRODUCT_NOT_FOUND", "Product not found", 404);
        return;
    }
    const {data, ...metaData} = result;
    const inventoryPublicData: IInventoryMovementPublic[] = data.map(({id, productId, orderId, ...rest}) => rest);
    sendPaginated(
        res,
        "Inventory movements fetched successfully.",
        inventoryPublicData,
        metaData
    )
}