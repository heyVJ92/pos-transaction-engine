import {UserStatus, UserRole} from "../models/user.model.js"
import {pool} from "../../config/database.js"
import { SALT_ROUNDS } from "../../utils/constants.js"
import bcrypt from "bcrypt"
export const userSeederSql = `
    INSERT INTO  users (first_name, last_name, email, role, status, password_hash) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING
`

const values = [
    {
        first_name: "Vijay",
        last_name: "Singh",
        email: "vsingh@gmail.com",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        password: "admin@123"

    },
    {
        first_name: "Ajay",
        last_name: "Singh",
        email: "asingh@gmail.com",
        role: UserRole.CASHIER,
        status: UserStatus.ACTIVE,
        password: "cashier@123"
    }
]

export const runUserSeeder = async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN")
        for (const user of values) {
            const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS)
            await client.query(userSeederSql, [user.first_name, user.last_name, user.email, user.role, user.status, hashedPassword] );
        }
        await client.query("COMMIT");
        console.log("✅ Users seeder complete");
    } catch (error) {
        await client.query("ROLLBACK")
        throw error;
    } finally {
        client.release()
    }
}