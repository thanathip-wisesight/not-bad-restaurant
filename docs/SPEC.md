# Not Bad Restaurant Order – Agreed Specification (Demo / POC)

Source of truth for implementation: `openspec/changes/add-customer-ordering-poc/`. This file is the plain-language version of the same decisions. Original brief: `requirements.md`.

## 1. Scope

A mobile web app for diners to order from their table, plus a simple staff console. It is a demo:

- **No** login, permissions, or security hardening.
- **No** real payment. QR payment is simulated.
- **No** promotions, menu editing, sold-out flags, multiple restaurants, language switching, or tax invoices.

## 2. Words we use

| Term | Meaning |
|---|---|
| **Order item** | One plate of one dish, with chosen extras and a note. |
| **Cart** | The dishes one phone has picked but not yet sent to the kitchen. |
| **Ticket** | One batch of dishes a phone sent to the kitchen. |
| **Bill** | Everything ordered at a table during one visit. This is what gets paid. |
| **Table session** | One visit at a table, from the first dish added to a cart until the bill is paid or staff clears the table. |

## 3. Customer side

### Opening the menu
- Each table has a QR code linking to `/t/<table number>`. The page shows the table number.
- Scanning alone does nothing. The visit starts when someone first adds a dish to a cart.

### Menu
- Six categories, in this order: Main, A la carte, Soup, Special, Dessert, Drink.
- Each dish shows its Thai and English name, a picture, the price in Baht, and an **Add** button.
- Two layouts, switchable at any time. The phone remembers the choice.
  - **Modern** (default): scroll down through two columns. Tapping a category tab jumps to it.
  - **Traditional-like**: swipe sideways through pages of 4 × 2 dishes. Every category starts on a fresh page. Tapping a category tab jumps to its first page.

### Ordering
- **Add** opens the dish options: extras (each with a price, e.g. extra egg +฿10), quantity, and a note box (e.g. "no beansprout!"). The note can be left empty.
- **Cancel** throws away the choices. **Confirm** puts the dish in this phone's cart.
- Each phone has its **own** cart. Friends at the same table do not see each other's carts.
- Anything in the cart can be changed or removed. The cart shows a running total.
- **Confirm order** sends only this phone's cart to the kitchen. Three of the same dish become three separate plates, each tracked on its own.

### Orders tab
- Shows every plate sent to the kitchen from **all** phones at the table, with its status, the bill number (e.g. `T05-0042`) and the running total.
- Refreshes by itself within 10 seconds.
- Plate statuses:

| Status | Meaning |
|---|---|
| Pending | Sent to the kitchen, not started yet |
| Cancel requested | A customer asked to cancel; waiting for staff |
| In progress | The kitchen is cooking it |
| Served | On the table |
| Cancelled | Will not be made and is not charged |

- **Cancelling:** anyone at the table can ask to cancel a **pending** plate. The kitchen then cannot start it until a staff member comes to the table and either confirms the cancel or rejects it, which puts the plate back in the queue. Customers cannot take back a cancel request. Plates already in progress cannot be cancelled by customers.
- If two people at the table disagree about an order, they sort it out themselves.

### Paying
- **Pay** works only when:
  1. this phone's cart is empty (confirm or remove what is left), and
  2. every plate is either served or cancelled. Anything else has to be sorted out with staff first.
- If other phones at the table still have dishes they haven't sent, a warning says those dishes will be thrown away and asks the table to sort it out first. Payment goes ahead only after **Pay anyway**. Staff see the same warning when marking a bill paid.
- The bill counts served plates only.
- Two ways to pay:
  - **QR (simulated):** pick a pretend bank app. The bill is marked paid and the menu shows "Payment successful".
  - **Cashier:** show the bill number at the counter, and staff mark it paid.
- After payment, the visit ends automatically. Every phone at the table sees an empty Orders tab, any unsent carts are thrown away, and the bill is kept in history. The next dish added starts a new visit with a new bill number.

## 4. Restaurant console (`/console`)

- One page listing all tables. Each shows "free", or the current bill with its plates and their statuses. Cancel requests are highlighted. The page refreshes within 10 seconds.
- Per plate, staff see only the buttons that make sense for its status:
  - **Start** (pending → in progress)
  - **Serve** (in progress → served)
  - **Void** (pending or in progress → cancelled)
  - **Confirm cancel** / **Reject cancel**, for cancel requests
- **Mark paid:** for cashier payments. It only works once every plate is served or cancelled.
- **Clear table:** for walk-outs or abandoned tables. Asks for confirmation. An unpaid bill is recorded as *voided*.
- **Print bill:** opens the browser print dialog with a receipt showing the restaurant, table, bill number, date and time, served plates, total, and paid/unpaid/voided status. It can be printed again at any time, including from history. This is a receipt, not a tax invoice.
- **History:** every past bill stays in the database permanently. The console lists them newest first, and each can be opened and reprinted.

## 5. Technical choices (summary)

- Next.js app hosted on Vercel, with a Postgres database on Neon and Drizzle as the database library.
- 10 tables and 60 Thai dishes are loaded by a seed script.
- Screens update by checking the server every 5 seconds. Vercel cannot hold the always-open connections that live updates would need.
- See `openspec/changes/add-customer-ordering-poc/design.md` for details.
