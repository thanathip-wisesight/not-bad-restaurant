// End-to-end walkthrough (tasks 5.x, 6.x, 7.1): two phones + console against a running server.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = new URL("./shots/", import.meta.url).pathname; // gitignored
const browser = await chromium.launch({ channel: "chrome", headless: true });
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const ctxA = await browser.newContext(phone);
const ctxB = await browser.newContext(phone);
const ctxC = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const A = await ctxA.newPage();
const B = await ctxB.newPage();
const C = await ctxC.newPage();
C.on("dialog", (d) => d.accept());
const step = (s) => console.log("✓", s);
async function logIn(page, username, password) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}
const shot = (p, name) => p.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });
const nav = (p, label) => p.locator("nav").getByRole("button", { name: new RegExp(`^${label}`) }).click();
const within10s = { timeout: 10_000 };

try {
  // Unknown table
  for (const path of ["/t/5", "/b/SIAM/t/99", "/b/NOPE/t/1", "/b/ASOK/t/8"]) {
    await A.goto(`${BASE}${path}`);
    await A.getByText("Table not found").waitFor();
  }
  step("old /t/5, unknown table, unknown branch, ASOK table 8 all show 'Table not found'");

  // Menu + layouts
  await A.goto(`${BASE}/b/SIAM/t/5`);
  await A.getByRole("heading", { name: "Table 5" }).waitFor();
  await A.getByText("Not Bad Siam").waitFor();
  const tabs = await A.locator("main div.sticky button").allTextContents();
  assert.deepEqual(tabs, ["Main", "A la carte", "Soup", "Special", "Dessert", "Drink"]);
  await A.getByRole("button", { name: "📖 Traditional" }).waitFor();
  step("menu shows table number, six tabs in order, Modern by default");
  await shot(A, "01-modern");

  // Traditional is landscape-only (menu-browsing spec): upright falls back to Modern with a hint
  const pager = A.getByTestId("traditional-pager");
  const indicator = A.getByTestId("page-indicator");
  await A.getByRole("button", { name: "📖 Traditional" }).click();
  await A.getByText("Turn your phone sideways").waitFor();
  assert.equal(await pager.count(), 0, "no Traditional pager while upright");
  assert.ok(await A.getByRole("heading", { name: "Main", exact: true }).isVisible(), "Modern shown upright");
  await shot(A, "02a-portrait-hint");
  step("Traditional chosen while upright -> Modern with turn-sideways hint");

  await A.setViewportSize({ width: 844, height: 390 });
  await pager.waitFor();
  assert.equal(await A.locator("nav").count(), 0, "bottom tab bar replaced by compact top bar");
  const noVScroll = () => A.evaluate(() => document.documentElement.scrollHeight <= innerHeight);
  assert.ok(await noVScroll(), "landscape page does not scroll vertically");
  await A.reload();
  await pager.waitFor();
  step("rotated to landscape -> Traditional; choice survives reload in landscape");

  await A.getByTestId("category-tabs").getByRole("button", { name: "Soup" }).click();
  await indicator.getByText(/^Soup · \d+\/\d+$/).waitFor();
  const soupCounts = await A.getByRole("region", { name: "Soup page" }).evaluateAll((els) =>
    els.map((e) => e.querySelectorAll("button").length),
  );
  assert.deepEqual(soupCounts, [8, 2], "10 soups -> 8 + 2");
  const [, soupFirst, total] = (await indicator.innerText()).match(/(\d+)\/(\d+)/);
  await A.getByRole("button", { name: "Next page" }).click();
  await indicator.getByText(`Soup · ${+soupFirst + 1}/${total}`).waitFor();
  await A.waitForTimeout(500);
  await shot(A, "02b-traditional-soup-p2");
  step("Soup tab jumps to Soup; 4x2 pages split 8 + 2; next-page control and indicator");

  await A.getByRole("button", { name: /^Cart/ }).click();
  await A.getByRole("dialog", { name: "Cart" }).getByText("Your cart is empty.").waitFor();
  await A.getByRole("dialog", { name: "Cart" }).getByRole("button", { name: "Close" }).click();
  await indicator.getByText(`Soup · ${+soupFirst + 1}/${total}`).waitFor();
  step("cart overlay closes back to the same page");

  for (const [w, h] of [[844, 390], [667, 375]]) {
    await A.setViewportSize({ width: w, height: h });
    await A.waitForTimeout(300);
    assert.ok(await noVScroll(), `no vertical scroll at ${w}x${h}`);
    await A.getByTestId("category-tabs").getByRole("button", { name: "Main" }).click();
    await A.getByRole("region", { name: "Main page" }).first().getByRole("button", { name: "Add" }).first().click();
    const dialog = A.getByRole("dialog", { name: /Options for/ });
    const confirm = dialog.getByRole("button", { name: "Confirm" });
    await confirm.scrollIntoViewIfNeeded();
    const box = await confirm.boundingBox();
    assert.ok(box && box.y + box.height <= h, `Confirm reachable at ${w}x${h}`);
    await A.waitForTimeout(300);
    await shot(A, `02c-options-${w}x${h}`);
    await dialog.getByRole("button", { name: "Cancel" }).click();
  }
  step("options overlay fits/scrolls with Confirm reachable at 844x390 and 667x375");

  await A.setViewportSize({ width: 390, height: 844 });
  await A.getByText("Turn your phone sideways").waitFor();
  await A.getByRole("button", { name: "📱 Modern" }).click();
  await A.getByRole("button", { name: "📖 Traditional" }).waitFor();
  step("rotated upright -> Modern again; switched back to Modern");

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
  await B.goto(`${BASE}/b/SIAM/t/5`);
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

  // Cancel request flow, driven through the kitchen board (console-desktop-layout)
  await nav(A, "Orders");
  await A.locator("main li").first().getByRole("button", { name: "Cancel" }).click();
  await A.getByText("Cancel requested", { exact: true }).first().waitFor();
  // Staff login (console-access): wrong password first, then single-branch user lands on SIAM
  await C.goto(`${BASE}/console`);
  await C.waitForURL(/\/login\?next=%2Fconsole$/);
  await logIn(C, "siam.staff", "wrong-password");
  await C.getByRole("alert").getByText("Invalid username or password").waitFor();
  await logIn(C, "siam.staff", "siam-demo");
  await C.waitForURL(`${BASE}/console/SIAM`);
  await C.getByRole("heading", { name: /Restaurant console · Not Bad Siam/ }).waitFor();
  assert.equal(await C.getByRole("link", { name: "Switch branch" }).count(), 0, "single-branch user has no branch switch");
  step("console redirects to login; wrong password is generic; siam.staff lands on /console/SIAM");
  const board = C.getByTestId("kitchen-board");
  const strip = C.getByTestId("table-strip");
  const col = (name) => board.getByRole("region", { name, exact: true });
  const req = col("Cancel requested").locator("li", { hasText: "Table 5" });
  await req.waitFor(within10s);
  assert.equal(await req.getByRole("button", { name: "Start" }).count(), 0, "start not offered on cancel_requested");
  assert.match(await col("Cancel requested").locator("h2").getAttribute("class"), /bg-amber-300/);
  assert.equal(await col("Cancel requested").getByTestId("column-count").innerText(), "1");
  assert.match(await req.getByTestId("elapsed").innerText(), /^\d+ min$/);
  assert.match(await req.innerText(), /Extra egg[\s\S]*no beansprout!/);
  assert.match(await strip.getByRole("button", { name: /Table 5/ }).innerText(), /T05-\d{4} · ฿0 · 2 open/);
  assert.match(await strip.locator(":scope > span", { hasText: "Table 3" }).innerText(), /Free/);
  step("board: cancel request column highlighted with count, card content, strip chips");

  for (const [w, h] of [[768, 1024], [1920, 1080]]) {
    await C.setViewportSize({ width: w, height: h });
    assert.ok(await board.isVisible(), `board visible at ${w}`);
    assert.equal(await C.locator("main").count(), 1, `one console main at ${w}`);
    await C.waitForTimeout(500); // let the compositor repaint after resize, or the shot shows stale tiles
    await shot(C, `05-board-${w}x${h}`);
  }
  await C.setViewportSize({ width: 1280, height: 800 });
  await C.waitForTimeout(500);
  await shot(C, "05-board-1280x800");
  const D = await ctxC.newPage(); // same staff session, phone-sized
  await D.setViewportSize({ width: 390, height: 844 });
  await D.goto(`${BASE}/console/SIAM`);
  const bar = D.getByTestId("count-bar");
  await bar.getByText("1 cancel requested").waitFor();
  assert.ok(await bar.getByText("1 pending").isVisible());
  assert.equal(await D.getByTestId("kitchen-board").isVisible(), false, "no board on phone");
  await shot(D, "05-phone-console");
  await D.close();
  step("board at 768/1280/1920 px; phone shows card list with count bar");

  await req.getByRole("button", { name: "Reject cancel" }).click();
  await col("Pending").locator("li", { hasText: "Table 5" }).nth(1).waitFor();
  await col("Pending").locator("li").first().getByRole("button", { name: "Start" }).click();
  await col("In progress").locator("li", { hasText: "Table 5" }).getByRole("button", { name: "Serve" }).click();
  await col("Served").locator("li", { hasText: "Table 5" }).waitFor();
  step("board: reject -> pending, start moves to In progress, serve moves to Served");

  await A.locator("main li").filter({ hasText: "Served" }).first().waitFor(within10s);
  step("customer sees Served within 10 s");
  await A.locator("main li").filter({ hasText: "Pending" }).getByRole("button", { name: "Cancel" }).click();
  await col("Cancel requested").locator("li", { hasText: "Table 5" }).getByRole("button", { name: "Confirm cancel" }).click(within10s);
  await A.locator("main li").filter({ hasText: "Cancelled" }).waitFor(within10s);
  assert.equal(await board.locator("li", { hasText: "Table 5" }).count(), 1, "cancelled dish leaves the board");
  step("cancel request -> staff confirm -> Cancelled, gone from board");

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

  const freeChip = (n) => strip.locator(":scope > span", { hasText: new RegExp(`Table ${n}\\s*Free`) });
  await nav(B, "Orders");
  await B.getByText("No orders yet.").waitFor(within10s);
  await nav(B, "Cart");
  await B.getByText("Your cart is empty.").waitFor(within10s);
  await freeChip(5).waitFor(within10s);
  step("session closed: B sees no orders, B's unsent cart discarded, strip shows table 5 free");

  // Mark paid + clear through the table drawer
  const P4 = await ctxA.newPage();
  await P4.goto(`${BASE}/b/SIAM/t/4`);
  await P4.locator("div.rounded-lg", { hasText: "Coke" }).getByRole("button", { name: "Add" }).click();
  await P4.getByRole("button", { name: "Confirm" }).click();
  await nav(P4, "Cart");
  await P4.getByRole("button", { name: "Confirm order" }).click();
  await strip.getByRole("button", { name: /Table 4/ }).click(within10s);
  const drawer4 = C.getByRole("dialog", { name: "Table 4 bill" });
  await drawer4.getByRole("button", { name: "Mark paid" }).click();
  await C.getByRole("alert").getByText(/Cannot mark paid/).waitFor();
  await C.waitForTimeout(6000);
  assert.ok(await drawer4.isVisible(), "drawer stays open across a refresh");
  await shot(C, "06-drawer");
  await drawer4.getByRole("button", { name: "Start" }).click();
  await drawer4.getByRole("button", { name: "Serve" }).click();
  await drawer4.getByRole("button", { name: "Mark paid" }).click();
  await drawer4.waitFor({ state: "detached" });
  await freeChip(4).waitFor();
  step("drawer: mark paid blocked while unresolved, survives refresh, then paid -> closes, chip free");

  const P3 = await ctxB.newPage();
  await P3.goto(`${BASE}/b/SIAM/t/3`);
  await P3.locator("div.rounded-lg", { hasText: "Drinking Water" }).getByRole("button", { name: "Add" }).click();
  await P3.getByRole("button", { name: "Confirm" }).click();
  await strip.getByRole("button", { name: /Table 3/ }).click(within10s);
  await C.getByRole("dialog", { name: "Table 3 bill" }).getByRole("button", { name: "Clear table" }).click();
  await freeChip(3).waitFor();
  step("drawer: clear table (with confirm prompt)");

  // History + receipt
  await C.goto(`${BASE}/console/SIAM/history`);
  await C.locator("table").waitFor(); // Suspense content streams in hidden first
  const rows = await C.locator("tbody tr").allTextContents();
  assert.equal(rows.length, 3);
  assert.match(rows[0], /T03-.*voided/);
  assert.match(rows[2], /T05-.*฿90.*paid/);
  await C.setViewportSize({ width: 1920, height: 1080 });
  assert.ok((await C.locator("table").boundingBox()).width > 1600, "history uses full width at 1920");
  await shot(C, "08-history");
  await C.locator("tbody tr").nth(2).getByRole("link", { name: "Open / print" }).click();
  await C.getByText("RECEIPT", { exact: true }).waitFor();
  const receipt = await C.locator("main.font-mono").innerText();
  assert.match(receipt, /Table: 5/);
  assert.match(receipt, /Not Bad Siam/, "receipt shows the branch name");
  assert.match(receipt, /\+ Extra egg/);
  assert.match(receipt, /TOTAL\s*฿90/);
  assert.match(receipt, /PAID/);
  assert.match(receipt, /not a tax invoice/);
  assert.ok((await C.locator("main.font-mono").boundingBox()).width <= 320, "receipt keeps receipt width");
  await shot(C, "09-receipt");
  await C.reload();
  const norm = (t) => t.replace(/\s+/g, "");
  assert.equal(norm(await C.locator("main.font-mono").textContent()), norm(receipt));
  step("history newest first; receipt content correct and identical on reprint");

  // Multi-branch user, ASOK isolation, switching, 403, logout
  const ctxE = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const E = await ctxE.newPage();
  await E.goto(`${BASE}/console/SIAM/history`);
  await E.waitForURL(/\/login\?next=%2Fconsole%2FSIAM%2Fhistory$/);
  await logIn(E, "area.manager", "manager-demo");
  await E.waitForURL(`${BASE}/console/SIAM/history`);
  step("login returns to the requested page (/console/SIAM/history)");

  await E.goto(`${BASE}/console`);
  await E.getByRole("heading", { name: "Choose a branch" }).waitFor();
  assert.deepEqual(
    (await E.locator("main li a").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()),
    ["Not Bad Asok ASOK", "Not Bad Siam SIAM"],
  );
  await E.getByRole("link", { name: /Not Bad Asok/ }).click();
  await E.waitForURL(`${BASE}/console/ASOK`);
  const asokStrip = E.getByTestId("table-strip");
  await asokStrip.waitFor();
  assert.equal(await asokStrip.locator(":scope > *").count(), 6, "ASOK has 6 tables");
  step("area.manager gets the branch picker; ASOK console shows ASOK's 6 tables");

  const P5 = await ctxA.newPage();
  await P5.goto(`${BASE}/b/ASOK/t/5`);
  await P5.getByText("Not Bad Asok").waitFor();
  await P5.locator("div.rounded-lg", { hasText: "Coke" }).getByRole("button", { name: "Add" }).click();
  await P5.getByRole("button", { name: "Confirm" }).click();
  await nav(P5, "Cart");
  await P5.getByRole("button", { name: "Confirm order" }).click();
  await nav(P5, "Orders");
  assert.match(await P5.locator("main").innerText(), /ASOK-T05-\d{4}/);
  await E.getByTestId("kitchen-board").locator("li", { hasText: "Table 5" }).waitFor(within10s);
  await C.goto(`${BASE}/console/SIAM`);
  await C.getByTestId("table-strip").waitFor();
  await C.waitForTimeout(6000);
  assert.match(await C.getByTestId("table-strip").locator(":scope > span", { hasText: "Table 5" }).innerText(), /Free/);
  assert.equal(await C.getByTestId("kitchen-board").locator("li", { hasText: "Coke" }).count(), 0);
  step("ASOK table 5 order: Bill ASOK-T05-…, on the ASOK board, not on the SIAM console");

  await E.getByRole("link", { name: "Switch branch" }).click();
  await E.getByRole("link", { name: /Not Bad Siam/ }).click();
  await E.waitForURL(`${BASE}/console/SIAM`);
  step("Switch branch -> picker -> SIAM");

  await C.goto(`${BASE}/console/ASOK`);
  await C.getByRole("heading", { name: "No access to this branch" }).waitFor();
  const apiStatus = await C.evaluate(() => fetch("/api/console/ASOK/tables").then((r) => r.status));
  assert.equal(apiStatus, 403);
  await shot(C, "10-no-access");
  step("siam.staff on ASOK: no-access page and 403 from the API");

  await C.goto(`${BASE}/console/SIAM`);
  await C.getByRole("button", { name: "Log out" }).click();
  await C.waitForURL(`${BASE}/login`);
  await C.goto(`${BASE}/console/SIAM`);
  await C.waitForURL(/\/login\?next=/);
  assert.equal(await C.evaluate(() => fetch("/api/console/SIAM/tables").then((r) => r.status)), 401);
  step("logout ends the session: console redirects to login, API returns 401");
  await ctxE.close();

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
