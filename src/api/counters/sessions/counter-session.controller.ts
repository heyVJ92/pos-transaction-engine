import type {Request, Response, NextFunction} from "express"
import type { GetCounterSessionQuery, PostCounterSessionBody, UpdateCounterSessionBody } from "./counter-session.schema.js"
import { listCounterSessions, addCounterSession, getCounterSessionDetails, removeCounterSession, updateCounterSessionByUUID } from "./counter-session.service.js";
import type { ICounterSessionPublic } from "../../../db/models/counter_session.model.js";
import { sendCreated, sendError, sendPaginated, sendSuccess } from "../../../utils/response.js";

export const listCounterSessionsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const params = res.locals["validatedQuery"] as GetCounterSessionQuery;
    const result = await listCounterSessions(params);
    const publicCounterSession: ICounterSessionPublic[] = result.data.map(({id, ...rest}) => rest)
    sendPaginated(
        res,
        "Counter session fetched successfully",
        publicCounterSession,
        {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
        }
    )
}

export const addCounterSessionHandler = async (req: Request,res: Response, next: NextFunction): Promise<void> => {
    const reqBody = res.locals["validatedBody"] as PostCounterSessionBody;
    const addResponse = await addCounterSession(reqBody);
    switch (addResponse) {
        case "counter_not_found": {
            sendError(res, "COUNTER_NOT_FOUND", `Counter Not Found!`, 404);
            return;
        }
        case "counter_inactive": {
            sendError(res, "COUNTER_INACTIVE", `Can't open a session on an inactive counter!`, 409);
            return;
        }
        case "user_not_found": {
            sendError(res, "USER_NOT_FOUND", `User Not Found!`, 404);
            return;
        }
        case "success": {
            sendCreated(res, "Counter session successfully opened.");
            return;
        }
    }
}

export const counterSessionDetailsHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const counterSessionDetials = await getCounterSessionDetails(uuid)
    if(!counterSessionDetials) {
        sendError(res, "NOT_FOUND", `Counter Session Not Found!`, 404);
        return;
    }
    const {id, ...data} = counterSessionDetials;
    sendSuccess(res, `Counter session detials fetched successfully.`, data);
}

export const counterSessionDeleteHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const deleteResponse = await removeCounterSession(uuid);
    switch (deleteResponse) {
        case "not_found": {
            sendError(res, "NOT_FOUND", `Counter Session Not Found!`, 404);
            return;
        }
        case "already_inactive": {
            sendError(res, "ALREADY_INACTIVE", `This Counter Session is already Closed!`, 409);
            return;
        }
        case "success": {
            sendSuccess(res, `Counter Session Closed Successfully.`);
            return;
        }
    }
}


export const counterSessionUpdateHandler = async(req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uuid = res.locals["validatedParams"].uuid as string;
    const body = res.locals["validatedBody"] as UpdateCounterSessionBody;

    const updateResponse = await updateCounterSessionByUUID(uuid, body);
    switch (updateResponse) {
        case "not_found": {
            sendError(res, "NOT_FOUND", `Counter Session Not Found!`, 404);
            return;
        }
        case "already_inactive": {
            sendError(res, "ALREADY_INACTIVE", `Can't update a closed counter session!`, 409);
            return;
        }
        case "success": {
            sendSuccess(res, `Counter Session updated Successfully.`);
            return;
        }
    }
}
