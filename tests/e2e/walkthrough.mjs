// End-to-end walkthrough (tasks 5.x, 6.x, 7.1): two phones + console against a running server.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = new URL("./shots/", import.meta.url).pathname; // gitignored
const browser = await chromium.launch({ channel: "chrome", headless: true });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const ctxA = await browser.newContext(phone);
const ctxB = await browser.newContext(phone);
const ctxC = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const A = await ctxA.newPage();
const B = await ctxB.newPage();
const C = await ctxC.newPage();
C.on("dialog", (d) => d.accept());
const step = (s) => console.log("✓", s);
const shot = (p, name) => p.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });
const nav = (p, label) => p.locator("nav").getByRole("button", { name: new RegExp(`^${label}`) }).click();
const within10s = { timeout: 10_000 };

try {
  // Unknown table
  await A.goto(`${BASE}/t/99`);
  await A.getByText("Table not found").waitFor();
  step("unknown table shows 'Table not found'");

  // Menu + layouts
  await A.goto(`${BASE}/t/5`);
  await A.getByRole("heading", { name: "Table 5" }).waitFor();
  const tabs = await A.locator("main div.sticky button").allTextContents();
  assert.deepEqual(tabs, ["Main", "A la carte", "Soup", "Special", "Dessert", "Drink"]);
  await A.getByRole("button", { name: "📖 Traditional" }).waitFor();
  step("menu shows table number, six tabs in order, Modern by default");
  await shot(A, "01-modern");

  await A.getByRole("button", { name: "📖 Traditional" }).click();
  await A.reload();
  await A.getByRole("button", { name: "📱 Modern" }).waitFor();
  step("Traditional layout persists across reload");
  await A.locator("main div.sticky button", { hasText: "Soup" }).click();
  await A.waitForTimeout(800);
  const pageTitles = await A.locator("[data-testid=traditional-pager] section h2").allTextContents();
  const soupPages = pageTitles.filter((t) => t.startsWith("Soup"));
  assert.equal(soupPages.length, 2, "10 soups -> 2 pages");
  const soupCounts = await A.locator("[data-testid=traditional-pager] section", { hasText: /^Soup/ }).evaluateAll((els) =>
    els.map((e) => e.querySelectorAll("button").length),
  );
  assert.deepEqual(soupCounts, [8, 2]);
  await shot(A, "02-traditional-soup");
  step("Traditional: Soup spans 2 pages (8 + 2), tab jumps to it");
  await A.getByRole("button", { name: "📱 Modern" }).click();

  // Options sheet + cart
  const padThaiCard = A.locator("div.rounded-lg", { hasText: "Pad Thai with Shrimp" }).first();
  await padThaiCard.getByRole("button", { name: "Add" }).click();
  await A.getByRole("button", { name: "Cancel" }).click();
  await nav(A, "Cart");
  await A.getByText("Your cart is empty.").waitFor();
  step("options Cancel leaves cart unchanged");

  await nav(A, "Menu");
  await padThaiCard.getByRole("button", { name: "Add" }).click();
  await A.getByLabel("Extra egg").check();
  await A.getByPlaceholder("e.g. no beansprout!").fill("no beansprout!");
  await shot(A, "03-options");
  await A.getByRole("button", { name: "Confirm" }).click();
  await nav(A, "Cart");
  await A.getByText("“no beansprout!”").waitFor();
  assert.ok(await A.getByText("฿90").first().isVisible());
  step("add with extra + note -> cart line ฿90");

  await A.getByRole("button", { name: "Edit" }).click();
  await A.getByLabel("Increase quantity").click();
  await A.getByRole("button", { name: "Save" }).click();
  await A.locator("div.font-semibold", { hasText: "Total" }).getByText("฿180").waitFor();
  step("edit qty 1 -> 2, total ฿180");

  await nav(A, "Menu");
  await A.locator("div.rounded-lg", { hasText: "Thai Iced Tea" }).getByRole("button", { name: "Add" }).click();
  await A.getByRole("button", { name: "Confirm" }).click();
  await nav(A, "Cart");
  await A.locator("li", { hasText: "Thai Iced Tea" }).getByRole("button", { name: "Remove" }).click();
  await A.locator("li", { hasText: "Thai Iced Tea" }).waitFor({ state: "detached" });
  step("remove cart line");
  await shot(A, "04-cart");

  // Phone B: own cart
  await B.goto(`${BASE}/t/5`);
  await nav(B, "Cart");
  await B.getByText("Your cart is empty.").waitFor();
  step("phone B has its own empty cart");
  await nav(B, "Menu");
  await B.locator("div.rounded-lg", { hasText: "Coke" }).getByRole("button", { name: "Add" }).click();
  await B.getByRole("button", { name: "Confirm" }).click();

  // Confirm on A
  await nav(A, "Cart");
  await A.getByRole("button", { name: "Confirm order" }).click();
  await A.getByText("Order sent to the kitchen.").waitFor();
  await A.locator("main li").filter({ hasText: "Pending" }).nth(1).waitFor();
  assert.equal(await A.locator("main li").filter({ hasText: "Pending" }).count(), 2);
  step("confirm: qty 2 -> two pending items, Orders tab shown");
  await nav(B, "Orders");
  await B.locator("main li").filter({ hasText: "Pending" }).nth(1).waitFor(within10s);
  await nav(B, "Cart");
  await B.getByText("Coke").waitFor();
  step("phone B sees A's items; B's cart kept");

  // Cancel request flow
  await nav(A, "Orders");
  await A.locator("main li").first().getByRole("button", { name: "Cancel" }).click();
  await A.getByText("Cancel requested", { exact: true }).first().waitFor();
  await C.goto(`${BASE}/console`);
  const t5 = C.locator("section", { has: C.getByRole("heading", { name: "Table 5" }) });
  const req = t5.locator("li.bg-amber-100");
  await req.waitFor(within10s);
  assert.equal(await req.getByRole("button", { name: "Start" }).count(), 0, "start not offered on cancel_requested");
  await shot(C, "05-console-cancel-request");
  await req.getByRole("button", { name: "Reject cancel" }).click();
  await t5.locator("li").first().getByRole("button", { name: "Start" }).click();
  await t5.locator("li").first().getByRole("button", { name: "Serve" }).click();
  await t5.locator("li").first().getByText("Served").waitFor();
  step("console: cancel request highlighted, reject -> pending, start, serve");

  await A.locator("main li").filter({ hasText: "Served" }).first().waitFor(within10s);
  step("customer sees Served within 10 s");
  await A.locator("main li").nth(1).getByRole("button", { name: "Cancel" }).click();
  await t5.locator("li.bg-amber-100").getByRole("button", { name: "Confirm cancel" }).click(within10s);
  await A.locator("main li").nth(1).getByText("Cancelled").waitFor(within10s);
  step("cancel request -> staff confirm -> Cancelled");

  // Pay with warning about B's unsent cart
  await A.getByRole("button", { name: "Pay", exact: true }).click();
  await A.getByText(/1 unsent dish\(es\) on other phones/).waitFor();
  await shot(A, "06-pay-warning");
  await A.getByRole("button", { name: "Back" }).click();
  await A.getByRole("button", { name: "Pay", exact: true }).click();
  await A.getByRole("button", { name: "Pay anyway" }).click();
  await A.getByRole("heading", { name: /Pay with QR/ }).waitFor();
  await shot(A, "07-banks");
  await A.getByRole("button", { name: "K PLUS (simulated)" }).click();
  await A.getByText("Payment successful. Thank you!").waitFor();
  step("pay: warning -> Back keeps state; Pay anyway -> stub bank -> success banner");

  await nav(B, "Orders");
  await B.getByText("No orders yet.").waitFor(within10s);
  await nav(B, "Cart");
  await B.getByText("Your cart is empty.").waitFor(within10s);
  await t5.getByText("Free").waitFor(within10s);
  step("session closed: B sees no orders, B's unsent cart discarded, console shows Free");

  // Mark paid + clear on other tables
  const P4 = await ctxA.newPage();
  await P4.goto(`${BASE}/t/4`);
  await P4.locator("div.rounded-lg", { hasText: "Coke" }).getByRole("button", { name: "Add" }).click();
  await P4.getByRole("button", { name: "Confirm" }).click();
  await nav(P4, "Cart");
  await P4.getByRole("button", { name: "Confirm order" }).click();
  const t4 = C.locator("section", { has: C.getByRole("heading", { name: "Table 4" }) });
  await t4.getByRole("button", { name: "Mark paid" }).click(within10s);
  await C.getByRole("alert").getByText(/Cannot mark paid/).waitFor();
  await t4.getByRole("button", { name: "Start" }).click();
  await t4.getByRole("button", { name: "Serve" }).click();
  await t4.getByRole("button", { name: "Mark paid" }).click();
  await t4.getByText("Free").waitFor();
  step("console mark paid: blocked while unresolved, then paid");

  const P3 = await ctxB.newPage();
  await P3.goto(`${BASE}/t/3`);
  await P3.locator("div.rounded-lg", { hasText: "Drinking Water" }).getByRole("button", { name: "Add" }).click();
  await P3.getByRole("button", { name: "Confirm" }).click();
  const t3 = C.locator("section", { has: C.getByRole("heading", { name: "Table 3" }) });
  await t3.getByRole("button", { name: "Clear table" }).click(within10s);
  await t3.getByText("Free").waitFor();
  step("console clear table (with confirm prompt)");

  // History + receipt
  await C.goto(`${BASE}/console/history`);
  const rows = await C.locator("tbody tr").allTextContents();
  assert.equal(rows.length, 3);
  assert.match(rows[0], /T03-.*voided/);
  assert.match(rows[2], /T05-.*฿90.*paid/);
  await shot(C, "08-history");
  await C.locator("tbody tr").nth(2).getByRole("link", { name: "Open / print" }).click();
  await C.getByText("RECEIPT", { exact: true }).waitFor();
  const receipt = await C.locator("main.font-mono").innerText();
  assert.match(receipt, /Table: 5/);
  assert.match(receipt, /\+ Extra egg/);
  assert.match(receipt, /TOTAL\s*฿90/);
  assert.match(receipt, /PAID/);
  assert.match(receipt, /not a tax invoice/);
  await shot(C, "09-receipt");
  await C.reload();
  const norm = (t) => t.replace(/\s+/g, "");
  assert.equal(norm(await C.locator("main.font-mono").textContent()), norm(receipt));
  step("history newest first; receipt content correct and identical on reprint");

  console.log("\nWALKTHROUGH PASSED");
} catch (e) {
  await shot(A, "fail-A").catch(() => {});
  await shot(B, "fail-B").catch(() => {});
  await shot(C, "fail-C").catch(() => {});
  console.error("\nWALKTHROUGH FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
