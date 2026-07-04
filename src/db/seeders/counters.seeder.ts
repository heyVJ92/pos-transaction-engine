import {CounterStatus} from "../models/counter.model.js"
import {pool} from "../../config/database.js"
export const counterSeederSql = `
    INSERT INTO  counters (name, code, status) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING
`

const values = [
    {
        name: "Counter 1",
        code: "C01",
        status: CounterStatus.INACTIVE
    },
    {
        name: "Counter 2",
        code: "C02",
        status: CounterStatus.INACTIVE
    }
]

export const runCounterSeeder = async () => {
    for (const counter of values) {
        await pool.query(counterSeederSql, Object.values(counter) );
    }
}