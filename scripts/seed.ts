// Usage: npm run db:seed [-- --force]
import { count } from "drizzle-orm";
import { db, pool } from "../db";
import { tableSessions } from "../db/schema";
import { seedDatabase } from "../db/seed";

async function main() {
  const [{ n }] = await db.select({ n: count() }).from(tableSessions);
  if (n > 0 && !process.argv.includes("--force")) {
    console.error(`Refusing to seed: ${n} bills exist and would be deleted. Re-run with --force to wipe them.`);
    process.exitCode = 1;
    return;
  }
  await seedDatabase(db);
  console.log("Seeded tables and menu.");
}

main().finally(() => pool.end());
