export enum CounterSessionStatus {
    OPEN = "open",
    CLOSED = "closed"
}

// Enriched — counter and cashier joined, internal IDs never exposed
export interface ICounterSession {
    id: number;
    uuid: string;
    counterId: number;
    counter: {
        uuid: string;
        name: string;
        code: string;
    };
    userId: number;
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

export type ICounterSessionPublic = Omit<ICounterSession, "id" | "counterId" | "userId">;
