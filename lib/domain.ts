// Pure domain rules shared by API and UI. No DB access here.

export const CATEGORIES = ["main", "a_la_carte", "soup", "special", "dessert", "drink"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  main: "Main",
  a_la_carte: "A la carte",
  soup: "Soup",
  special: "Special",
  dessert: "Dessert",
  drink: "Drink",
};

export const ITEM_STATUSES = ["pending", "cancel_requested", "in_progress", "served", "cancelled", "voided", "finished"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type Actor = "customer" | "staff";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: "Pending",
  cancel_requested: "Cancel requested",
  in_progress: "In progress",
  served: "Served",
  cancelled: "Cancelled",
  voided: "Voided",
  finished: "Finished",
};

// Customers never see why staff removed a dish: both removal kinds read "Cancelled" (order-tracking spec).
export function customerLabel(status: ItemStatus): string {
  return status === "voided" ? STATUS_LABELS.cancelled : STATUS_LABELS[status];
}

// The only user-initiated OrderItem transitions (order-tracking spec). Closing a Bill is a system step (D5).
// reason: "required" = void needs a reason; "optional" = cancel decisions may carry a remark (design D3).
export const ACTIONS = {
  start: { from: ["pending"], to: "in_progress", actor: "staff", label: "Start", reason: "none" },
  serve: { from: ["in_progress"], to: "served", actor: "staff", label: "Serve", reason: "none" },
  void: { from: ["pending", "in_progress"], to: "voided", actor: "staff", label: "Void", reason: "required" },
  confirm_cancel: { from: ["cancel_requested"], to: "cancelled", actor: "staff", label: "Confirm cancel", reason: "optional" },
  reject_cancel: { from: ["cancel_requested"], to: "pending", actor: "staff", label: "Reject cancel", reason: "optional" },
  request_cancel: { from: ["pending"], to: "cancel_requested", actor: "customer", label: "Cancel", reason: "none" },
} as const satisfies Record<
  string,
  { from: readonly ItemStatus[]; to: ItemStatus; actor: Actor; label: string; reason: "none" | "optional" | "required" }
>;
export type Action = keyof typeof ACTIONS;

export function isAction(a: unknown): a is Action {
  return typeof a === "string" && Object.hasOwn(ACTIONS, a);
}

export function canTransition(from: ItemStatus, to: ItemStatus, actor: Actor): boolean {
  return Object.values(ACTIONS).some(
    (a) => a.actor === actor && a.to === to && (a.from as readonly ItemStatus[]).includes(from),
  );
}

export function actionsFor(status: ItemStatus, actor: Actor): Action[] {
  return (Object.keys(ACTIONS) as Action[]).filter(
    (k) => ACTIONS[k].actor === actor && (ACTIONS[k].from as readonly ItemStatus[]).includes(status),
  );
}

// Statuses that let a Bill be paid; and those that are charged (served now, finished once the Bill closed).
export const RESOLVED: readonly ItemStatus[] = ["served", "cancelled", "voided"];
export const CHARGED: readonly ItemStatus[] = ["served", "finished"];

// Bill total = charged items only; unitPrice already includes option deltas.
export function billTotal(items: { status: ItemStatus; unitPrice: number }[]): number {
  return items.reduce((sum, i) => (CHARGED.includes(i.status) ? sum + i.unitPrice : sum), 0);
}

// A customer page keeps refreshing only while there is something to watch (order-tracking spec).
export function customerShouldPoll(hasOpenSession: boolean, ownCartQty: number): boolean {
  return hasOpenSession || ownCartQty > 0;
}

export const REASON_MIN = 3;
export const REASON_MAX = 500;

// Normalises a void reason / cancel remark for an action; returns an error message instead when invalid.
export function checkNote(action: Action, note: unknown): { note: string | null } | { error: string } {
  const text = typeof note === "string" ? note.trim() : "";
  if (note !== undefined && note !== null && typeof note !== "string") return { error: "Note must be text" };
  if (text.length > REASON_MAX) return { error: `Note must be at most ${REASON_MAX} characters` };
  if (ACTIONS[action].reason === "required" && text.length < REASON_MIN)
    return { error: `A reason of at least ${REASON_MIN} characters is required` };
  return { note: ACTIONS[action].reason === "none" || !text ? null : text };
}

// Traditional-like layout: 8 per page (4 cols x 2 rows), each category starts a new page.
export const PAGE_SIZE = 8;
export type MenuPage<T> = { category: Category; items: T[] };

export function paginateByCategory<T extends { category: Category }>(items: T[], pageSize = PAGE_SIZE): MenuPage<T>[] {
  const pages: MenuPage<T>[] = [];
  for (const category of CATEGORIES) {
    const inCat = items.filter((i) => i.category === category);
    for (let i = 0; i < inCat.length; i += pageSize) pages.push({ category, items: inCat.slice(i, i + pageSize) });
  }
  return pages;
}
