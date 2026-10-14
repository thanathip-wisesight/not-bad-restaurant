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

export const ITEM_STATUSES = ["pending", "cancel_requested", "in_progress", "served", "cancelled"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type Actor = "customer" | "staff";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: "Pending",
  cancel_requested: "Cancel requested",
  in_progress: "In progress",
  served: "Served",
  cancelled: "Cancelled",
};

// The only allowed OrderItem transitions (order-tracking spec).
export const ACTIONS = {
  start: { from: ["pending"], to: "in_progress", actor: "staff", label: "Start" },
  serve: { from: ["in_progress"], to: "served", actor: "staff", label: "Serve" },
  void: { from: ["pending", "in_progress"], to: "cancelled", actor: "staff", label: "Void" },
  confirm_cancel: { from: ["cancel_requested"], to: "cancelled", actor: "staff", label: "Confirm cancel" },
  reject_cancel: { from: ["cancel_requested"], to: "pending", actor: "staff", label: "Reject cancel" },
  request_cancel: { from: ["pending"], to: "cancel_requested", actor: "customer", label: "Cancel" },
} as const satisfies Record<string, { from: readonly ItemStatus[]; to: ItemStatus; actor: Actor; label: string }>;
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

export const RESOLVED: readonly ItemStatus[] = ["served", "cancelled"];

// Bill total = served items only; unitPrice already includes option deltas.
export function billTotal(items: { status: ItemStatus; unitPrice: number }[]): number {
  return items.reduce((sum, i) => (i.status === "served" ? sum + i.unitPrice : sum), 0);
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
