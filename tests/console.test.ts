import { describe, expect, it } from "vitest";
import { BOARD_COLUMNS, boardColumns, formatElapsed } from "../lib/console";
import type { ItemStatus } from "../lib/domain";

const item = (id: number, status: ItemStatus, minutesAgo: number) => ({
  id,
  ticketId: 1,
  name: `Dish ${id}`,
  options: [],
  note: "",
  unitPrice: 50,
  status,
  updatedAt: new Date(Date.UTC(2026, 0, 1, 12, 0) - minutesAgo * 60_000).toISOString(),
});
const table = (tableNumber: number, items: ReturnType<typeof item>[]) => ({
  tableNumber,
  session: { id: tableNumber, billNo: `T${tableNumber}`, openedAt: new Date(), items, total: 0, unsentCartQty: 0 },
});

describe("boardColumns", () => {
  const cols = boardColumns([
    table(2, [item(1, "pending", 6), item(2, "served", 10), item(3, "cancelled", 1)]),
    table(7, [item(4, "pending", 1), item(5, "served", 2), item(6, "cancel_requested", 3), item(7, "in_progress", 5)]),
    { tableNumber: 3, session: null },
  ]);

  it("has the four columns in board order", () => {
    expect(Object.keys(cols)).toEqual([...BOARD_COLUMNS]);
    expect(BOARD_COLUMNS).toEqual(["cancel_requested", "pending", "in_progress", "served"]);
  });

  it("drops cancelled dishes and tags table numbers", () => {
    expect(Object.values(cols).flat().map((c) => c.id)).not.toContain(3);
    expect(cols.cancel_requested.map((c) => c.tableNumber)).toEqual([7]);
  });

  it("sorts waiting columns oldest first and served newest first", () => {
    expect(cols.pending.map((c) => c.tableNumber)).toEqual([2, 7]);
    expect(cols.served.map((c) => c.id)).toEqual([5, 2]);
  });
});

describe("formatElapsed", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0);
  it("formats whole minutes, never negative", () => {
    expect(formatElapsed(new Date(now - 4 * 60_000 - 59_000).toISOString(), now)).toBe("4 min");
    expect(formatElapsed(new Date(now - 30_000).toISOString(), now)).toBe("0 min");
    expect(formatElapsed(new Date(now + 5_000).toISOString(), now)).toBe("0 min");
  });
});
