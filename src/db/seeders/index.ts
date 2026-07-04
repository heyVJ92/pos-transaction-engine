// src/db/seeders/index.ts

process.on("uncaughtException", (err) => {
  console.error("SEED ERROR:", err);
  process.exit(1);
});

const { runUserSeeder } = await import("./users.seeder.js");
const { runProductSeeder } = await import("./products.seeder.js");
const { runCounterSeeder } = await import("./counters.seeder.js");

try {
  await runUserSeeder();
  await runProductSeeder();
  await runCounterSeeder();
  console.log("✅ All seeders complete");
  process.exit(0);
} catch (err) {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
}