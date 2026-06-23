import type { GetUsersQuery } from "./user.schema.js";
import type { IUser } from "../../db/models/user.model.js";
import { findManyUsers } from "./user.repository.js";

export interface UsersPage {
  users: IUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listUsers(params: GetUsersQuery): Promise<UsersPage> {
  const { users, total } = await findManyUsers(params);

  return {
    users,
    total,
    page:       params.page,
    limit:      params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}