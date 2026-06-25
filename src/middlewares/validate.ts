import type { Request, Response, NextFunction } from "express";
import * as z from "zod";

type ValidateTarget = "body" | "query"
export function validateQuery(schema: z.ZodTypeAny, target: ValidateTarget = "query") {
    return (req: Request, res: Response, next: NextFunction): void => {
        const data = target === "body" ? req.body : req.query;  
        console.log(data);
        const parsed = schema.safeParse(data);
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
        console.log("parsed.data",parsed.data);
        if(target === "body") {
            res.locals["validatedBody"] = parsed.data; 
        } else {
            res.locals["validatedQuery"] = parsed.data;
        }

        next();
    };
}
