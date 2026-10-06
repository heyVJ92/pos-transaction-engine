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

// Email is deliberately not self-editable here — no re-authentication step exists for changing
// it, and stockapi's login lookup is keyed on it. Add it back only alongside that decision.
export const updateSelfBodySchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName:  z.string().min(1).max(255).optional(),
}).strict();

export type UpdateSelfBody = z.infer<typeof updateSelfBodySchema>;