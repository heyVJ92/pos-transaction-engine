import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { getProductQuerySchema, addProductBodySchema } from "./product.schema.js";
import { listProductsHandler, addProductHandler } from "./product.controller.js";

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
export default productRouter;
