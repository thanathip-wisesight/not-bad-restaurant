import { sql } from "drizzle-orm";
import { MENU, TABLE_COUNT } from "../scripts/menu-data";
import { CATEGORIES } from "../lib/domain";
import type { Db } from "./index";
import { menuItems, menuOptions, tables } from "./schema";

// Wipes ALL data (including bill history) and loads tables + menu.
export async function seedDatabase(db: Db) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE order_items, tickets, cart_lines, table_sessions, menu_options, menu_items, tables RESTART IDENTITY CASCADE`,
    );
    await tx.insert(tables).values(Array.from({ length: TABLE_COUNT }, (_, i) => ({ number: i + 1 })));
    for (const category of CATEGORIES) {
      for (const [sort, [nameTh, nameEn, price, options = []]] of MENU[category].entries()) {
        const [item] = await tx.insert(menuItems).values({ category, sort, nameTh, nameEn, price }).returning();
        if (options.length)
          await tx.insert(menuOptions).values(options.map(([name, priceDelta]) => ({ menuItemId: item.id, name, priceDelta })));
      }
    }
  });
}
