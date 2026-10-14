import { sql } from "drizzle-orm";
import { db, pool } from "../db";

db.execute(sql`select current_database() as db, version() as v`)
  .then((r) => console.log(r.rows[0]))
  .finally(() => pool.end());
