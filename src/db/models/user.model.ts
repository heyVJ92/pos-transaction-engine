export enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}

export enum UserRole {
    ADMIN = "admin",
    CASHIER = "cashier"
}


export interface IUser {
    id: number;
    uuid: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date
}

export type IUserPublic = Omit<IUser, "id">;