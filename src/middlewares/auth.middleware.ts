import type {Request, Response, NextFunction } from "express";

export const temporaryAuth = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    req.user = {
        id: 1,
        role: 'admin'
    };

    next();
};