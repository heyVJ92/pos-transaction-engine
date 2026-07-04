import {pool} from "../config/database.js"
import fs from "fs/promises";
export const ensureMigrationsTable  = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS migrations_history (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}

export const alreadyRunMigrations = async () => {
    const {rows: files} = await pool.query(`SELECT name FROM migrations_history`)
    return files.map(el => el.name)
}

export const migrationFiles = async (path: string) => {
    const files = await fs.readdir(path);
    return files;
};

export const runMigration = async () => {
    await ensureMigrationsTable();
    const migrationFolderFiles = await migrationFiles("./src/db/migrations");
    const alreadyMigratedFiles = new Set(await alreadyRunMigrations());

    const newFiles = migrationFolderFiles.filter(filename => !alreadyMigratedFiles.has(filename)).sort()
    console.log("newFiles", newFiles);
    // to-do
    // run migration logic
    for(let file of newFiles) {
        await migrationTransaction(file)
    }
    console.log("✅ Migrations complete");
    process.exit(0);
}

export const migrationTransaction = async (filename: string) => {
    const client = await pool.connect();
    const migrationFile = await import(`./migrations/${filename}`);
    try {
        await client.query("BEGIN");
        await client.query(migrationFile.up);
        await client.query(
            "INSERT INTO migrations_history (name) VALUES ($1)",
            [filename]
        );
        await client.query("COMMIT");           // same connection
    } catch (err) {
        await client.query("ROLLBACK");         // same connection
        throw err;
    } finally {
        client.release()
    }
}

runMigration().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});

