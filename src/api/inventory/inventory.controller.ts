import type { Request, Response, NextFunction } from "express";
import { getAllInventoris } from "./inventory.service.js"
// import { getAllInventoris, addInventory } from "./inventory.service.js"
import { sendError, sendPaginated, sendSuccess } from "../../utils/response.js";
import type { IInventoryPublic } from "../../db/models/inventory.model.js";
import type { PostInventoryBody } from "./inventory.schema.js";

export const listInventoriesHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const query = res.locals["validatedQuery"];
    console.log("----------------------------->", req.url);
    const {data, ...metaData} = await getAllInventoris(query);
    const inventoryPublicData: IInventoryPublic[] = data.map(({id, productId, ...rest}) => rest);
    sendPaginated(
        res,
        "Inventory List succussfully fetched.",
        inventoryPublicData,
        metaData
    )
}

// export const addInventoryHandler = async (req: Request,res: Response,next: NextFunction): Promise<void> => {
//     const reqBody = res.locals["validatedBody"] as PostInventoryBody
//     const addResponse = await addInventory(reqBody);
//     switch (addResponse) {
//         case "not_found":
//             sendError(res, "PRODUCT_NOT_FOUND", "Product not found", 404);
//             return;
//         case "product_inactive":
//             sendError(res, "PRODUCT_INACTIVE", "Product is inactive", 409);
//             return;
//         case "already_mapped":
//             sendError(res, "ALREADY_EXISTED", "This product already mapping with Inventory.", 409);
//             return;
//         case "success":
//             sendSuccess(res, "Inventory successfully added.");
//             return;
//     }
// }
