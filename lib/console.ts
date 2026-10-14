// Pure helpers for the kitchen board (console-desktop-layout design D1).
import type { ItemStatus } from "./domain";
import type { ConsoleTableDto, OrderItemDto } from "./service";

export const BOARD_COLUMNS = ["cancel_requested", "pending", "in_progress", "served"] as const satisfies readonly ItemStatus[];
export type BoardStatus = (typeof BOARD_COLUMNS)[number];
export type BoardCard = OrderItemDto & { tableNumber: number };

// Open-bill dishes grouped by status; cancelled dropped. Waiting columns oldest first, Served newest first.
export function boardColumns(tables: Pick<ConsoleTableDto, "tableNumber" | "session">[]): Record<BoardStatus, BoardCard[]> {
  const cols = { cancel_requested: [], pending: [], in_progress: [], served: [] } as Record<BoardStatus, BoardCard[]>;
  for (const t of tables)
    for (const item of t.session?.items ?? [])
      if (item.status !== "cancelled") cols[item.status].push({ ...item, tableNumber: t.tableNumber });
  for (const s of BOARD_COLUMNS)
    cols[s].sort((a, b) => (s === "served" ? -1 : 1) * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)));
  return cols;
}

export function formatElapsed(updatedAt: string, now: number): string {
  return `${Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 60_000))} min`;
}
