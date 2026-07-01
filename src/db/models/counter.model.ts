export enum CounterStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}

export interface ICounter {
    id: number;
    uuid: string;
    name: string;
    code: string;
    status: CounterStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type ICounterPublic = Omit<ICounter, "id">;
