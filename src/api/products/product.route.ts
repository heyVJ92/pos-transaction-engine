import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { getProductQuerySchema, addProductBodySchema, uuidParamSchema } from "./product.schema.js";
import { listProductsHandler, addProductHandler, productDetailsHandler, productDeleteHandler } from "./product.controller.js";

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

export default productRouter;
