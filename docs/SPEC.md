# Not Bad Restaurant – Agreed Specification (Demo / POC)

Plain-language summary of the main specs in `openspec/specs/` plus the deltas of active changes in `openspec/changes/*/specs/`. The OpenSpec files are the source of truth; this file is regenerated from them when they change. Original brief: `requirements.md`.

| Change | Status | Capabilities |
|---|---|---|
| `add-customer-ordering-poc` | Archived 2026-10-14 into `openspec/specs/` (deploy 7.2 still open) | menu-browsing, ordering, order-tracking, payment, restaurant-console |
| `console-desktop-layout` | Implemented | restaurant-console (layout additions) |

## 1. Scope

A mobile web app for diners to order from their table, plus a staff console. It is a demo:

- **No** login, permissions, or security hardening.
- **No** real payment. QR payment is simulated.
- **No** promotions, menu editing, sold-out flags, multiple restaurants, language switching, or tax invoices.

## 2. Words we use

| Term | Meaning |
|---|---|
| **Order item** (dish) | One plate of one dish, with chosen extras and a note. |
| **Cart** | Dishes one phone has picked but not yet sent to the kitchen. |
| **Ticket** | One batch of dishes a phone sent to the kitchen. |
| **Bill** | Everything ordered at a table during one visit. This is what gets paid. |
| **Table session** | One visit at a table, from the first dish added to a cart until the bill is paid or staff clear the table. |

## 3. Menu (menu-browsing)

- Each table's QR code opens `/t/<table number>`. The page shows the table number. An unknown table number shows "table not found".
- Scanning alone does not start a visit.
- Six categories, in this order: Main, A la carte, Soup, Special, Dessert, Drink.
- Each dish shows its Thai and English names, a picture or placeholder, its price in whole Baht, and an **Add** button.
- **Modern layout** (the default):
  - two columns, scrolling down
  - tapping a category tab jumps to that category
  - works in any phone orientation
- **Traditional layout**: works **only when the phone is held sideways**.
  - One page fills the screen: 4 columns × 2 rows, with no scrolling up or down.
  - Every category starts on a fresh page. Empty slots on a category's last page stay empty, so 10 soups take two pages: 8, then 2.
  - Turn pages by swiping or with the ◀ ▶ buttons. A page indicator shows "2/N".
  - Category tabs jump to that category's first page.
  - The usual header and bottom bar are replaced by one slim top bar: table number, the six category tabs, Cart and Orders buttons with counts, and a switch back to Modern.
  - Cart, Orders, and dish options open as panels over the menu. They scroll inside if they are taller than the screen, so Confirm is always reachable. Closing a panel returns to the same menu page.
- Choosing a layout:
  - The phone remembers the choice across reloads. A first visit shows Modern.
  - If Traditional is chosen but the phone is upright, the app shows Modern with a hint to turn the phone sideways. Turning it sideways shows Traditional again. The saved choice does not change.
  - The app never forces fullscreen or locks the screen rotation.

## 4. Ordering (ordering)

- No login. Each phone gets a random ID the first time it opens the app, and keeps it.
- **Add** opens the dish options:
  - extras, each with its price (e.g. extra egg +฿10)
  - quantity, at least 1
  - a note box (e.g. "no beansprout!"), which may be left empty
- **Cancel** discards the choices. **Confirm** puts the dish in this phone's cart.
- Each phone has its **own** cart. Other phones at the table cannot see or change it.
- Before confirming, a cart line's extras, note, and quantity can be changed, or the line removed. The cart shows a running total.
- The first dish added to any cart at a free table starts the table's visit. Other phones then join that visit.
- **Confirm order**:
  - sends only this phone's cart to the kitchen as one ticket
  - quantity N becomes N separate dishes, each tracked on its own
  - the phone's cart is then empty; other phones' carts are untouched
  - an empty cart cannot be confirmed

## 5. Orders and status (order-tracking)

- Dish statuses, and who can change them:

| From | To | Who |
|---|---|---|
| Pending | In progress | Staff (start) |
| Pending | Cancel requested | Any customer at the table |
| Cancel requested | Cancelled | Staff (confirm cancel) |
| Cancel requested | Pending | Staff (reject cancel) |
| In progress | Served | Staff (serve) |
| Pending or In progress | Cancelled | Staff (void) |

  Every other change is refused. A dish with a cancel request **cannot be started** until staff resolve it, and customers cannot take a cancel request back.
- The **Orders** tab shows every dish sent from **all** phones at the table: name, extras, note, price, and status. It also shows the bill number (e.g. `T05-0042`) and the running total of served dishes.
- Changes made by staff or other phones appear within 10 seconds, with no reload.
- Customers see the Cancel button only on Pending dishes. If the kitchen started a dish before the cancel request arrived, the customer is told it is already being prepared.

## 6. Paying (payment)

- **Pay** works only when:
  1. this phone's cart is empty (confirm or remove what is left), and
  2. every dish is served or cancelled; anything else must be sorted out with staff first.

  Otherwise the app says what is blocking payment.
- If other phones at the table still hold unsent dishes, a warning says how many will be discarded and asks the table to sort it out first. Payment goes ahead only after **Pay anyway**. Dismissing the warning changes nothing. Staff see the same warning when marking a bill paid.
- The bill total is the sum of served dishes, extras included. Cancelled dishes count as zero.
- Each visit has a bill number, unique across all visits, made of the table number and a sequence (e.g. `T05-0042`).
- Two ways to pay:
  - **QR (simulated):** pick a pretend bank app. The bill is marked paid and the menu shows a success message. No real payment system is involved.
  - **Cashier:** show the bill number at the counter; staff mark it paid in the console.
- Once a bill is paid:
  - the visit ends automatically
  - every phone at the table sees an empty Orders tab within 10 seconds
  - all unsent carts are thrown away
  - the bill is kept in history permanently
  - the next dish added starts a new visit with a new bill number

## 7. Restaurant console (restaurant-console)

### What staff can do (all screen sizes)

- See every table, either free or with its open bill: bill number, status, total, and each dish's name, extras, note, and status. Cancel requests are highlighted. The view refreshes within 10 seconds.
- Per dish, only the buttons valid for its status are offered: **Start**, **Serve**, **Void**, **Confirm cancel**, **Reject cancel**.
- **Mark paid** (cashier payments):
  - only allowed when every dish is served or cancelled; otherwise the unresolved dishes are named
  - same effect as a customer payment, including the unsent-dishes warning
- **Clear table** (walk-outs, abandoned tables): asks for confirmation. An unpaid bill is recorded as *voided*. The visit closes and the bill stays in history.
- **Print bill**: opens the browser print dialog with a receipt showing:
  - restaurant name, table, bill number, date and time
  - served dishes with extras and prices
  - total
  - paid / unpaid / voided

  It can be printed again at any time, including from history. It is a receipt, not a tax invoice.
- **Bill history**: closed bills, newest first, with bill number, table, close time, total, and status. Each can be opened and printed.

### Console layout (from `console-desktop-layout`)

The console is mainly used on a tablet or cashier PC, and still works on a phone.

- **Tablet and wider (768 px and up): kitchen board.**
  - Four columns, in this order: **Cancel requested | Pending | In progress | Served**. Each holds the dishes of all open bills in that status.
  - Cancelled dishes are not on the board.
  - Cancel requested, Pending, and In progress list the longest-waiting dish first. Served lists the most recently served first.
  - Column headers stay visible while scrolling and show counts. The Cancel requested header is highlighted whenever its count is above zero.
  - Each dish card shows the table number (large), dish, extras, note, minutes since its last status change (e.g. "4 min"), and the valid action buttons.
  - **Table strip** above the board, one chip per table in number order:
    - free tables are grey and labelled free
    - occupied tables show bill number, served total, and how many dishes are not yet served or cancelled
  - Tapping an occupied chip opens a **side drawer**:
    - contents: all that table's dishes (including cancelled) with their actions, plus **Mark paid**, **Print bill**, **Clear table**
    - stays open while the screen refreshes
    - closes when the bill closes or staff dismiss it
- **Phone (below 768 px):** the per-table card list, with a count bar at the top (cancel requests highlighted, pending, in progress).
- **Bill history** uses the full width on screens 1280 px and wider. The printed receipt keeps its receipt width.

## 8. Technical choices (summary)

- Next.js app on Vercel, using Cache Components.
- Postgres: Neon in production, Docker locally. Accessed through Drizzle and the `pg` driver.
- Seed data: 10 tables and 60 Thai dishes.
- Phones and the console check the server every 5 seconds. Vercel functions cannot hold open the live connections that push updates would need.
- Details:
  - `openspec/changes/archive/2026-10-14-add-customer-ordering-poc/design.md`
  - `openspec/changes/console-desktop-layout/design.md`
