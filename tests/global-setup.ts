import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export default async function setup() {
  if (!process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: "db/migrations" });
  await pool.end();
}
