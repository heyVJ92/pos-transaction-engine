import { CounterStatus, type ICounter } from "../../db/models/counter.model.js";
import { DatabaseError } from "../../utils/db-errors.js";
import { findManyCounters, addNewCounter, findSingleCounter, setCounterInactive, updateCounter } from "./counter.repository.js";
import type { GetCounterQuery, PostCounterBody, UpdateCounterBody } from "./counter.schema.js";


interface CountersPage {
    data: ICounter[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function listCounters(params: GetCounterQuery): Promise<CountersPage> {
    const {data, total} = await findManyCounters(params);
    return {
        data,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit)
    }
}

export const addCounter = async(body: PostCounterBody): Promise<boolean> => {
    return await addNewCounter(body)
}

export const getCounterDetails = async(uuid: string): Promise<ICounter | null> => {
    const result = await findSingleCounter(uuid)
    return result
}

export const removeCounter = async (uuid: string): Promise<"not_found" | "already_inactive" | "success"> => {
    const counter = await findSingleCounter(uuid);
    if (!counter) return "not_found";
    if (counter.status === CounterStatus.INACTIVE) return "already_inactive";

    const result = await setCounterInactive(uuid);

    return result ? "success" : "not_found";
};

export const updateCounterByUUID = async (uuid: string, body: UpdateCounterBody): Promise<"not_found" | "already_inactive" | "code_conflict" | "success"> => {
    const counter = await findSingleCounter(uuid);
    if (!counter) return "not_found";

    // Only reactivation (status: "active") is allowed on an inactive counter — everything else
    // (rename/re-code without reactivating) still requires it to already be active.
    const isReactivating = body.status === CounterStatus.ACTIVE;
    if (counter.status === CounterStatus.INACTIVE && !isReactivating) return "already_inactive";

    try {
        const result = await updateCounter(uuid, body);
        return result ? "success" : "not_found";
    } catch (err) {
        if(err instanceof DatabaseError && err.code === "UNIQUE_VIOLATION"){
            return "code_conflict";
        }
        throw err; // unexpected → bubble up to global handler
    }
};
