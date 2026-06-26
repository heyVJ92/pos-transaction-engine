import {type Response} from "express";

export const sendSuccess = (res: Response, message: string, data: unknown = null, statusCode: number = 200): void => {
   res.status(statusCode).json({
        success: true,
        message,
        data
   }) 
}

export const sendCreated = (res: Response, message: string, data: unknown = null): void => {
    sendSuccess(res, message, data, 201) // status code for POST created method: 201.
}

interface PaginationMeta  {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export const sendPaginated = (res: Response, message: string, data: unknown = null, meta: PaginationMeta): void => {
    res.status(200).json({ // status code for Get success: 200.
         success: true,
         message,
         data,
         meta
    })
 }

export const sendError = (res: Response, code: string, message: string, statusCode: number = 400): void => {
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message
        }
    })
}
