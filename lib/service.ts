// Server-side use cases. All state rules are enforced here (design D4–D8).
import { and, asc, desc, eq, inArray, ne, sql, sum } from "drizzle-orm";
import { db, type Db, type Tx } from "../db";
import {
  cartLines,
  menuItems,
  menuOptions,
  orderItems,
  tableSessions,
  tables,
  tickets,
  type OptionSnapshot,
} from "../db/schema";
import { ACTIONS, RESOLVED, STATUS_LABELS, billTotal, type Action, type Actor, type ItemStatus } from "./domain";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Q = Db | Tx;

// ---------- tables & menu ----------

export async function getTable(number: number) {
  const [t] = await db.select().from(tables).where(eq(tables.number, number));
  return t ?? null;
}

async function requireTable(number: number) {
  const t = await getTable(number);
  if (!t) throw new AppError(404, "table_not_found", "Table not found");
  return t;
}

export async function getMenu() {
  // Postgres sorts enums by declaration order, which is the agreed category order.
  const items = await db.select().from(menuItems).orderBy(asc(menuItems.category), asc(menuItems.sort));
  const opts = await db.select().from(menuOptions).orderBy(asc(menuOptions.id));
  return items.map((i) => ({
    id: i.id,
    category: i.category,
    nameTh: i.nameTh,
    nameEn: i.nameEn,
    price: i.price,
    imageUrl: i.imageUrl,
    options: opts.filter((o) => o.menuItemId === i.id).map(({ id, name, priceDelta }) => ({ id, name, priceDelta })),
  }));
}
export type MenuItemDto = Awaited<ReturnType<typeof getMenu>>[number];

// ---------- sessions ----------

async function findOpenSession(q: Q, tableId: number, lock = false) {
  const query = q
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), eq(tableSessions.status, "open")));
  const [s] = lock ? await query.for("update") : await query;
  return s ?? null;
}

// Idempotent under concurrent first adds: the partial unique index lets only one open row exist (D4, D8).
async function openSession(table: { id: number; number: number }) {
  await db.execute(sql`
    INSERT INTO table_sessions (table_id, bill_no)
    VALUES (${table.id}, 'T' || lpad(${String(table.number)}, 2, '0') || '-' || lpad(nextval('bill_seq')::text, 4, '0'))
    ON CONFLICT (table_id) WHERE status = 'open' DO NOTHING`);
  const s = await findOpenSession(db, table.id);
  if (!s) throw new AppError(500, "session_open_failed", "Could not open table session");
  return s;
}

// ---------- cart ----------

export type CartInput = { menuItemId: number; optionIds: number[]; note: string; qty: number };

export function parseCartInput(body: unknown): CartInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const isInt = (v: unknown): v is number => Number.isInteger(v);
  const optionIds = b.optionIds ?? [];
  const note = b.note ?? "";
  if (!isInt(b.menuItemId) || !isInt(b.qty) || b.qty < 1 || !Array.isArray(optionIds) || !optionIds.every(isInt) || typeof note !== "string")
    throw new AppError(400, "invalid_input", "menuItemId, qty >= 1, optionIds[] and note are required");
  return { menuItemId: b.menuItemId, qty: b.qty, optionIds: [...new Set(optionIds as number[])], note: note.slice(0, 500) };
}

async function assertItemOptions(input: CartInput) {
  const [item] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.id, input.menuItemId));
  if (!item) throw new AppError(400, "invalid_item", "Menu item does not exist");
  if (!input.optionIds.length) return;
  const found = await db
    .select({ id: menuOptions.id })
    .from(menuOptions)
    .where(and(eq(menuOptions.menuItemId, input.menuItemId), inArray(menuOptions.id, input.optionIds)));
  if (found.length !== input.optionIds.length) throw new AppError(400, "invalid_option", "Option does not belong to this item");
}

// Resolves names and prices for cart lines (also used for order snapshots).
async function priceLines<T extends { menuItemId: number; optionIds: number[] }>(q: Q, lines: T[]) {
  if (!lines.length) return [];
  const itemIds = [...new Set(lines.map((l) => l.menuItemId))];
  const items = await q.select().from(menuItems).where(inArray(menuItems.id, itemIds));
  const opts = await q.select().from(menuOptions).where(inArray(menuOptions.menuItemId, itemIds));
  return lines.map((l) => {
    const item = items.find((i) => i.id === l.menuItemId)!;
    const options: (OptionSnapshot & { id: number })[] = opts
      .filter((o) => l.optionIds.includes(o.id))
      .map(({ id, name, priceDelta }) => ({ id, name, priceDelta }));
    const unitPrice = item.price + options.reduce((s, o) => s + o.priceDelta, 0);
    return { ...l, nameTh: item.nameTh, nameEn: item.nameEn, options, unitPrice };
  });
}

export async function listCart(tableNo: number, deviceId: string) {
  const table = await requireTable(tableNo);
  const session = await findOpenSession(db, table.id);
  if (!session) return { lines: [], total: 0 };
  const rows = await db
    .select()
    .from(cartLines)
    .where(and(eq(cartLines.sessionId, session.id), eq(cartLines.deviceId, deviceId)))
    .orderBy(asc(cartLines.id));
  const lines = (await priceLines(db, rows)).map((l) => ({
    id: l.id,
    menuItemId: l.menuItemId,
    nameTh: l.nameTh,
    nameEn: l.nameEn,
    options: l.options,
    note: l.note,
    qty: l.qty,
    unitPrice: l.unitPrice,
    lineTotal: l.unitPrice * l.qty,
  }));
  return { lines, total: lines.reduce((s, l) => s + l.lineTotal, 0) };
}
export type CartLineDto = Awaited<ReturnType<typeof listCart>>["lines"][number];

export async function addCartLine(tableNo: number, deviceId: string, input: CartInput) {
  const table = await requireTable(tableNo);
  await assertItemOptions(input);
  const session = await openSession(table);
  const [line] = await db.insert(cartLines).values({ sessionId: session.id, deviceId, ...input }).returning();
  return line;
}

async function ownLineWhere(tableNo: number, deviceId: string, lineId: number) {
  const table = await requireTable(tableNo);
  const session = await findOpenSession(db, table.id);
  if (!session) throw new AppError(404, "line_not_found", "Cart line not found");
  return and(eq(cartLines.id, lineId), eq(cartLines.sessionId, session.id), eq(cartLines.deviceId, deviceId));
}

export async function updateCartLine(tableNo: number, deviceId: string, lineId: number, input: CartInput) {
  await assertItemOptions(input);
  const where = await ownLineWhere(tableNo, deviceId, lineId);
  const [line] = await db.update(cartLines).set(input).where(where).returning();
  if (!line) throw new AppError(404, "line_not_found", "Cart line not found");
  return line;
}

export async function removeCartLine(tableNo: number, deviceId: string, lineId: number) {
  const where = await ownLineWhere(tableNo, deviceId, lineId);
  const [line] = await db.delete(cartLines).where(where).returning();
  if (!line) throw new AppError(404, "line_not_found", "Cart line not found");
  return { ok: true };
}

// One device's cart -> one Ticket; qty N -> N OrderItems (D6).
export async function confirmCart(tableNo: number, deviceId: string) {
  const table = await requireTable(tableNo);
  return db.transaction(async (tx) => {
    // Locking the session serialises confirm against pay/clear (D7).
    const session = await findOpenSession(tx, table.id, true);
    if (!session) throw new AppError(400, "empty_cart", "Cart is empty");
    const lines = await tx
      .select()
      .from(cartLines)
      .where(and(eq(cartLines.sessionId, session.id), eq(cartLines.deviceId, deviceId)))
      .orderBy(asc(cartLines.id))
      .for("update");
    if (!lines.length) throw new AppError(400, "empty_cart", "Cart is empty");
    const [ticket] = await tx.insert(tickets).values({ sessionId: session.id, deviceId }).returning();
    const priced = await priceLines(tx, lines);
    const rows = priced.flatMap((l) =>
      Array.from({ length: l.qty }, () => ({
        ticketId: ticket.id,
        sessionId: session.id,
        menuItemId: l.menuItemId,
        nameSnapshot: `${l.nameTh} / ${l.nameEn}`,
        optionsSnapshot: l.options.map(({ name, priceDelta }) => ({ name, priceDelta })),
        note: l.note,
        unitPrice: l.unitPrice,
      })),
    );
    await tx.insert(orderItems).values(rows);
    await tx.delete(cartLines).where(inArray(cartLines.id, lines.map((l) => l.id)));
    return { ticketId: ticket.id, itemCount: rows.length };
  });
}

// ---------- orders ----------

async function sessionItems(q: Q, sessionId: number) {
  const rows = await q.select().from(orderItems).where(eq(orderItems.sessionId, sessionId)).orderBy(asc(orderItems.id));
  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    name: r.nameSnapshot,
    options: r.optionsSnapshot,
    note: r.note,
    unitPrice: r.unitPrice,
    status: r.status as ItemStatus,
    updatedAt: r.updatedAt.toISOString(),
  }));
}
export type OrderItemDto = Awaited<ReturnType<typeof sessionItems>>[number];

async function cartQty(q: Q, sessionId: number) {
  const rows = await q
    .select({ deviceId: cartLines.deviceId, qty: sum(cartLines.qty).mapWith(Number) })
    .from(cartLines)
    .where(eq(cartLines.sessionId, sessionId))
    .groupBy(cartLines.deviceId);
  return rows;
}

export async function getTableOrders(tableNo: number, deviceId: string) {
  const table = await requireTable(tableNo);
  const session = await findOpenSession(db, table.id);
  if (!session) return { session: null, items: [], total: 0, myCartQty: 0, otherCartQty: 0 };
  const items = await sessionItems(db, session.id);
  const carts = await cartQty(db, session.id);
  return {
    session: { id: session.id, billNo: session.billNo },
    items,
    total: billTotal(items),
    myCartQty: carts.find((c) => c.deviceId === deviceId)?.qty ?? 0,
    otherCartQty: carts.filter((c) => c.deviceId !== deviceId).reduce((s, c) => s + c.qty, 0),
  };
}

// Single conditional UPDATE: concurrent conflicting transitions cannot both win (D5).
export async function transitionItem(itemId: number, action: Action, actor: Actor, tableNo?: number) {
  const a = ACTIONS[action];
  if (a.actor !== actor) throw new AppError(403, "forbidden_action", "Action not allowed");
  const table = tableNo === undefined ? null : await requireTable(tableNo);
  const openSessions = db
    .select({ id: tableSessions.id })
    .from(tableSessions)
    .where(and(eq(tableSessions.status, "open"), table ? eq(tableSessions.tableId, table.id) : undefined));
  const [row] = await db
    .update(orderItems)
    .set({ status: a.to, updatedAt: new Date() })
    .where(
      and(
        eq(orderItems.id, itemId),
        inArray(orderItems.status, [...a.from]),
        inArray(orderItems.sessionId, openSessions),
      ),
    )
    .returning();
  if (row) return { id: row.id, status: row.status };

  const [cur] = await db
    .select({ status: orderItems.status })
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), inArray(orderItems.sessionId, openSessions)));
  if (!cur) throw new AppError(404, "item_not_found", "Order item not found");
  const message =
    action === "request_cancel" && cur.status === "in_progress"
      ? "This dish is already being prepared and can no longer be cancelled."
      : `Cannot ${a.label.toLowerCase()} an item that is ${STATUS_LABELS[cur.status].toLowerCase()}.`;
  throw new AppError(409, "invalid_transition", message, { currentStatus: cur.status });
}

// ---------- payment & closing ----------

// Shared gate for customer pay and console mark-paid (payment spec, D7).
async function assertPayable(tx: Tx, sessionId: number, deviceId: string | null, force: boolean) {
  const carts = await cartQty(tx, sessionId);
  if (deviceId && carts.some((c) => c.deviceId === deviceId))
    throw new AppError(409, "cart_not_empty", "Confirm or remove the dishes in your cart before paying.");
  const unresolved = (await sessionItems(tx, sessionId)).filter((i) => !RESOLVED.includes(i.status));
  if (unresolved.length)
    throw new AppError(409, "unresolved_items", "Some dishes are not served or cancelled yet. Please ask staff.", {
      items: unresolved.map((i) => ({ id: i.id, name: i.name, status: i.status })),
    });
  const others = carts.filter((c) => c.deviceId !== deviceId).reduce((s, c) => s + c.qty, 0);
  if (others && !force)
    throw new AppError(
      409,
      "unsent_carts",
      `${others} unsent dish${others === 1 ? "" : "es"} on other phones will be discarded. Please sort it out at the table first.`,
      { count: others },
    );
}

async function closeSession(tx: Tx, sessionId: number, status: "paid" | "voided") {
  await tx.update(tableSessions).set({ status, closedAt: new Date() }).where(eq(tableSessions.id, sessionId));
  await tx.delete(cartLines).where(eq(cartLines.sessionId, sessionId));
}

async function lockSessionById(tx: Tx, sessionId: number) {
  const [s] = await tx.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).for("update");
  if (!s) throw new AppError(404, "bill_not_found", "Bill not found");
  if (s.status !== "open") throw new AppError(409, "bill_closed", `Bill is already ${s.status}`);
  return s;
}

export async function payByTable(tableNo: number, deviceId: string, force: boolean) {
  const table = await requireTable(tableNo);
  return db.transaction(async (tx) => {
    const s = await findOpenSession(tx, table.id, true);
    if (!s) throw new AppError(409, "no_open_bill", "There is no open bill for this table.");
    await assertPayable(tx, s.id, deviceId, force);
    await closeSession(tx, s.id, "paid");
    return { billNo: s.billNo, status: "paid" as const };
  });
}

export async function markPaid(sessionId: number, force: boolean) {
  return db.transaction(async (tx) => {
    const s = await lockSessionById(tx, sessionId);
    await assertPayable(tx, s.id, null, force);
    await closeSession(tx, s.id, "paid");
    return { billNo: s.billNo, status: "paid" as const };
  });
}

export async function clearSession(sessionId: number) {
  return db.transaction(async (tx) => {
    const s = await lockSessionById(tx, sessionId);
    await closeSession(tx, s.id, "voided");
    return { billNo: s.billNo, status: "voided" as const };
  });
}

// ---------- console ----------

export async function consoleOverview() {
  const all = await db.select().from(tables).orderBy(asc(tables.number));
  const open = await db.select().from(tableSessions).where(eq(tableSessions.status, "open"));
  return Promise.all(
    all.map(async (t) => {
      const s = open.find((o) => o.tableId === t.id);
      if (!s) return { tableNumber: t.number, session: null };
      const items = await sessionItems(db, s.id);
      const carts = await cartQty(db, s.id);
      return {
        tableNumber: t.number,
        session: {
          id: s.id,
          billNo: s.billNo,
          openedAt: s.openedAt,
          items,
          total: billTotal(items),
          unsentCartQty: carts.reduce((n, c) => n + c.qty, 0),
        },
      };
    }),
  );
}
export type ConsoleTableDto = Awaited<ReturnType<typeof consoleOverview>>[number];

export async function billHistory() {
  return db
    .select({
      id: tableSessions.id,
      billNo: tableSessions.billNo,
      status: tableSessions.status,
      closedAt: tableSessions.closedAt,
      tableNumber: tables.number,
      total: sql<number>`coalesce(sum(${orderItems.unitPrice}) filter (where ${orderItems.status} = 'served'), 0)`.mapWith(Number),
    })
    .from(tableSessions)
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .leftJoin(orderItems, eq(orderItems.sessionId, tableSessions.id))
    .where(ne(tableSessions.status, "open"))
    .groupBy(tableSessions.id, tables.number)
    .orderBy(desc(tableSessions.closedAt), desc(tableSessions.id));
}

export async function getBill(sessionId: number) {
  const [row] = await db
    .select({ session: tableSessions, tableNumber: tables.number })
    .from(tableSessions)
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .where(eq(tableSessions.id, sessionId));
  if (!row) return null;
  const items = await sessionItems(db, sessionId);
  return { ...row.session, tableNumber: row.tableNumber, items, total: billTotal(items) };
}
