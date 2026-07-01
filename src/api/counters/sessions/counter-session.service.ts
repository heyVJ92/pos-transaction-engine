import { CounterSessionStatus, type ICounterSession } from "../../../db/models/counter_session.model.js";
import { CounterStatus } from "../../../db/models/counter.model.js";
import { findSingleCounter } from "../counter.repository.js";
import { findSingleUser } from "../../users/user.repository.js";
import { findManyCounterSessions, addNewCounterSession, findSingleCounterSession, setCounterSessionClosed, updateCounterSession } from "./counter-session.repository.js";
import type { GetCounterSessionQuery, PostCounterSessionBody, UpdateCounterSessionBody } from "./counter-session.schema.js";


interface CounterSessionsPage {
    data: ICounterSession[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function listCounterSessions(params: GetCounterSessionQuery): Promise<CounterSessionsPage> {
    const {data, total} = await findManyCounterSessions(params);
    return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit)
    }
}

export const addCounterSession = async(body: PostCounterSessionBody): Promise<"counter_not_found" | "counter_inactive" | "user_not_found" | "success"> => {
    // client sends uuid, resolve to internal id before touching the DB (API_PATTERNS.md §12)
    const counter = await findSingleCounter(body.counterUuid);
    if (!counter) return "counter_not_found";
    if (counter.status === CounterStatus.INACTIVE) return "counter_inactive";

    const user = await findSingleUser(body.userUuid);
    if (!user) return "user_not_found";

    await addNewCounterSession(counter.id, user.id, body.openingBalance);
    return "success";
}

export const getCounterSessionDetails = async(uuid: string): Promise<ICounterSession | null> => {
    const result = await findSingleCounterSession(uuid)
    return result
}

export const removeCounterSession = async (uuid: string): Promise<"not_found" | "already_inactive" | "success"> => {
    const counterSession = await findSingleCounterSession(uuid);
    if (!counterSession) return "not_found";
    if (counterSession.status === CounterSessionStatus.CLOSED) return "already_inactive";

    await setCounterSessionClosed(uuid);

    return "success";
};

export const updateCounterSessionByUUID = async (uuid: string, body: UpdateCounterSessionBody): Promise<"not_found" | "already_inactive" | "success"> => {
    const counterSession = await findSingleCounterSession(uuid);
    if (!counterSession) return "not_found";
    if (counterSession.status === CounterSessionStatus.CLOSED) return "already_inactive";

    await updateCounterSession(uuid, body);
    return "success";
};
