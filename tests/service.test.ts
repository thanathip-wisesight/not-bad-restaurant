// DB-backed tests for API rules. Runs against TEST_DATABASE_URL.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as menuGET } from "../app/api/b/[branch]/tables/[table]/menu/route";
import { POST as consoleItemPOST } from "../app/api/console/[branch]/items/[itemId]/route";
import { SESSION_COOKIE, createSession } from "../lib/auth";
import { db, pool } from "../db";
import { branches, cartLines, menuItems, menuOptions, orderItems, tableSessions, users } from "../db/schema";
import { seedDatabase } from "../db/seed";
import {
  addCartLine,
  billHistory,
  clearSession,
  confirmCart,
  consoleOverview,
  getTableOrders,
  listCart,
  markPaid,
  payByTable,
  removeCartLine,
  transitionItems,
  updateCartLine,
} from "../lib/service";

const A = randomUUID();
const B = randomUUID();
let padThai: { id: number; price: number };
let extraEgg: { id: number; priceDelta: number };
let soupId: number;
let SIAM: number;

beforeEach(async () => {
  await seedDatabase(db);
  [padThai] = await db.select().from(menuItems).where(eq(menuItems.nameEn, "Pad Thai with Shrimp"));
  [extraEgg] = await db.select().from(menuOptions).where(eq(menuOptions.menuItemId, padThai.id));
  [{ id: soupId }] = await db.select().from(menuItems).where(eq(menuItems.category, "soup"));
  [{ id: SIAM }] = await db.select().from(branches).where(eq(branches.code, "SIAM"));
});
afterAll(() => pool.end());

const add = (device: string, qty = 1, menuItemId = padThai.id, table = 5, branch = "SIAM") =>
  addCartLine(branch, table, device, { menuItemId, optionIds: [], note: "", qty });
let STAFF_ID: number;
beforeEach(async () => {
  [{ id: STAFF_ID }] = await db.select().from(users).where(eq(users.username, "siam.staff"));
});
type Act = Parameters<typeof transitionItems>[1];
const staff = (id: number, action: Act, note?: string) =>
  transitionItems([id], action, { kind: "staff", userId: STAFF_ID }, { branchId: SIAM }, note);
const customer = (id: number, action: Act, tableNo = 5) =>
  transitionItems([id], action, { kind: "customer", deviceId: A }, { table: { branchCode: "SIAM", tableNo } });

async function confirmed(device = A, qty = 1) {
  await add(device, qty);
  await confirmCart("SIAM", 5, device);
  return (await getTableOrders("SIAM", 5, device)).items;
}
const serveAll = async (ids: number[]) => {
  for (const id of ids) {
    await staff(id, "start");
    await staff(id, "serve");
  }
};

describe("4.1 menu", () => {
  const ctx = (table: string, branch = "SIAM") => ({ params: Promise.resolve({ branch, table }) });

  it("returns 60 items in category order", async () => {
    const res = await menuGET(new Request("http://x"), ctx("5"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.table).toMatchObject({ number: 5, branchCode: "SIAM", branchName: "Not Bad Siam" });
    expect(body.items).toHaveLength(60);
    expect(body.items[0].category).toBe("main");
    expect(body.items.at(-1).category).toBe("drink");
  });

  it("404s an unknown table", async () => {
    expect((await menuGET(new Request("http://x"), ctx("99"))).status).toBe(404);
    expect((await menuGET(new Request("http://x"), ctx("abc"))).status).toBe(404);
    expect((await menuGET(new Request("http://x"), ctx("5", "NOPE"))).status).toBe(404);
    expect((await menuGET(new Request("http://x"), ctx("8", "ASOK"))).status).toBe(404); // ASOK has 6 tables
  });
});

describe("4.2 cart", () => {
  it("scan alone opens no session; first add does", async () => {
    expect((await getTableOrders("SIAM", 5, A)).session).toBeNull();
    await add(A);
    expect((await getTableOrders("SIAM", 5, A)).session?.billNo).toMatch(/^SIAM-T05-\d{4}$/);
  });

  it("concurrent first adds from two phones share one session", async () => {
    await Promise.all([add(A), add(B), add(A), add(B)]);
    const open = await db.select().from(tableSessions).where(eq(tableSessions.status, "open"));
    expect(open).toHaveLength(1);
  });

  it("carts are per device", async () => {
    await add(A);
    expect((await listCart("SIAM", 5, A)).lines).toHaveLength(1);
    expect((await listCart("SIAM", 5, B)).lines).toHaveLength(0);
  });

  it("prices options and edits/removes own lines only", async () => {
    const line = await addCartLine("SIAM", 5, A, { menuItemId: padThai.id, optionIds: [extraEgg.id], note: "no beansprout!", qty: 1 });
    let cart = await listCart("SIAM", 5, A);
    expect(cart.lines[0].unitPrice).toBe(padThai.price + extraEgg.priceDelta);
    expect(cart.lines[0].note).toBe("no beansprout!");

    await updateCartLine("SIAM", 5, A, line.id, { menuItemId: padThai.id, optionIds: [extraEgg.id], note: "", qty: 2 });
    cart = await listCart("SIAM", 5, A);
    expect(cart.total).toBe(2 * (padThai.price + extraEgg.priceDelta));

    await expect(removeCartLine("SIAM", 5, B, line.id)).rejects.toMatchObject({ status: 404 });
    await removeCartLine("SIAM", 5, A, line.id);
    expect((await listCart("SIAM", 5, A)).lines).toHaveLength(0);
  });

  it("rejects an option from another dish", async () => {
    await expect(
      addCartLine("SIAM", 5, A, { menuItemId: soupId, optionIds: [extraEgg.id], note: "", qty: 1 }),
    ).rejects.toMatchObject({ status: 400, code: "invalid_option" });
  });
});

describe("4.3 confirm", () => {
  it("splits qty into separate pending items and empties only this cart", async () => {
    await add(A, 3);
    await add(B, 1);
    const res = await confirmCart("SIAM", 5, A);
    expect(res.itemCount).toBe(3);
    const o = await getTableOrders("SIAM", 5, B);
    expect(o.items.map((i) => i.status)).toEqual(["pending", "pending", "pending"]);
    expect((await listCart("SIAM", 5, A)).lines).toHaveLength(0);
    expect((await listCart("SIAM", 5, B)).lines).toHaveLength(1);
  });

  it("rejects an empty cart", async () => {
    await expect(confirmCart("SIAM", 5, A)).rejects.toMatchObject({ status: 400, code: "empty_cart" });
    await add(B);
    await expect(confirmCart("SIAM", 5, A)).rejects.toMatchObject({ status: 400, code: "empty_cart" });
    expect(await db.select().from(orderItems)).toHaveLength(0);
  });
});

describe("4.4 orders view", () => {
  it("shows all devices' items, bill number and served-only total", async () => {
    const [a] = await confirmed(A);
    await confirmed(B);
    await serveAll([a.id]);
    const o = await getTableOrders("SIAM", 5, B);
    expect(o.items).toHaveLength(2);
    expect(o.total).toBe(padThai.price);
  });
});

describe("4.5 transitions", () => {
  it("customer cancel request blocks start; staff resolves", async () => {
    const [item] = await confirmed();
    await customer(item.id, "request_cancel", 5);
    await expect(staff(item.id, "start")).rejects.toMatchObject({ status: 409 });
    await staff(item.id, "reject_cancel");
    await staff(item.id, "start");
  });

  it("records the time of the last status change", async () => {
    const [item] = await confirmed();
    await new Promise((r) => setTimeout(r, 20));
    await staff(item.id, "start");
    const [after] = (await getTableOrders("SIAM", 5, A)).items;
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(item.updatedAt));
  });

  it("cancel request after start is rejected with a clear message", async () => {
    const [item] = await confirmed();
    await staff(item.id, "start");
    await expect(customer(item.id, "request_cancel", 5)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("already being prepared"),
    });
  });

  it("concurrent start and cancel request: exactly one wins", async () => {
    const [item] = await confirmed();
    const results = await Promise.allSettled([
      staff(item.id, "start"),
      customer(item.id, "request_cancel", 5),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("customer cannot act on another table's item or use staff actions", async () => {
    const [item] = await confirmed();
    await expect(customer(item.id, "request_cancel", 6)).rejects.toMatchObject({ status: 404 });
    await expect(transitionItems([item.id], "start", { kind: "customer", deviceId: A }, { table: { branchCode: "SIAM", tableNo: 5 } })).rejects.toMatchObject({ status: 403 });
  });

  it("console handler rejects unknown actions", async () => {
    const [item] = await confirmed();
    const [u] = await db.select().from(users).where(eq(users.username, "siam.staff"));
    const cookie = `${SESSION_COOKIE}=${await createSession(u.id)}`;
    const res = await consoleItemPOST(
      new Request("http://x", { method: "POST", headers: { cookie }, body: JSON.stringify({ action: "explode" }) }),
      { params: Promise.resolve({ branch: "SIAM", itemId: String(item.id) }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("4.6 pay / mark paid / clear", () => {
  it("gate: own cart must be empty", async () => {
    const items = await confirmed();
    await serveAll(items.map((i) => i.id));
    await add(A);
    await expect(payByTable("SIAM", 5, A, false)).rejects.toMatchObject({ code: "cart_not_empty" });
  });

  it("gate: unresolved items block both paths", async () => {
    await confirmed();
    await expect(payByTable("SIAM", 5, A, false)).rejects.toMatchObject({ code: "unresolved_items" });
    const { session } = await getTableOrders("SIAM", 5, A);
    await expect(markPaid(SIAM, session!.id, false)).rejects.toMatchObject({ code: "unresolved_items" });
  });

  it("other phones' unsent carts need force, then are discarded", async () => {
    const items = await confirmed();
    await serveAll(items.map((i) => i.id));
    await add(B, 2);
    await expect(payByTable("SIAM", 5, A, false)).rejects.toMatchObject({ code: "unsent_carts", details: { count: 2 } });
    await payByTable("SIAM", 5, A, true);
    expect(await db.select().from(cartLines)).toHaveLength(0);
  });

  it("payment closes the session, keeps history, next add opens a new bill", async () => {
    const items = await confirmed(A, 2);
    await staff(items[0].id, "void", "dropped on floor");
    await serveAll([items[1].id]);
    const { session } = await getTableOrders("SIAM", 5, A);
    await markPaid(SIAM, session!.id, false);

    expect((await getTableOrders("SIAM", 5, B)).session).toBeNull();
    const [hist] = await billHistory(SIAM);
    expect(hist).toMatchObject({ billNo: session!.billNo, status: "paid", total: padThai.price });

    await add(A);
    const next = await getTableOrders("SIAM", 5, A);
    expect(next.session!.billNo).not.toBe(session!.billNo);
  });

  it("force-clear records voided and frees the table", async () => {
    await confirmed();
    const { session } = await getTableOrders("SIAM", 5, A);
    await clearSession(SIAM, session!.id);
    expect((await billHistory(SIAM))[0]).toMatchObject({ status: "voided" });
    await expect(clearSession(SIAM, session!.id)).rejects.toMatchObject({ code: "bill_closed" });
  });
});

describe("4.7 console", () => {
  it("overview lists every table; history newest first", async () => {
    await confirmed();
    const overview = await consoleOverview(SIAM);
    expect(overview).toHaveLength(10);
    expect(overview.find((t) => t.tableNumber === 5)?.session?.items).toHaveLength(1);
    expect(overview.find((t) => t.tableNumber === 1)?.session).toBeNull();

    const first = (await getTableOrders("SIAM", 5, A)).session!;
    await clearSession(SIAM, first.id);
    await add(A, 1, padThai.id, 6);
    const second = (await getTableOrders("SIAM", 6, A)).session!;
    await clearSession(SIAM, second.id);
    expect((await billHistory(SIAM)).map((b) => b.billNo)).toEqual([second.billNo, first.billNo]);
  });
});
