import { runCounterSeeder } from "./counters.seeder.js";
import { runProductSeeder } from "./products.seeder.js";
import { runUserSeeder } from "./users.seeder.js";

const runSeeders = async () => {
  await runUserSeeder();
  await runProductSeeder();
  await runCounterSeeder();
  console.log("✅ All seeders complete");
  process.exit(0);
};

runSeeders().catch((err) => {
  console.error("❌ Seeder failed:", err);
  process.exit(1);
});
