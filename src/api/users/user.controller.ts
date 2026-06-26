import type { Request, Response, NextFunction } from "express";
import type { GetUsersQuery } from "./user.schema.js";
import { listUsers } from "./user.service.js";
import type { IUserPublic } from "../../db/models/user.model.js";
import { sendPaginated } from "../../utils/response.js";

export const listUsersHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const params = res.locals["validatedQuery"] as GetUsersQuery;
  const result = await listUsers(params)
  const publicUsers: IUserPublic[] = result.users.map(({id, ...rest}) => rest)

  sendPaginated(
    res,
    "Users fetched successfully.",
    publicUsers,
    {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }
  )
}