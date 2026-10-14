import { sql } from "drizzle-orm";
import { BRANCHES, MENU, STAFF } from "../scripts/menu-data";
import { CATEGORIES } from "../lib/domain";
import { hashPassword } from "../lib/password";
import type { Db, Tx } from "./index";
import { branches, menuItems, menuOptions, tables, userBranches, users } from "./schema";

// Wipes ALL data (including bill history and staff accounts) and loads branches, tables, menu, and staff.
export async function seedDatabase(db: Db) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`TRUNCATE staff_sessions, user_branches, users, order_items, tickets, cart_lines, table_sessions, menu_options, menu_items, tables, branches RESTART IDENTITY CASCADE`,
    );
    await upsertBranchesAndStaff(tx);
    for (const category of CATEGORIES) {
      for (const [sort, [nameTh, nameEn, price, options = []]] of MENU[category].entries()) {
        const [item] = await tx.insert(menuItems).values({ category, sort, nameTh, nameEn, price }).returning();
        if (options.length)
          await tx.insert(menuOptions).values(options.map(([name, priceDelta]) => ({ menuItemId: item.id, name, priceDelta })));
      }
    }
  });
}

// Non-destructive (design D8): adds missing branches, tables, users, and memberships; resets demo passwords.
// Never deletes, renumbers, or touches menu, sessions, carts, orders, or Bills. Safe to repeat.
export async function seedUsersOnly(db: Db) {
  await db.transaction((tx) => upsertBranchesAndStaff(tx));
}

async function upsertBranchesAndStaff(tx: Tx) {
  const branchIds = new Map<string, number>();
  for (const b of BRANCHES) {
    const [row] = await tx
      .insert(branches)
      .values({ code: b.code, name: b.name })
      .onConflictDoUpdate({ target: branches.code, set: { name: b.name } })
      .returning();
    branchIds.set(b.code, row.id);
    await tx
      .insert(tables)
      .values(Array.from({ length: b.tables }, (_, i) => ({ branchId: row.id, number: i + 1 })))
      .onConflictDoNothing({ target: [tables.branchId, tables.number] });
  }
  for (const u of STAFF) {
    const passwordHash = await hashPassword(u.password);
    const [row] = await tx
      .insert(users)
      .values({ username: u.username, passwordHash, displayName: u.displayName })
      .onConflictDoUpdate({ target: users.username, set: { passwordHash, displayName: u.displayName } })
      .returning();
    await tx
      .insert(userBranches)
      .values(u.branches.map((code) => ({ userId: row.id, branchId: branchIds.get(code)! })))
      .onConflictDoNothing();
  }
}
