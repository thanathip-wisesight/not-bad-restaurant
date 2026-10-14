// restaurant-branches + branch scoping of the console (tasks 2.1–2.4). Runs against TEST_DATABASE_URL.
import { randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "../db";
import { branches, menuItems, orderItemEvents, orderItems, tableSessions, tables, userBranches, users } from "../db/schema";

let STAFF: number; // area.manager belongs to both branches
import { seedDatabase, seedUsersOnly } from "../db/seed";
import {
  addCartLine,
  billHistory,
  confirmCart,
  consoleOverview,
  getBill,
  getTableOrders,
  markPaid,
  payByTable,
  transitionItems,
} from "../lib/service";

const A = randomUUID();
let SIAM: number;
let ASOK: number;
let dish: number;

beforeEach(async () => {
  await seedDatabase(db);
  [{ id: SIAM }] = await db.select().from(branches).where(eq(branches.code, "SIAM"));
  [{ id: ASOK }] = await db.select().from(branches).where(eq(branches.code, "ASOK"));
  [{ id: dish }] = await db.select().from(menuItems).limit(1);
  [{ id: STAFF }] = await db.select().from(users).where(eq(users.username, "area.manager"));
});
afterAll(() => pool.end());

const order = async (branch: string, table: number) => {
  await addCartLine(branch, table, A, { menuItemId: dish, optionIds: [], note: "", qty: 1 });
  await confirmCart(branch, table, A);
  const o = await getTableOrders(branch, table, A);
  return { session: o.session!, item: o.items[0] };
};
const serve = async (branchId: number, id: number) => {
  await transitionItems([id], "start", { kind: "staff", userId: STAFF }, { branchId });
  await transitionItems([id], "serve", { kind: "staff", userId: STAFF }, { branchId });
};

describe("2.1 branch isolation and Bill numbers", () => {
  it("same table number in two branches gets separate sessions and branch-coded Bill numbers", async () => {
    const siam = await order("SIAM", 5);
    expect((await getTableOrders("ASOK", 5, A)).session).toBeNull();
    const asok = await order("ASOK", 5);
    expect(siam.session.id).not.toBe(asok.session.id);
    expect(siam.session.billNo).toMatch(/^SIAM-T05-\d{4}$/);
    expect(asok.session.billNo).toMatch(/^ASOK-T05-\d{4}$/);
  });

  it("paying one branch's table leaves the other branch's session open", async () => {
    const siam = await order("SIAM", 5);
    await order("ASOK", 5);
    await serve(SIAM, siam.item.id);
    await payByTable("SIAM", 5, A, false);
    expect((await getTableOrders("SIAM", 5, A)).session).toBeNull();
    expect((await getTableOrders("ASOK", 5, A)).session).not.toBeNull();
  });
});

describe("2.2 console reads and actions are scoped to the selected branch", () => {
  it("overview and history show only the branch", async () => {
    const asok = await order("ASOK", 2);
    expect((await consoleOverview(SIAM)).map((t) => t.tableNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await consoleOverview(SIAM)).find((t) => t.tableNumber === 2)?.session).toBeNull();
    expect((await consoleOverview(ASOK)).find((t) => t.tableNumber === 2)?.session?.id).toBe(asok.session.id);
    await serve(ASOK, asok.item.id);
    await markPaid(ASOK, asok.session.id, false);
    expect(await billHistory(SIAM)).toHaveLength(0);
    expect(await billHistory(ASOK)).toHaveLength(1);
  });

  it("ids from another branch behave as missing and change nothing", async () => {
    const asok = await order("ASOK", 2);
    await expect(transitionItems([asok.item.id], "start", { kind: "staff", userId: STAFF }, { branchId: SIAM })).rejects.toMatchObject({ status: 404 });
    await expect(markPaid(SIAM, asok.session.id, false)).rejects.toMatchObject({ status: 404 });
    expect(await getBill(SIAM, asok.session.id)).toBeNull();
    const [row] = await db.select().from(orderItems).where(eq(orderItems.id, asok.item.id));
    expect(row.status).toBe("pending");
  });

  it("receipt data carries the branch name", async () => {
    const siam = await order("SIAM", 3);
    expect(await getBill(SIAM, siam.session.id)).toMatchObject({ branchName: "Not Bad Siam", tableNumber: 3 });
  });
});

describe("2.3 seed", () => {
  it("creates SIAM (10) and ASOK (6) tables and the two staff accounts with memberships", async () => {
    const perBranch = await db
      .select({ code: branches.code, n: count() })
      .from(tables)
      .innerJoin(branches, eq(branches.id, tables.branchId))
      .groupBy(branches.code)
      .orderBy(branches.code);
    expect(perBranch).toEqual([
      { code: "ASOK", n: 6 },
      { code: "SIAM", n: 10 },
    ]);
    const members = await db
      .select({ u: users.username, b: branches.code })
      .from(userBranches)
      .innerJoin(users, eq(users.id, userBranches.userId))
      .innerJoin(branches, eq(branches.id, userBranches.branchId))
      .orderBy(users.username, branches.code);
    expect(members).toEqual([
      { u: "area.manager", b: "ASOK" },
      { u: "area.manager", b: "SIAM" },
      { u: "siam.staff", b: "SIAM" },
    ]);
    const [u] = await db.select().from(users).where(eq(users.username, "siam.staff"));
    expect(u.passwordHash).toMatch(/^scrypt\$/);
  });
});

describe("2.4 --users-only seed is non-destructive and repeatable", () => {
  it("adds ASOK and staff to a pre-branch database without touching its Bills", async () => {
    // Simulate a database that was only migrated: SIAM exists, no ASOK, no staff, one paid Bill.
    const paid = await order("SIAM", 5);
    await serve(SIAM, paid.item.id);
    await payByTable("SIAM", 5, A, false);
    // A database from before staff logins has no staff-attributed history either.
    await db.delete(orderItemEvents);
    await db.delete(users);
    await db.delete(tables).where(eq(tables.branchId, ASOK));
    await db.delete(branches).where(eq(branches.code, "ASOK"));

    await seedUsersOnly(db);
    await seedUsersOnly(db);

    const [bill] = await db.select().from(tableSessions).where(eq(tableSessions.id, paid.session.id));
    expect(bill).toMatchObject({ billNo: paid.session.billNo, status: "paid" });
    expect(await db.select().from(orderItems).where(eq(orderItems.sessionId, paid.session.id))).toHaveLength(1);
    const [{ n: asokTables }] = await db
      .select({ n: count() })
      .from(tables)
      .innerJoin(branches, eq(branches.id, tables.branchId))
      .where(eq(branches.code, "ASOK"));
    expect(asokTables).toBe(6);
    expect(await db.select().from(users)).toHaveLength(2);
    expect(await db.select().from(userBranches)).toHaveLength(3);
    const [{ n: siamTables }] = await db.select({ n: count() }).from(tables).where(and(eq(tables.branchId, SIAM)));
    expect(siamTables).toBe(10);
    const [{ n: dup }] = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from (select branch_id, number from tables group by 1, 2 having count(*) > 1) d`,
    ).then((r) => r.rows);
    expect(dup).toBe(0);
  });
});
