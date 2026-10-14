# Proposal

## Why

Restaurant QR-ordering web apps are often painful to use, and orders get lost or stall between table and kitchen. This change builds a demo/POC of a customer-side ordering web app that tracks every plate individually, plus a minimal restaurant console to drive order status, payment, and table clearing.

## What Changes

- Mobile web menu opened by scanning a per-table QR code (`/t/{tableNo}`), with two layouts: Modern (default, vertical 2-column, any orientation) and Traditional (landscape-only, one 4×2 page per screen; held upright it shows Modern), both with six category tabs.
- Per-device cart: add, edit (options, note, quantity), remove, confirm. Confirming sends that device's cart to the kitchen as a Ticket; a line with quantity N becomes N separate OrderItems.
- Table-wide order tracking: every device at the table sees all confirmed OrderItems and their status (`pending`, `cancel_requested`, `in_progress`, `served`, `cancelled`), refreshed by polling.
- Customer cancel request on `pending` items, which blocks cooking until staff confirms or rejects it.
- Payment gate (empty cart; every item `served` or `cancelled`) with two paths: a stubbed QR bank-app flow and cashier payment recorded by staff. Unsent carts on other devices trigger a warning and require "Pay anyway". Payment closes the TableSession automatically; the Bill is kept permanently in the database as history.
- Restaurant console: list tables and their items; start, serve, void, confirm/reject cancel; mark Bill paid; force-clear a table; print the Bill as a receipt via the browser print dialog (reprintable).
- Seeded data: 60 Thai dishes across six categories with priced options, and 10 tables.

### Glossary

- **OrderItem** – one plate, with selected options and a free-text note.
- **Cart** – a device's unconfirmed OrderItem lines.
- **Ticket** – one confirmed batch from one device.
- **Bill** – all OrderItems of one TableSession; the payable and archived unit.
- **TableSession** – one occupancy of a table, from first cart add until payment or forced clear.

### Non-goals

- Authentication, authorization, and security hardening of any kind.
- Real payment processing or PromptPay QR generation.
- Thai full tax invoice compliance; the printed bill is a plain receipt.
- Promotions, menu editing, sold-out flags, multi-restaurant support, UI language switching.
- Editing or cancelling an OrderItem after it is `in_progress`, except staff void.

## Capabilities

### New Capabilities

- `menu-browsing`: Opening a table's menu from its QR code, menu layouts, category navigation, item display.
- `ordering`: Per-device cart lifecycle, item options and notes, confirming a cart into OrderItems, and TableSession creation.
- `order-tracking`: Table-wide view of confirmed OrderItems, their status lifecycle, and customer cancel requests.
- `payment`: Payment eligibility gate, stubbed QR payment, cashier payment, and session closure on payment.
- `restaurant-console`: Staff-side view and actions over tables, OrderItems, Bills, and receipt printing.

### Modified Capabilities

None (greenfield project).

## Impact

- New Next.js application deployed on Vercel, with a Postgres database and a seed script.
- No existing code, APIs, or specs are affected.
