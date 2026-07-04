import * as z from "zod";  // use "import * as z" — matches project convention in env.ts
import { UserRole, UserStatus } from "../../db/models/user.model.js";

export const getUsersQuerySchema = z.object({
  role:   z.enum(UserRole).optional(),       // validates against TS enum
  status: z.enum(UserStatus).optional(),
  search: z.string().min(1).max(100).optional(),
  page:   z.coerce.number().int().min(1).default(1),  // coerce: query params are strings
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  sort:   z.enum(["created_at", "first_name", "last_name", "email"]).optional(), // allowlist only
  order:  z.enum(["asc", "desc"]).optional(),
}).strict();

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;