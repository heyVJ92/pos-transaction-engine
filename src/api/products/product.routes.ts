import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { getProductQuerySchema, addProductBodySchema, uuidParamSchema, updateProductBodySchema } from "./product.schema.js";
import { listProductsHandler, addProductHandler, productDetailsHandler, productDeleteHandler, productUpdateHandler } from "./product.controller.js";

const productRouter = Router();
productRouter.get(
  "/",
  validateQuery(getProductQuerySchema, "query"),
  listProductsHandler,
);

productRouter.post(
  "/",
  validateQuery(addProductBodySchema, "body"),
  addProductHandler,
)

productRouter.get(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  productDetailsHandler
)

productRouter.delete(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  productDeleteHandler
)

productRouter.put(
  "/:uuid",
  validateQuery(uuidParamSchema, "params"),
  validateQuery(updateProductBodySchema, "body"),
  productUpdateHandler
)

export default productRouter;
