// Usage: npm run db:seed [-- --force | --users-only]
//   (no flag)     full seed on an empty database
//   --force       full seed that wipes existing bills and accounts
//   --users-only  non-destructive: add branches, tables, and staff accounts to an existing database
import { count } from "drizzle-orm";
import { db, pool } from "../db";
import { tableSessions } from "../db/schema";
import { seedDatabase, seedUsersOnly } from "../db/seed";

async function main() {
  if (process.argv.includes("--users-only")) {
    await seedUsersOnly(db);
    console.log("Upserted branches, tables, and staff accounts. Existing data untouched.");
    return;
  }
  const [{ n }] = await db.select({ n: count() }).from(tableSessions);
  if (n > 0 && !process.argv.includes("--force")) {
    console.error(
      `Refusing to seed: ${n} bills exist and would be deleted. Use --users-only to keep them, or --force to wipe them.`,
    );
    process.exitCode = 1;
    return;
  }
  await seedDatabase(db);
  console.log("Seeded branches, tables, menu, and staff accounts.");
}

main().finally(() => pool.end());
