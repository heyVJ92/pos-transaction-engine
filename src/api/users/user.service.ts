import type { GetUsersQuery, UpdateSelfBody } from "./user.schema.js";
import type { IUser, IUserPublic } from "../../db/models/user.model.js";
import { findManyUsers, findUserById, updateUserById } from "./user.repository.js";

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

export const getCurrentUser = async (userId: number): Promise<IUserPublic | null> => {
  const user = await findUserById(userId);
  if (!user) return null;
  const { id, passwordHash, lashLoginAt, ...publicUser } = user;
  return publicUser;
};

export const updateCurrentUser = async (
  userId: number,
  body: UpdateSelfBody,
): Promise<"not_found" | "success"> => {
  const updated = await updateUserById(userId, body);
  return updated ? "success" : "not_found";
};