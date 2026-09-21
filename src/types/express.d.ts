// src/types/express.d.ts
import type { UserRole } from "../db/models/user.model.js";

declare global {
    namespace Express {
      interface Request {
        user?: {
          id: number;
          role: UserRole;
        };
      }
    }
  }

  export {};