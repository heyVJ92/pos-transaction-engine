import {UserStatus, UserRole} from "../models/user.model.js"
import {pool} from "../../config/database.js"
export const userSeederSql = `
    INSERT INTO  users (first_name, last_name, email, role, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING
`

const values = [
    {
        first_name: "Vijay",
        last_name: "Singh",
        email: "vsingh@gmail.com",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE
    },
    {
        first_name: "Ajay",
        last_name: "Singh",
        email: "asingh@gmail.com",
        role: UserRole.CASHIER,
        status: UserStatus.ACTIVE
    }
]

export const runUserSeeder = async () => {
    for (const user of values) {
        await pool.query(userSeederSql, Object.values(user) );
    }
}