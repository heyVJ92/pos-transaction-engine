import type {Request, Response, NextFunction} from "express"
import type { GetProductQuery, PostProductBody } from "./product.schema.js"
import { listProducts, addProduct } from "./product.service.js";
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