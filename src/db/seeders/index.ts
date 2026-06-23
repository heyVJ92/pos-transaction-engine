import { runUserSeeder } from "./users.seeder.js";

const runSeeders = async () => {
  await runUserSeeder();
  console.log("✅ All seeders complete");
  process.exit(0);
};

runSeeders().catch((err) => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
