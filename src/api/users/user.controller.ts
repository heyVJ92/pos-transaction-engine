import type { Request, Response, NextFunction } from "express";
import type { GetUsersQuery, UpdateSelfBody } from "./user.schema.js";
import { listUsers, getCurrentUser, updateCurrentUser } from "./user.service.js";
import type { IUserPublic } from "../../db/models/user.model.js";
import { sendError, sendPaginated, sendSuccess } from "../../utils/response.js";

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

// requireAuth (mounted on the whole /users router in api/index.ts) guarantees req.user is set —
// the "!" here is safe, not a bypass.
export const getCurrentUserHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = await getCurrentUser(req.user!.id);
  if (!user) {
    sendError(res, "NOT_FOUND", "User not found.", 404);
    return;
  }
  sendSuccess(res, "Current user fetched successfully.", user);
}

export const updateCurrentUserHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const body = res.locals["validatedBody"] as UpdateSelfBody;
  const result = await updateCurrentUser(req.user!.id, body);
  switch (result) {
    case "not_found": {
      sendError(res, "NOT_FOUND", "User not found.", 404);
      return;
    }
    case "success": {
      sendSuccess(res, "Profile updated successfully.");
      return;
    }
  }
}