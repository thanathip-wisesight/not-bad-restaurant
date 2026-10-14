// Server-side use cases. All state rules are enforced here (design D4–D8).
import { and, asc, desc, eq, inArray, ne, sql, sum } from "drizzle-orm";
import { db, type Db, type Tx } from "../db";
import {
  branches,
  cartLines,
  menuItems,
  menuOptions,
  orderItemEvents,
  orderItems,
  tableSessions,
  tables,
  tickets,
  users,
  type OptionSnapshot,
} from "../db/schema";
import { ACTIONS, RESOLVED, STATUS_LABELS, billTotal, checkNote, type Action, type ItemStatus } from "./domain";

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

// A table is addressed by branch code + number (restaurant-branches spec, D4).
export async function getTable(branchCode: string, number: number) {
  const [t] = await db
    .select({ id: tables.id, number: tables.number, branchId: branches.id, branchCode: branches.code, branchName: branches.name })
    .from(tables)
    .innerJoin(branches, eq(branches.id, tables.branchId))
    .where(and(eq(branches.code, branchCode), eq(tables.number, number)));
  return t ?? null;
}
type TableRow = NonNullable<Awaited<ReturnType<typeof getTable>>>;

async function requireTable(branchCode: string, number: number) {
  const t = await getTable(branchCode, number);
  if (!t) throw new AppError(404, "table_not_found", "Table not found");
  return t;
}

export async function getBranch(code: string) {
  const [b] = await db.select().from(branches).where(eq(branches.code, code));
  return b ?? null;
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
async function openSession(table: TableRow) {
  // Bill number: <BRANCH>-T<table>-<global sequence>, e.g. SIAM-T05-0042 (payment spec, D3).
  await db.execute(sql`
    INSERT INTO table_sessions (table_id, bill_no)
    VALUES (${table.id}, ${table.branchCode} || '-T' || lpad(${String(table.number)}, 2, '0') || '-' || lpad(nextval('bill_seq')::text, 4, '0'))
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

export async function listCart(branchCode: string, tableNo: number, deviceId: string) {
  const table = await requireTable(branchCode, tableNo);
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

export async function addCartLine(branchCode: string, tableNo: number, deviceId: string, input: CartInput) {
  const table = await requireTable(branchCode, tableNo);
  await assertItemOptions(input);
  const session = await openSession(table);
  const [line] = await db.insert(cartLines).values({ sessionId: session.id, deviceId, ...input }).returning();
  return line;
}

async function ownLineWhere(branchCode: string, tableNo: number, deviceId: string, lineId: number) {
  const table = await requireTable(branchCode, tableNo);
  const session = await findOpenSession(db, table.id);
  if (!session) throw new AppError(404, "line_not_found", "Cart line not found");
  return and(eq(cartLines.id, lineId), eq(cartLines.sessionId, session.id), eq(cartLines.deviceId, deviceId));
}

export async function updateCartLine(branchCode: string, tableNo: number, deviceId: string, lineId: number, input: CartInput) {
  await assertItemOptions(input);
  const where = await ownLineWhere(branchCode, tableNo, deviceId, lineId);
  const [line] = await db.update(cartLines).set(input).where(where).returning();
  if (!line) throw new AppError(404, "line_not_found", "Cart line not found");
  return line;
}

export async function removeCartLine(branchCode: string, tableNo: number, deviceId: string, lineId: number) {
  const where = await ownLineWhere(branchCode, tableNo, deviceId, lineId);
  const [line] = await db.delete(cartLines).where(where).returning();
  if (!line) throw new AppError(404, "line_not_found", "Cart line not found");
  return { ok: true };
}

// One device's cart -> one Ticket; qty N -> N OrderItems (D6).
export async function confirmCart(branchCode: string, tableNo: number, deviceId: string) {
  const table = await requireTable(branchCode, tableNo);
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
    const created = await tx.insert(orderItems).values(rows).returning({ id: orderItems.id });
    // History starts at confirmation: none -> pending, by this device, at the ticket's time (design D6).
    await tx.insert(orderItemEvents).values(
      created.map((c) => ({ orderItemId: c.id, fromStatus: null, toStatus: "pending" as const, at: ticket.createdAt, actor: "customer" as const, deviceId })),
    );
    await tx.delete(cartLines).where(inArray(cartLines.id, lines.map((l) => l.id)));
    return { ticketId: ticket.id, itemCount: rows.length };
  });
}

// ---------- orders ----------

// Latest staff reason/remark per dish; console-only (customers never see reasons, order-tracking spec).
async function latestNotes(q: Q, itemIds: number[]) {
  if (!itemIds.length) return new Map<number, string>();
  const rows = await q
    .select({ id: orderItemEvents.orderItemId, note: orderItemEvents.note })
    .from(orderItemEvents)
    .where(and(inArray(orderItemEvents.orderItemId, itemIds), sql`${orderItemEvents.note} is not null`))
    .orderBy(desc(orderItemEvents.at), desc(orderItemEvents.id));
  const map = new Map<number, string>();
  for (const r of rows) if (!map.has(r.id)) map.set(r.id, r.note!);
  return map;
}

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

export async function getTableOrders(branchCode: string, tableNo: number, deviceId: string) {
  const table = await requireTable(branchCode, tableNo);
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

// Customers act on one table; staff on one branch. Items outside the scope behave as missing (D7).
export type TransitionScope = { table: { branchCode: string; tableNo: number } } | { branchId: number };
// Who made a change; recorded in the order history (order-history spec).
export type ChangedBy = { kind: "customer"; deviceId: string } | { kind: "staff"; userId: number };

const branchTables = (branchId: number) => db.select({ id: tables.id }).from(tables).where(eq(tables.branchId, branchId));

export const MAX_BATCH = 100;

// One rule path for single and batch changes (design D4): lock, validate, update, log, all with one timestamp.
export async function transitionItems(
  ids: number[],
  action: Action,
  by: ChangedBy,
  scope: TransitionScope,
  rawNote?: unknown,
) {
  const a = ACTIONS[action];
  if (a.actor !== by.kind) throw new AppError(403, "forbidden_action", "Action not allowed");
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > MAX_BATCH || !unique.every((id) => Number.isInteger(id) && id > 0))
    throw new AppError(400, "invalid_input", `Select between 1 and ${MAX_BATCH} dishes`);
  const checked = checkNote(action, rawNote);
  if ("error" in checked) throw new AppError(400, "invalid_note", checked.error);
  const inScope =
    "table" in scope
      ? eq(tables.id, (await requireTable(scope.table.branchCode, scope.table.tableNo)).id)
      : eq(tables.branchId, scope.branchId);

  return db.transaction(async (tx) => {
    // Locks in id order so concurrent batches cannot deadlock; a waiting batch re-reads the new status.
    const rows = await tx
      .select({ id: orderItems.id, status: orderItems.status, name: orderItems.nameSnapshot, tableId: tables.id })
      .from(orderItems)
      .innerJoin(tableSessions, eq(tableSessions.id, orderItems.sessionId))
      .innerJoin(tables, eq(tables.id, tableSessions.tableId))
      .where(and(inArray(orderItems.id, unique), eq(tableSessions.status, "open"), inScope))
      .orderBy(asc(orderItems.id))
      .for("update", { of: orderItems });
    if (rows.length !== unique.length) throw new AppError(404, "item_not_found", "Order item not found");
    if (new Set(rows.map((r) => r.tableId)).size > 1)
      throw new AppError(400, "mixed_tables", "Selected dishes must belong to one table");

    const conflicts = rows.filter((r) => !(a.from as readonly ItemStatus[]).includes(r.status));
    if (conflicts.length) {
      const message =
        action === "request_cancel" && conflicts[0].status === "in_progress"
          ? "This dish is already being prepared and can no longer be cancelled."
          : `Cannot ${a.label.toLowerCase()}: ${conflicts.map((c) => `${c.name} is ${STATUS_LABELS[c.status].toLowerCase()}`).join(", ")}.`;
      throw new AppError(409, "invalid_transition", message, {
        currentStatus: conflicts[0].status,
        conflicts: conflicts.map((c) => ({ id: c.id, name: c.name, status: c.status })),
      });
    }
    if (new Set(rows.map((r) => r.status)).size > 1)
      throw new AppError(400, "mixed_statuses", "Selected dishes must have the same status");

    const at = new Date();
    await tx.update(orderItems).set({ status: a.to, updatedAt: at }).where(inArray(orderItems.id, unique));
    await tx.insert(orderItemEvents).values(
      rows.map((r) => ({
        orderItemId: r.id,
        fromStatus: r.status,
        toStatus: a.to,
        at,
        actor: by.kind,
        staffUserId: by.kind === "staff" ? by.userId : null,
        deviceId: by.kind === "customer" ? by.deviceId : null,
        note: checked.note,
      })),
    );
    return { ids: rows.map((r) => r.id), status: a.to, at: at.toISOString() };
  });
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

export const TABLE_CLEARED = "table cleared";
const UNFINISHED: ItemStatus[] = ["pending", "cancel_requested", "in_progress"];

// Final dish statuses when a Bill closes (order-tracking spec, design D5): served -> finished,
// anything unfinished (only possible on force-clear) -> voided "table cleared"; logged as system, one timestamp.
async function closeSession(tx: Tx, sessionId: number, status: "paid" | "voided") {
  const at = new Date();
  const open = await tx
    .select({ id: orderItems.id, status: orderItems.status })
    .from(orderItems)
    .where(and(eq(orderItems.sessionId, sessionId), inArray(orderItems.status, ["served", ...UNFINISHED])));
  const finish = open.filter((i) => i.status === "served");
  const voids = open.filter((i) => i.status !== "served");
  if (finish.length)
    await tx.update(orderItems).set({ status: "finished", updatedAt: at }).where(inArray(orderItems.id, finish.map((i) => i.id)));
  if (voids.length)
    await tx.update(orderItems).set({ status: "voided", updatedAt: at }).where(inArray(orderItems.id, voids.map((i) => i.id)));
  if (open.length)
    await tx.insert(orderItemEvents).values(
      open.map((i) => ({
        orderItemId: i.id,
        fromStatus: i.status,
        toStatus: i.status === "served" ? ("finished" as const) : ("voided" as const),
        at,
        actor: "system" as const,
        note: i.status === "served" ? null : TABLE_CLEARED,
      })),
    );
  await tx.update(tableSessions).set({ status, closedAt: at }).where(eq(tableSessions.id, sessionId));
  await tx.delete(cartLines).where(eq(cartLines.sessionId, sessionId));
}

// A Bill from another branch behaves exactly like a missing one (D7).
async function lockSessionById(tx: Tx, branchId: number, sessionId: number) {
  const [row] = await tx
    .select({ s: tableSessions })
    .from(tableSessions)
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .where(and(eq(tableSessions.id, sessionId), eq(tables.branchId, branchId)))
    .for("update", { of: tableSessions });
  const s = row?.s;
  if (!s) throw new AppError(404, "bill_not_found", "Bill not found");
  if (s.status !== "open") throw new AppError(409, "bill_closed", `Bill is already ${s.status}`);
  return s;
}

export async function payByTable(branchCode: string, tableNo: number, deviceId: string, force: boolean) {
  const table = await requireTable(branchCode, tableNo);
  return db.transaction(async (tx) => {
    const s = await findOpenSession(tx, table.id, true);
    if (!s) throw new AppError(409, "no_open_bill", "There is no open bill for this table.");
    await assertPayable(tx, s.id, deviceId, force);
    await closeSession(tx, s.id, "paid");
    return { billNo: s.billNo, status: "paid" as const };
  });
}

export async function markPaid(branchId: number, sessionId: number, force: boolean) {
  return db.transaction(async (tx) => {
    const s = await lockSessionById(tx, branchId, sessionId);
    await assertPayable(tx, s.id, null, force);
    await closeSession(tx, s.id, "paid");
    return { billNo: s.billNo, status: "paid" as const };
  });
}

export async function clearSession(branchId: number, sessionId: number) {
  return db.transaction(async (tx) => {
    const s = await lockSessionById(tx, branchId, sessionId);
    await closeSession(tx, s.id, "voided");
    return { billNo: s.billNo, status: "voided" as const };
  });
}

// ---------- console ----------

export async function consoleOverview(branchId: number) {
  const all = await db.select().from(tables).where(eq(tables.branchId, branchId)).orderBy(asc(tables.number));
  const open = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.status, "open"), inArray(tableSessions.tableId, branchTables(branchId))));
  return Promise.all(
    all.map(async (t) => {
      const s = open.find((o) => o.tableId === t.id);
      if (!s) return { tableNumber: t.number, session: null };
      const plain = await sessionItems(db, s.id);
      const notes = await latestNotes(db, plain.map((i) => i.id));
      const items = plain.map((i) => ({ ...i, staffNote: notes.get(i.id) ?? null }));
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

export async function billHistory(branchId: number) {
  return db
    .select({
      id: tableSessions.id,
      billNo: tableSessions.billNo,
      status: tableSessions.status,
      closedAt: tableSessions.closedAt,
      tableNumber: tables.number,
      // CHARGED statuses: served while open, finished once the Bill closed (payment spec, Bill total).
      total: sql<number>`coalesce(sum(${orderItems.unitPrice}) filter (where ${orderItems.status} in ('served', 'finished')), 0)`.mapWith(Number),
    })
    .from(tableSessions)
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .leftJoin(orderItems, eq(orderItems.sessionId, tableSessions.id))
    .where(and(ne(tableSessions.status, "open"), eq(tables.branchId, branchId)))
    .groupBy(tableSessions.id, tables.number)
    .orderBy(desc(tableSessions.closedAt), desc(tableSessions.id));
}

export async function getBill(branchId: number, sessionId: number) {
  const [row] = await db
    .select({ session: tableSessions, tableNumber: tables.number, branchName: branches.name })
    .from(tableSessions)
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .innerJoin(branches, eq(branches.id, tables.branchId))
    .where(and(eq(tableSessions.id, sessionId), eq(tables.branchId, branchId)));
  if (!row) return null;
  const items = await sessionItems(db, sessionId);
  return { ...row.session, tableNumber: row.tableNumber, branchName: row.branchName, items, total: billTotal(items) };
}

// ---------- telemetry (order-history spec, design D7) ----------

const DAY_MS = 24 * 60 * 60 * 1000;

// [from, to) by order time; default last 30 days; at most 366 days.
export function parseRange(from: string | null, to: string | null, now = new Date()) {
  const parse = (v: string | null, fallback: Date) => {
    if (v === null || v === "") return fallback;
    const t = Date.parse(v);
    if (!/^\d{4}-\d{2}-\d{2}/.test(v) || Number.isNaN(t)) throw new AppError(400, "invalid_range", `Invalid date: ${v}`);
    return new Date(t);
  };
  const end = parse(to, now);
  const start = parse(from, new Date(end.getTime() - 30 * DAY_MS));
  if (start > end) throw new AppError(400, "invalid_range", "`from` must not be later than `to`");
  if (end.getTime() - start.getTime() > 366 * DAY_MS) throw new AppError(400, "invalid_range", "Range must be at most 366 days");
  return { from: start, to: end };
}

export function parseMenuItemId(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new AppError(400, "invalid_menu_item", "menuItemId must be a positive integer");
  return n;
}

const inBranchAndRange = (branchId: number, range: { from: Date; to: Date }) =>
  and(eq(tables.branchId, branchId), sql`${tickets.createdAt} >= ${range.from}`, sql`${tickets.createdAt} < ${range.to}`);

// Per menu item: how often ordered, and how those dishes ended (finished / cancelled / voided).
export async function dishCounts(branchId: number, range: { from: Date; to: Date }) {
  const n = (status: ItemStatus) => sql<number>`count(*) filter (where ${orderItems.status} = ${status})`.mapWith(Number);
  return db
    .select({
      menuItemId: orderItems.menuItemId,
      name: sql<string>`(array_agg(${orderItems.nameSnapshot} order by ${orderItems.id} desc))[1]`,
      ordered: sql<number>`count(*)`.mapWith(Number),
      finished: n("finished"),
      cancelled: n("cancelled"),
      voided: n("voided"),
    })
    .from(orderItems)
    .innerJoin(tickets, eq(tickets.id, orderItems.ticketId))
    .innerJoin(tableSessions, eq(tableSessions.id, orderItems.sessionId))
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .where(inBranchAndRange(branchId, range))
    .groupBy(orderItems.menuItemId)
    .orderBy(desc(sql`count(*)`), asc(orderItems.menuItemId));
}

export const TIMELINE_LIMIT = 500;

// Individual dishes (newest first, capped) with their full status log in time order.
export async function dishTimelines(branchId: number, range: { from: Date; to: Date }, menuItemId?: number) {
  const items = await db
    .select({
      id: orderItems.id,
      menuItemId: orderItems.menuItemId,
      name: orderItems.nameSnapshot,
      status: orderItems.status,
      billNo: tableSessions.billNo,
      tableNumber: tables.number,
      orderedAt: tickets.createdAt,
    })
    .from(orderItems)
    .innerJoin(tickets, eq(tickets.id, orderItems.ticketId))
    .innerJoin(tableSessions, eq(tableSessions.id, orderItems.sessionId))
    .innerJoin(tables, eq(tables.id, tableSessions.tableId))
    .where(and(inBranchAndRange(branchId, range), menuItemId ? eq(orderItems.menuItemId, menuItemId) : undefined))
    .orderBy(desc(tickets.createdAt), desc(orderItems.id))
    .limit(TIMELINE_LIMIT);
  if (!items.length) return [];
  const events = await db
    .select({
      orderItemId: orderItemEvents.orderItemId,
      from: orderItemEvents.fromStatus,
      to: orderItemEvents.toStatus,
      at: orderItemEvents.at,
      actor: orderItemEvents.actor,
      username: users.username,
      note: orderItemEvents.note,
    })
    .from(orderItemEvents)
    .leftJoin(users, eq(users.id, orderItemEvents.staffUserId))
    .where(inArray(orderItemEvents.orderItemId, items.map((i) => i.id)))
    .orderBy(asc(orderItemEvents.at), asc(orderItemEvents.id));
  return items.map((i) => ({
    ...i,
    orderedAt: i.orderedAt.toISOString(),
    events: events
      .filter((e) => e.orderItemId === i.id)
      .map((e) => ({
        from: e.from,
        to: e.to,
        at: e.at.toISOString(),
        by: e.actor === "staff" ? (e.username ?? "staff") : e.actor,
        note: e.note,
      })),
  }));
}
