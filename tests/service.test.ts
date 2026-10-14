// DB-backed tests for API rules (tasks 4.1–4.7). Runs against TEST_DATABASE_URL.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as menuGET } from "../app/api/tables/[table]/menu/route";
import { POST as consoleItemPOST } from "../app/api/console/items/[itemId]/route";
import { db, pool } from "../db";
import { cartLines, menuItems, menuOptions, orderItems, tableSessions } from "../db/schema";
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
  transitionItem,
  updateCartLine,
} from "../lib/service";

const A = randomUUID();
const B = randomUUID();
let padThai: { id: number; price: number };
let extraEgg: { id: number; priceDelta: number };
let soupId: number;

beforeEach(async () => {
  await seedDatabase(db);
  [padThai] = await db.select().from(menuItems).where(eq(menuItems.nameEn, "Pad Thai with Shrimp"));
  [extraEgg] = await db.select().from(menuOptions).where(eq(menuOptions.menuItemId, padThai.id));
  [{ id: soupId }] = await db.select().from(menuItems).where(eq(menuItems.category, "soup"));
});
afterAll(() => pool.end());

const add = (device: string, qty = 1, menuItemId = padThai.id, table = 5) =>
  addCartLine(table, device, { menuItemId, optionIds: [], note: "", qty });

async function confirmed(device = A, qty = 1) {
  await add(device, qty);
  await confirmCart(5, device);
  return (await getTableOrders(5, device)).items;
}
const serveAll = async (ids: number[]) => {
  for (const id of ids) {
    await transitionItem(id, "start", "staff");
    await transitionItem(id, "serve", "staff");
  }
};

describe("4.1 menu", () => {
  const ctx = (table: string) => ({ params: Promise.resolve({ table }) });

  it("returns 60 items in category order", async () => {
    const res = await menuGET(new Request("http://x"), ctx("5"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.table.number).toBe(5);
    expect(body.items).toHaveLength(60);
    expect(body.items[0].category).toBe("main");
    expect(body.items.at(-1).category).toBe("drink");
  });

  it("404s an unknown table", async () => {
    expect((await menuGET(new Request("http://x"), ctx("99"))).status).toBe(404);
    expect((await menuGET(new Request("http://x"), ctx("abc"))).status).toBe(404);
  });
});

describe("4.2 cart", () => {
  it("scan alone opens no session; first add does", async () => {
    expect((await getTableOrders(5, A)).session).toBeNull();
    await add(A);
    expect((await getTableOrders(5, A)).session?.billNo).toMatch(/^T05-\d{4}$/);
  });

  it("concurrent first adds from two phones share one session", async () => {
    await Promise.all([add(A), add(B), add(A), add(B)]);
    const open = await db.select().from(tableSessions).where(eq(tableSessions.status, "open"));
    expect(open).toHaveLength(1);
  });

  it("carts are per device", async () => {
    await add(A);
    expect((await listCart(5, A)).lines).toHaveLength(1);
    expect((await listCart(5, B)).lines).toHaveLength(0);
  });

  it("prices options and edits/removes own lines only", async () => {
    const line = await addCartLine(5, A, { menuItemId: padThai.id, optionIds: [extraEgg.id], note: "no beansprout!", qty: 1 });
    let cart = await listCart(5, A);
    expect(cart.lines[0].unitPrice).toBe(padThai.price + extraEgg.priceDelta);
    expect(cart.lines[0].note).toBe("no beansprout!");

    await updateCartLine(5, A, line.id, { menuItemId: padThai.id, optionIds: [extraEgg.id], note: "", qty: 2 });
    cart = await listCart(5, A);
    expect(cart.total).toBe(2 * (padThai.price + extraEgg.priceDelta));

    await expect(removeCartLine(5, B, line.id)).rejects.toMatchObject({ status: 404 });
    await removeCartLine(5, A, line.id);
    expect((await listCart(5, A)).lines).toHaveLength(0);
  });

  it("rejects an option from another dish", async () => {
    await expect(
      addCartLine(5, A, { menuItemId: soupId, optionIds: [extraEgg.id], note: "", qty: 1 }),
    ).rejects.toMatchObject({ status: 400, code: "invalid_option" });
  });
});

describe("4.3 confirm", () => {
  it("splits qty into separate pending items and empties only this cart", async () => {
    await add(A, 3);
    await add(B, 1);
    const res = await confirmCart(5, A);
    expect(res.itemCount).toBe(3);
    const o = await getTableOrders(5, B);
    expect(o.items.map((i) => i.status)).toEqual(["pending", "pending", "pending"]);
    expect((await listCart(5, A)).lines).toHaveLength(0);
    expect((await listCart(5, B)).lines).toHaveLength(1);
  });

  it("rejects an empty cart", async () => {
    await expect(confirmCart(5, A)).rejects.toMatchObject({ status: 400, code: "empty_cart" });
    await add(B);
    await expect(confirmCart(5, A)).rejects.toMatchObject({ status: 400, code: "empty_cart" });
    expect(await db.select().from(orderItems)).toHaveLength(0);
  });
});

describe("4.4 orders view", () => {
  it("shows all devices' items, bill number and served-only total", async () => {
    const [a] = await confirmed(A);
    await confirmed(B);
    await serveAll([a.id]);
    const o = await getTableOrders(5, B);
    expect(o.items).toHaveLength(2);
    expect(o.total).toBe(padThai.price);
  });
});

describe("4.5 transitions", () => {
  it("customer cancel request blocks start; staff resolves", async () => {
    const [item] = await confirmed();
    await transitionItem(item.id, "request_cancel", "customer", 5);
    await expect(transitionItem(item.id, "start", "staff")).rejects.toMatchObject({ status: 409 });
    await transitionItem(item.id, "reject_cancel", "staff");
    await transitionItem(item.id, "start", "staff");
  });

  it("cancel request after start is rejected with a clear message", async () => {
    const [item] = await confirmed();
    await transitionItem(item.id, "start", "staff");
    await expect(transitionItem(item.id, "request_cancel", "customer", 5)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("already being prepared"),
    });
  });

  it("concurrent start and cancel request: exactly one wins", async () => {
    const [item] = await confirmed();
    const results = await Promise.allSettled([
      transitionItem(item.id, "start", "staff"),
      transitionItem(item.id, "request_cancel", "customer", 5),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("customer cannot act on another table's item or use staff actions", async () => {
    const [item] = await confirmed();
    await expect(transitionItem(item.id, "request_cancel", "customer", 6)).rejects.toMatchObject({ status: 404 });
    await expect(transitionItem(item.id, "start", "customer")).rejects.toMatchObject({ status: 403 });
  });

  it("console handler rejects unknown actions", async () => {
    const [item] = await confirmed();
    const res = await consoleItemPOST(
      new Request("http://x", { method: "POST", body: JSON.stringify({ action: "explode" }) }),
      { params: Promise.resolve({ itemId: String(item.id) }) },
    );
    expect(res.status).toBe(400);
  });
});

describe("4.6 pay / mark paid / clear", () => {
  it("gate: own cart must be empty", async () => {
    const items = await confirmed();
    await serveAll(items.map((i) => i.id));
    await add(A);
    await expect(payByTable(5, A, false)).rejects.toMatchObject({ code: "cart_not_empty" });
  });

  it("gate: unresolved items block both paths", async () => {
    await confirmed();
    await expect(payByTable(5, A, false)).rejects.toMatchObject({ code: "unresolved_items" });
    const { session } = await getTableOrders(5, A);
    await expect(markPaid(session!.id, false)).rejects.toMatchObject({ code: "unresolved_items" });
  });

  it("other phones' unsent carts need force, then are discarded", async () => {
    const items = await confirmed();
    await serveAll(items.map((i) => i.id));
    await add(B, 2);
    await expect(payByTable(5, A, false)).rejects.toMatchObject({ code: "unsent_carts", details: { count: 2 } });
    await payByTable(5, A, true);
    expect(await db.select().from(cartLines)).toHaveLength(0);
  });

  it("payment closes the session, keeps history, next add opens a new bill", async () => {
    const items = await confirmed(A, 2);
    await transitionItem(items[0].id, "void", "staff");
    await serveAll([items[1].id]);
    const { session } = await getTableOrders(5, A);
    await markPaid(session!.id, false);

    expect((await getTableOrders(5, B)).session).toBeNull();
    const [hist] = await billHistory();
    expect(hist).toMatchObject({ billNo: session!.billNo, status: "paid", total: padThai.price });

    await add(A);
    const next = await getTableOrders(5, A);
    expect(next.session!.billNo).not.toBe(session!.billNo);
  });

  it("force-clear records voided and frees the table", async () => {
    await confirmed();
    const { session } = await getTableOrders(5, A);
    await clearSession(session!.id);
    expect((await billHistory())[0]).toMatchObject({ status: "voided" });
    await expect(clearSession(session!.id)).rejects.toMatchObject({ code: "bill_closed" });
  });
});

describe("4.7 console", () => {
  it("overview lists every table; history newest first", async () => {
    await confirmed();
    const overview = await consoleOverview();
    expect(overview).toHaveLength(10);
    expect(overview.find((t) => t.tableNumber === 5)?.session?.items).toHaveLength(1);
    expect(overview.find((t) => t.tableNumber === 1)?.session).toBeNull();

    const first = (await getTableOrders(5, A)).session!;
    await clearSession(first.id);
    await add(A, 1, padThai.id, 6);
    const second = (await getTableOrders(6, A)).session!;
    await clearSession(second.id);
    expect((await billHistory()).map((b) => b.billNo)).toEqual([second.billNo, first.billNo]);
  });
});
