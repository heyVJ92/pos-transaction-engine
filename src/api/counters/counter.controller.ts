import type {Request, Response, NextFunction} from "express"
import type { GetCounterQuery, PostCounterBody, UpdateCounterBody } from "./counter.schema.js"
import { listCounters, addCounter, getCounterDetails, removeCounter, updateCounterByUUID } from "./counter.service.js";
import type { ICounterPublic } from "../../db/models/counter.model.js";
import { sendCreated, sendError, sendPaginated, sendSuccess } from "../../utils/response.js";

export const listCountersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const params = res.locals["validatedQuery"] as GetCounterQuery;
    const result = await listCounters(params);
    const publicCounter: ICounterPublic[] = result.data.map(({id, ...rest}) => rest)
    sendPaginated(
        res,
        "Counter fetched successfully",
        publicCounter,
        {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
        }
    )
}

export const addCounterHandler = async (req: Request,res: Response, next: NextFunction): Promise<void> => {
    const reqBody = res.locals["validatedBody"] as PostCounterBody;
    const inserted: boolean = await addCounter(reqBody);
    if(!inserted) {
        sendError(res, "CODE_ALREADY_EXISTS", `Code ${reqBody.code} already exists`, 409);
        return;
    }
    sendCreated(res, "Counter successfully added.")
}

export const counterDetailsHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const counterDetials = await getCounterDetails(uuid)
    if(!counterDetials) {
        sendError(res, "NOT_FOUND", `Counter Not Found!`, 404);
        return;
    }
    const {id, ...data} = counterDetials;
    sendSuccess(res, `Counter detials fetched successfully.`, data);
}

export const counterDeleteHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const deleteResponse = await removeCounter(uuid);
    switch (deleteResponse) {
        case "not_found": {
            sendError(res, "NOT_FOUND", `Counter Not Found!`, 404);
            return;
        }
        case "already_inactive": {
            sendError(res, "ALREADY_INACTIVE", `This Counter is already Inactive!`, 409);
            return;
        }
        case "success": {
            sendSuccess(res, `Counter Deactivated Successfully.`);
            return;
        }
    }
}


export const counterUpdateHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const body = res.locals["validatedBody"] as UpdateCounterBody;

    const updateResponse = await updateCounterByUUID(uuid, body);
    switch (updateResponse) {
        case "not_found": {
            sendError(res, "NOT_FOUND", `Counter Not Found!`, 404);
            return;
        }
        case "already_inactive": {
            sendError(res, "ALREADY_INACTIVE", `Can't update an inactive counter!`, 409);
            return;
        }
        case "code_conflict": {
            sendError(res, "CODE_ALREADY_EXISTS", `Code already exists!`, 409);
            return;
        }
        case "success": {
            sendSuccess(res, `Counter updated Successfully.`);
            return;
        }
    }
}
