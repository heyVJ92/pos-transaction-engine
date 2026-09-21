import { Router } from "express";
import { validateQuery } from "../../middlewares/validate.js";
import { accessCheck } from "../../middlewares/auth.middleware.js";
import { UserRole } from "../../db/models/user.model.js";
import { getProductQuerySchema, addProductBodySchema, uuidParamSchema, updateProductBodySchema } from "./product.schema.js";
import { listProductsHandler, addProductHandler, productDetailsHandler, productStatusToggleHandler, productUpdateHandler } from "./product.controller.js";

const productRouter = Router();
productRouter.get(
  "/",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(getProductQuerySchema, "query"),
  listProductsHandler,
);

productRouter.post(
  "/",
  accessCheck([UserRole.ADMIN]),
  validateQuery(addProductBodySchema, "body"),
  addProductHandler,
)

productRouter.get(
  "/:uuid",
  accessCheck([UserRole.ADMIN, UserRole.CASHIER]),
  validateQuery(uuidParamSchema, "params"),
  productDetailsHandler
)

productRouter.put(
  "/:uuid/status",
  accessCheck([UserRole.ADMIN]),
  validateQuery(uuidParamSchema, "params"),
  productStatusToggleHandler
)

productRouter.put(
  "/:uuid",
  accessCheck([UserRole.ADMIN]),
  validateQuery(uuidParamSchema, "params"),
  validateQuery(updateProductBodySchema, "body"),
  productUpdateHandler
)

export default productRouter;
