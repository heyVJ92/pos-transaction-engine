export enum CounterSessionStatus {
    OPEN = "open",
    CLOSED = "closed"
}

// Enriched resource (API_PATTERNS.md §13) — counter/cashier are JOINed in,
// never the raw internal counter_id/user_id.
export interface ICounterSession {
    id: number;
    uuid: string;
    counter: {
        uuid: string;
        name: string;
        code: string;
    };
    cashier: {
        uuid: string;
        firstName: string;
        lastName: string;
    };
    openingBalance: number;
    closingBalance: number | null;
    totalOrders: number;
    totalAmount: number;
    status: CounterSessionStatus;
    openedAt: Date;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export type ICounterSessionPublic = Omit<ICounterSession, "id">;
