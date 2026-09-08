import { pool } from "../../config/database.js";
import { UserRole, UserStatus } from "../../db/models/user.model.js";

interface UserCredentialsRow {
    id:            number;
    uuid:          string;
    password_hash: string;
    role:          string;
}

// Deliberately NOT reusing IUser/rowToUser from user.repository.ts — that
// type exists for public-facing responses and must never carry a password
// hash. This type and this query are auth-only; nothing outside
// auth.service.ts should ever import or return IUserWithCredentials.
export interface IUserWithCredentials {
    id:           number;  // used as the JWT sub — see utils/jwt.ts
    uuid:         string;
    passwordHash: string;
    role:         UserRole;
}

export const findActiveUserByEmail = async (email: string): Promise<IUserWithCredentials | null> => {
    const { rows } = await pool.query<UserCredentialsRow>(
        `SELECT id, uuid, password_hash, role
         FROM users
         WHERE email = $1 AND status = $2`,
        [email, UserStatus.ACTIVE]
    );

    const row = rows[0];
    if (!row) return null;

    return {
        id:           row.id,
        uuid:         row.uuid,
        passwordHash: row.password_hash,
        role:         row.role as UserRole,
    };
};