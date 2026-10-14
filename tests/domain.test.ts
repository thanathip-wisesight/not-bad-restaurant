import { describe, expect, it } from "vitest";
import { ITEM_STATUSES, actionsFor, billTotal, canTransition, paginateByCategory, type ItemStatus } from "../lib/domain";

describe("OrderItem transitions (order-tracking spec)", () => {
  const allowed: [ItemStatus, ItemStatus, "customer" | "staff"][] = [
    ["pending", "in_progress", "staff"],
    ["pending", "cancel_requested", "customer"],
    ["cancel_requested", "cancelled", "staff"],
    ["cancel_requested", "pending", "staff"],
    ["in_progress", "served", "staff"],
    ["pending", "cancelled", "staff"],
    ["in_progress", "cancelled", "staff"],
  ];

  it("allows exactly the specified transitions", () => {
    for (const from of ITEM_STATUSES)
      for (const to of ITEM_STATUSES)
        for (const actor of ["customer", "staff"] as const) {
          const expected = allowed.some(([f, t, a]) => f === from && t === to && a === actor);
          expect(canTransition(from, to, actor), `${from}->${to} by ${actor}`).toBe(expected);
        }
  });

  it("blocks starting an item with a cancel request", () => {
    expect(canTransition("cancel_requested", "in_progress", "staff")).toBe(false);
  });

  it("customer cannot withdraw a cancel request", () => {
    expect(canTransition("cancel_requested", "pending", "customer")).toBe(false);
  });

  it("offers only valid actions per status", () => {
    expect(actionsFor("pending", "staff")).toEqual(["start", "void"]);
    expect(actionsFor("in_progress", "staff")).toEqual(["serve", "void"]);
    expect(actionsFor("cancel_requested", "staff")).toEqual(["confirm_cancel", "reject_cancel"]);
    expect(actionsFor("served", "staff")).toEqual([]);
    expect(actionsFor("pending", "customer")).toEqual(["request_cancel"]);
    expect(actionsFor("in_progress", "customer")).toEqual([]);
  });
});

describe("billTotal (payment spec)", () => {
  it("sums served items only", () => {
    expect(
      billTotal([
        { status: "served", unitPrice: 90 },
        { status: "served", unitPrice: 50 },
        { status: "cancelled", unitPrice: 80 },
        { status: "in_progress", unitPrice: 100 },
      ]),
    ).toBe(140);
  });
});

describe("paginateByCategory (menu-browsing spec)", () => {
  it("splits 10 soups into 8 + 2 and starts the next category on a new page", () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) => ({ category: "main" as const, id: `m${i}` })),
      ...Array.from({ length: 10 }, (_, i) => ({ category: "soup" as const, id: `s${i}` })),
      { category: "dessert" as const, id: "d0" },
    ];
    const pages = paginateByCategory(items);
    expect(pages.map((p) => [p.category, p.items.length])).toEqual([
      ["main", 3],
      ["soup", 8],
      ["soup", 2],
      ["dessert", 1],
    ]);
  });
});
