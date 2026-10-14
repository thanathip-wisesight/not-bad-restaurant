import { describe, expect, it } from "vitest";
import {
  ITEM_STATUSES,
  actionsFor,
  billTotal,
  canTransition,
  checkNote,
  customerLabel,
  customerShouldPoll,
  paginateByCategory,
  type ItemStatus,
} from "../lib/domain";

describe("OrderItem transitions (order-tracking spec)", () => {
  const allowed: [ItemStatus, ItemStatus, "customer" | "staff"][] = [
    ["pending", "in_progress", "staff"],
    ["pending", "cancel_requested", "customer"],
    ["cancel_requested", "cancelled", "staff"],
    ["cancel_requested", "pending", "staff"],
    ["in_progress", "served", "staff"],
    ["pending", "voided", "staff"],
    ["in_progress", "voided", "staff"],
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
  it("sums served and finished items only", () => {
    expect(
      billTotal([
        { status: "served", unitPrice: 90 },
        { status: "finished", unitPrice: 50 },
        { status: "cancelled", unitPrice: 80 },
        { status: "voided", unitPrice: 120 },
        { status: "in_progress", unitPrice: 100 },
      ]),
    ).toBe(140);
  });
});

describe("void reason and cancel remark (order-tracking spec)", () => {
  it("void needs at least 3 characters after trimming", () => {
    expect(checkNote("void", "  ")).toHaveProperty("error");
    expect(checkNote("void", "ok")).toHaveProperty("error");
    expect(checkNote("void", undefined)).toHaveProperty("error");
    expect(checkNote("void", "  abc ")).toEqual({ note: "abc" });
  });

  it("caps every note at 500 characters and rejects non-text", () => {
    expect(checkNote("confirm_cancel", "x".repeat(501))).toHaveProperty("error");
    expect(checkNote("void", "x".repeat(500))).toEqual({ note: "x".repeat(500) });
    expect(checkNote("reject_cancel", 42)).toHaveProperty("error");
  });

  it("cancel decisions take an optional remark; other actions drop notes", () => {
    expect(checkNote("confirm_cancel", undefined)).toEqual({ note: null });
    expect(checkNote("reject_cancel", " customer changed mind ")).toEqual({ note: "customer changed mind" });
    expect(checkNote("start", "ignored")).toEqual({ note: null });
  });
});

describe("customer labels", () => {
  it("customers see voided as Cancelled", () => {
    expect(customerLabel("voided")).toBe("Cancelled");
    expect(customerLabel("cancelled")).toBe("Cancelled");
    expect(customerLabel("served")).toBe("Served");
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

describe("customer refresh pause (order-tracking spec)", () => {
  it("polls only with an open Bill or a non-empty own cart", () => {
    expect(customerShouldPoll(true, 0)).toBe(true);
    expect(customerShouldPoll(false, 2)).toBe(true);
    expect(customerShouldPoll(false, 0)).toBe(false);
  });
});
