import type {Request, Response, NextFunction} from "express"
import type { GetProductQuery, PostProductBody, UpdateProductBody } from "./product.schema.js"
import { listProducts, addProduct, getProductDetails, removeProduct, updateProductByUUID } from "./product.service.js";
import type { IProductPublic } from "../../db/models/product.model.js";
import { sendCreated, sendError, sendPaginated, sendSuccess } from "../../utils/response.js";

export const listProductsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const params = res.locals["validatedQuery"] as GetProductQuery;
    const result = await listProducts(params);
    const publicProduct: IProductPublic[] = result.data.map(({id, ...rest}) => rest)
    sendPaginated(
        res,
        "Product fetched successfully",
        publicProduct,
        {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
        }
    )
}

export const addProductHandler = async (req: Request,res: Response, next: NextFunction): Promise<void> => {
    const reqBody = res.locals["validatedBody"] as PostProductBody;
    const inserted: boolean = await addProduct(reqBody);
    if(!inserted) {
        sendError(res, "SKU_ALREADY_EXISTS", `SKU ${reqBody.sku} already exists`, 409);
        return;
    }
    sendCreated(res, "Product successfully added.")
}

export const productDetailsHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const productDetials = await getProductDetails(uuid)
    if(!productDetials) {
        sendError(res, "NOT_FOUND", `Product Not Found!`, 404);
        return;
    }
    const {id, ...data} = productDetials;
    sendSuccess(res, `Product detials fetched successfully.`, data);
}

export const productDeleteHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const deleteResponse = await removeProduct(uuid);
    switch (deleteResponse) {
        case "not_found": {
            sendError(res, "NOT_FOUND", `Product Not Found!`, 404);
            return;
        }
        case "already_inactive": {
            sendError(res, "ALREADY_INACTIVE", `This Product is already Inactive!`, 409);
            return;
        }
        case "success": {
            sendSuccess(res, `Product Deactivated Successfully.`);
            return;
        }
    }
}


export const productUpdateHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const body = res.locals["validatedBody"] as UpdateProductBody;

    const updateResponse = await updateProductByUUID(uuid, body);
    switch (updateResponse) {
        case "not_found": {
            sendError(res, "NOT_FOUND", `Product Not Found!`, 404);
            return;
        }
        case "already_inactive": {
            sendError(res, "ALREADY_INACTIVE", `Can't update an inactive product!`, 409);
            return;
        }
        case "sku_conflict": {
            sendError(res, "SKU_ALREADY_EXISTS", `SKU already exists!`, 409);
            return;
        }
        case "success": {
            sendSuccess(res, `Product updated Successfully.`);
            return;
        }
    }
}