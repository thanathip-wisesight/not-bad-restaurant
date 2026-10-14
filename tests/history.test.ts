// Phase 3: voids, batch transitions, final statuses, status log, telemetry (tasks 2.1–3.2).
import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as batchPOST } from "../app/api/console/[branch]/items/batch/route";
import { POST as itemPOST } from "../app/api/console/[branch]/items/[itemId]/route";
import { GET as dishesGET } from "../app/api/console/[branch]/telemetry/dishes/route";
import { GET as itemsGET } from "../app/api/console/[branch]/telemetry/items/route";
import { db, pool } from "../db";
import { branches, menuItems, orderItemEvents, orderItems, users } from "../db/schema";
import { seedDatabase } from "../db/seed";
import { SESSION_COOKIE, createSession } from "../lib/auth";
import {
  TABLE_CLEARED,
  addCartLine,
  billHistory,
  clearSession,
  confirmCart,
  dishCounts,
  dishTimelines,
  getTableOrders,
  markPaid,
  parseRange,
  payByTable,
  transitionItems,
} from "../lib/service";

const A = randomUUID();
let SIAM: number;
let ASOK: number;
let staffId: number;
let padThai: { id: number; price: number };
let coke: { id: number; price: number };

beforeEach(async () => {
  await seedDatabase(db);
  [{ id: SIAM }] = await db.select().from(branches).where(eq(branches.code, "SIAM"));
  [{ id: ASOK }] = await db.select().from(branches).where(eq(branches.code, "ASOK"));
  [{ id: staffId }] = await db.select().from(users).where(eq(users.username, "area.manager"));
  [padThai] = await db.select().from(menuItems).where(eq(menuItems.nameEn, "Pad Thai with Shrimp"));
  [coke] = await db.select().from(menuItems).where(eq(menuItems.nameEn, "Coke"));
});
afterAll(() => pool.end());

const order = async (table = 5, menuItemId = padThai.id, qty = 1, branch = "SIAM") => {
  await addCartLine(branch, table, A, { menuItemId, optionIds: [], note: "", qty });
  await confirmCart(branch, table, A);
  return (await getTableOrders(branch, table, A)).items;
};
const by = () => ({ kind: "staff" as const, userId: staffId });
const act = (ids: number[], action: Parameters<typeof transitionItems>[1], note?: string, branchId = SIAM) =>
  transitionItems(ids, action, by(), { branchId }, note);
const statusOf = async (ids: number[]) =>
  (await db.select().from(orderItems).where(inArray(orderItems.id, ids)).orderBy(asc(orderItems.id))).map((r) => r.status);
const eventsOf = (id: number) =>
  db.select().from(orderItemEvents).where(eq(orderItemEvents.orderItemId, id)).orderBy(asc(orderItemEvents.at), asc(orderItemEvents.id));

describe("2.1 batch transitions", () => {
  it("a batch of two shares one timestamp and logs staff, from, and to", async () => {
    const [fried, pork] = await order(5, padThai.id, 2);
    const res = await act([fried.id, pork.id], "start");
    expect(await statusOf([fried.id, pork.id])).toEqual(["in_progress", "in_progress"]);
    const [e1, e2] = [(await eventsOf(fried.id)).at(-1)!, (await eventsOf(pork.id)).at(-1)!];
    expect(e1.at.getTime()).toBe(e2.at.getTime());
    expect(e1.at.toISOString()).toBe(res.at);
    expect(e1).toMatchObject({ fromStatus: "pending", toStatus: "in_progress", actor: "staff", staffUserId: staffId });
  });

  it("rejects dishes from two tables with 400 and changes nothing", async () => {
    const [t5] = await order(5);
    const [t3] = await order(3);
    await expect(act([t5.id, t3.id], "start")).rejects.toMatchObject({ status: 400, code: "mixed_tables" });
    expect(await statusOf([t5.id, t3.id])).toEqual(["pending", "pending"]);
  });

  it("rejects two different valid statuses with 400", async () => {
    const [a, b] = await order(5, padThai.id, 2);
    await act([a.id], "start");
    await expect(act([a.id, b.id], "void", "stove failure")).rejects.toMatchObject({ status: 400, code: "mixed_statuses" });
    expect(await statusOf([a.id, b.id])).toEqual(["in_progress", "pending"]);
  });

  it("a dish changed meanwhile rejects the whole batch with 409 naming it", async () => {
    const [a, b] = await order(5, padThai.id, 2);
    await transitionItems([b.id], "request_cancel", { kind: "customer", deviceId: A }, { table: { branchCode: "SIAM", tableNo: 5 } });
    const err = await act([a.id, b.id], "start").catch((e) => e);
    expect(err).toMatchObject({ status: 409, details: { conflicts: [{ id: b.id, status: "cancel_requested" }] } });
    expect(await statusOf([a.id, b.id])).toEqual(["pending", "cancel_requested"]);
  });

  it("void needs a reason; batch void applies one reason to all", async () => {
    const items = await order(5, padThai.id, 3);
    const ids = items.map((i) => i.id);
    await expect(act(ids, "void", "ok")).rejects.toMatchObject({ status: 400, code: "invalid_note" });
    expect(await statusOf(ids)).toEqual(["pending", "pending", "pending"]);
    await act(ids, "void", "  stove failure ");
    expect(await statusOf(ids)).toEqual(["voided", "voided", "voided"]);
    for (const id of ids) expect((await eventsOf(id)).at(-1)).toMatchObject({ toStatus: "voided", note: "stove failure" });
  });

  it("confirm cancel keeps the optional remark; customers cannot void", async () => {
    const [a] = await order();
    const cust = { kind: "customer" as const, deviceId: A };
    await expect(transitionItems([a.id], "void", cust, { table: { branchCode: "SIAM", tableNo: 5 } }, "nope")).rejects.toMatchObject({ status: 403 });
    await transitionItems([a.id], "request_cancel", cust, { table: { branchCode: "SIAM", tableNo: 5 } });
    await act([a.id], "confirm_cancel", "customer changed mind");
    expect((await eventsOf(a.id)).map((e) => [e.fromStatus, e.toStatus, e.actor, e.note])).toEqual([
      [null, "pending", "customer", null],
      ["pending", "cancel_requested", "customer", null],
      ["cancel_requested", "cancelled", "staff", "customer changed mind"],
    ]);
  });
});

describe("2.2 confirm event and final statuses at close", () => {
  it("paid Bill: served -> finished (system), cancelled kept, total unchanged; payment gate accepts voided", async () => {
    const [served, voided] = await order(5, padThai.id, 2);
    await act([served.id], "start");
    await act([served.id], "serve");
    await act([voided.id], "void", "dropped on floor");
    const before = (await getTableOrders("SIAM", 5, A)).total;
    await payByTable("SIAM", 5, A, false);
    expect(await statusOf([served.id, voided.id])).toEqual(["finished", "voided"]);
    expect((await eventsOf(served.id)).at(-1)).toMatchObject({ fromStatus: "served", toStatus: "finished", actor: "system", note: null });
    expect((await billHistory(SIAM))[0].total).toBe(before);
    expect(before).toBe(padThai.price);
  });

  it("Mark paid also finishes served dishes", async () => {
    const [a] = await order();
    await act([a.id], "start");
    await act([a.id], "serve");
    const { session } = await getTableOrders("SIAM", 5, A);
    await markPaid(SIAM, session!.id, false);
    expect(await statusOf([a.id])).toEqual(["finished"]);
  });

  it("force-clear voids unfinished dishes with 'table cleared'", async () => {
    const [p, ip, cr, sv] = await order(5, padThai.id, 4);
    await act([ip.id, sv.id], "start");
    await act([sv.id], "serve");
    await transitionItems([cr.id], "request_cancel", { kind: "customer", deviceId: A }, { table: { branchCode: "SIAM", tableNo: 5 } });
    const { session } = await getTableOrders("SIAM", 5, A);
    await clearSession(SIAM, session!.id);
    expect(await statusOf([p.id, ip.id, cr.id, sv.id])).toEqual(["voided", "voided", "voided", "finished"]);
    for (const id of [p.id, ip.id, cr.id])
      expect((await eventsOf(id)).at(-1)).toMatchObject({ toStatus: "voided", actor: "system", note: TABLE_CLEARED });
  });

  it("confirm logs none -> pending at the ticket time with the device", async () => {
    const [a] = await order();
    expect(await eventsOf(a.id)).toMatchObject([{ fromStatus: null, toStatus: "pending", actor: "customer", deviceId: A }]);
  });
});

describe("2.3 telemetry queries", () => {
  it("counts per menu item by final status, SIAM only", async () => {
    const pads = await order(5, padThai.id, 3);
    await act([pads[0].id, pads[1].id], "start");
    await act([pads[0].id, pads[1].id], "serve");
    await act([pads[2].id], "void", "burnt");
    await payByTable("SIAM", 5, A, false);
    await order(2, coke.id, 1);
    await order(5, padThai.id, 5, "ASOK");
    const counts = await dishCounts(SIAM, parseRange(null, null));
    expect(counts).toEqual([
      { menuItemId: padThai.id, name: "ผัดไทยกุ้งสด / Pad Thai with Shrimp", ordered: 3, finished: 2, cancelled: 0, voided: 1 },
      { menuItemId: coke.id, name: "โค้ก / Coke", ordered: 1, finished: 0, cancelled: 0, voided: 0 },
    ]);
    expect((await dishCounts(ASOK, parseRange(null, null)))[0]).toMatchObject({ menuItemId: padThai.id, ordered: 5 });
  });

  it("timelines filter by menu item and list events in time order with who and note", async () => {
    const [p] = await order(5, padThai.id, 1);
    await order(5, coke.id, 1);
    await act([p.id], "void", "burnt");
    const items = await dishTimelines(SIAM, parseRange(null, null), padThai.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: p.id, status: "voided", tableNumber: 5 });
    expect(items[0].events.map((e) => [e.from, e.to, e.by, e.note])).toEqual([
      [null, "pending", "customer", null],
      ["pending", "voided", "area.manager", "burnt"],
    ]);
  });

  it("range rules", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(parseRange(null, null, now)).toEqual({ from: new Date("2026-09-14T12:00:00Z"), to: now });
    expect(() => parseRange("2026-10-10", "2026-10-01")).toThrow(/later/);
    expect(() => parseRange("yesterday", null)).toThrow(/Invalid date/);
    expect(() => parseRange("2025-01-01", "2026-10-01")).toThrow(/366/);
  });
});

describe("3.1 / 3.2 API", () => {
  const cookieFor = async (username: string) => {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return `${SESSION_COOKIE}=${await createSession(u.id)}`;
  };
  const post = (body: unknown, cookie?: string) =>
    new Request("http://x", { method: "POST", headers: cookie ? { cookie } : {}, body: JSON.stringify(body) });
  const get = (path: string, cookie?: string) => new Request(`http://x${path}`, { headers: cookie ? { cookie } : {} });
  const ctx = (branch: string) => ({ params: Promise.resolve({ branch }) });

  it("batch route: 401, 403, success, and 409 body", async () => {
    const [a, b] = await order(5, padThai.id, 2);
    expect((await batchPOST(post({ ids: [a.id], action: "start" }), ctx("SIAM"))).status).toBe(401);
    const siam = await cookieFor("siam.staff");
    expect((await batchPOST(post({ ids: [a.id], action: "start" }, siam), ctx("ASOK"))).status).toBe(403);
    const ok = await batchPOST(post({ ids: [a.id, b.id], action: "start" }, siam), ctx("SIAM"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ids: [a.id, b.id], status: "in_progress" });
    const conflict = await batchPOST(post({ ids: [a.id, b.id], action: "start" }, siam), ctx("SIAM"));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).conflicts).toHaveLength(2);
  });

  it("single-item route forwards the note and enforces the void reason", async () => {
    const [a] = await order();
    const siam = await cookieFor("siam.staff");
    const call = (body: unknown) => itemPOST(post(body, siam), { params: Promise.resolve({ branch: "SIAM", itemId: String(a.id) }) });
    expect((await call({ action: "void" })).status).toBe(400);
    expect((await call({ action: "void", note: "burnt" })).status).toBe(200);
    expect((await eventsOf(a.id)).at(-1)).toMatchObject({ toStatus: "voided", note: "burnt" });
  });

  it("telemetry routes: 401, 403, 400, and JSON shape", async () => {
    await order(5, padThai.id, 2);
    expect((await dishesGET(get("/t"), ctx("SIAM"))).status).toBe(401);
    const siam = await cookieFor("siam.staff");
    expect((await dishesGET(get("/t", siam), ctx("ASOK"))).status).toBe(403);
    expect((await dishesGET(get("/t?from=2026-10-10&to=2026-10-01", siam), ctx("SIAM"))).status).toBe(400);
    expect((await itemsGET(get("/t?menuItemId=abc", siam), ctx("SIAM"))).status).toBe(400);
    const dishes = await (await dishesGET(get("/t", siam), ctx("SIAM"))).json();
    expect(dishes).toMatchObject({ branch: "SIAM", dishes: [{ menuItemId: padThai.id, ordered: 2, finished: 0 }] });
    const items = await (await itemsGET(get(`/t?menuItemId=${padThai.id}`, siam), ctx("SIAM"))).json();
    expect(items).toMatchObject({ branch: "SIAM", limit: 500 });
    expect(items.items).toHaveLength(2);
    expect(items.items[0].events[0]).toMatchObject({ from: null, to: "pending", by: "customer" });
  });
});
