import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code:    "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }
    res.locals["validatedQuery"] = parsed.data;
    next();
  };
}