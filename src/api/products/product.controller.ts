import type {Request, Response, NextFunction} from "express"
import type { GetProductQuery, PostProductBody } from "./product.schema.js"
import { listProducts, addProduct, getProductDetails, removeProduct } from "./product.service.js";
import type { IProductPublic } from "../../db/models/product.model.js";

export const listProductsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const params = res.locals["validatedQuery"] as GetProductQuery;
    const result = await listProducts(params);
    const publicProduct: IProductPublic[] = result.data.map(({id, ...rest}) => rest)
    res.json({
        success: true,
        data: publicProduct,
        meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
        }
    })
}

export const addProductHandler = async (req: Request,res: Response, next: NextFunction): Promise<void> => {
    const reqBody = res.locals["validatedBody"] as PostProductBody;
    console.log("reqBody", reqBody);
    const inserted: boolean = await addProduct(reqBody);
    if(!inserted) {
        res.status(409).json({
            success: false,
            error: {
                code: "SKU_ALREADY_EXISTS",
                message: `SKU ${reqBody.sku} already exists`
            }
        })
        return;
    }
    res.status(201).json({
        success: true,
        message: "Product successfully added."
    })
}

export const productDetailsHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const productDetials = await getProductDetails(uuid)
    if(!productDetials) {
        res.status(409).json({
            success: false,
            message: "Product Not Found!"
        })
        return;
    }
    const {id, ...rest} = productDetials;

    res.json({
        success: true,
        message: "Product Detials",
        data: rest
    })
}

export const productDeleteHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    console.log(uuid, "uuid");
    const deleteResponse = await removeProduct(uuid);
    switch (deleteResponse) {
        case "not_found": {
            res.status(409).json({
                success: false,
                message: "Product not found!",
            })
            return;
        }
        case "already_inactive": {
            res.status(409).json({
                success: false,
                message: "This Product is already Inactive.",
            })
            return;
        }
        case "success": {
            res.status(200).json({
                success: true,
                message: "Product Deactivated Successfully."
            })
        }
    }
}