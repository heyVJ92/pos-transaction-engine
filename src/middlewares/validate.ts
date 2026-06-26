import type { Request, Response, NextFunction } from "express";
import * as z from "zod";

type ValidateTarget = "body" | "query" | "params"
export function validateQuery(schema: z.ZodTypeAny, target: ValidateTarget = "query") {
    return (req: Request, res: Response, next: NextFunction): void => {
        const data = target === "body" ? req.body : target === "params" ? req.params : req.query;  
        console.log(data);
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                error: {
                    code:    "VALIDATION_ERROR",
                    message: `Invalid ${target} parameters`,
                    details: z.treeifyError(parsed.error),
                },
            });
            return;
        }
        if(target === "body") {
            res.locals["validatedBody"] = parsed.data; 
        } else if (target === "params") {
            res.locals["validatedParams"] = parsed.data;
        } else {
            res.locals["validatedQuery"] = parsed.data;
        }
        let {validatedParams: params, validatedBody: body, validatedQuery: query} = res.locals
        console.log(params, "----params");
        console.log(body, "----body");
        console.log(query, "----query");
        next();
    };
}
