import "dotenv/config"; // first line of app.ts, before anything else

import env from "./env.js"
import pg from "pg"

export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,        // maximum connections
    idleTimeoutMillis: 30000,    // close idle connections after 30s
    connectionTimeoutMillis: 2000, // fail fast if can't connect in 2s
    ssl: env.NODE_ENV === "production" 
        ? { rejectUnauthorized: false }  // ← Render requires this
        : false 
});


// test connection at startup
pool.on("error", (err) => {
    console.error("Unexpected database error", err);
    process.exit(1);
});

export const connectDB = async (): Promise<void> => {
    const client = await pool.connect();
    console.log("✅ Database connected");
    client.release(); // release immediately — just testing
};