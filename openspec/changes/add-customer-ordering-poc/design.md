# Design

## Context

Greenfield repo; nothing exists besides `requirements.md` and OpenSpec scaffolding. Target is a demo/POC on Vercel with a real database (see proposal.md – Why). Auth/security are explicitly out of scope, so every endpoint is open. Vercel Functions cannot hold WebSocket connections, so live updates use polling.

## Goals / Non-Goals

**Goals:**
- One deployable Next.js app serving both the customer pages and the restaurant console.
- All state transitions enforced server-side and race-safe under concurrent phones and staff.
- Minimal dependencies: framework, ORM, DB driver, test runner.

**Non-Goals:**
- Realtime push, offline support, background jobs, caching layers.
- Any abstraction for future real payment providers beyond one stub module.

## Decisions

### D1. Next.js App Router on Vercel, single app
Routes: `/t/[table]` (menu + cart + orders tabs), `/t/[table]/pay` (stub bank picker), `/console` (tables overview), `/console/history`, `/console/bills/[id]/print`. Mutations via Route Handlers under `/api/*` returning JSON, so polling clients and actions share one API.
*Alternative:* separate console app – rejected, doubles deploy for no gain.

### D2. Postgres (Neon in production) + Drizzle ORM over node-postgres
Use `drizzle-orm/node-postgres` with a module-level `pg` Pool, registered with `attachDatabasePool` from `@vercel/functions` (Vercel Fluid compute guidance). The same driver talks to local Docker Postgres for dev/tests and to Neon in production, and supports interactive transactions (D6, D7).
*Alternatives:* `neon-serverless` (WebSocket) – cannot reach plain local Postgres without an extra proxy; `neon-http` – no interactive transactions. Prisma – heavier client and cold starts; no team preference stated.

### D3. Data model
```
tables(id, number unique)
menu_items(id, category enum[main,a_la_carte,soup,special,dessert,drink],
           sort, name_th, name_en, price int, image_url null)
menu_options(id, menu_item_id, name, price_delta int)
table_sessions(id, table_id, bill_no unique, status enum[open,paid,voided],
               opened_at, closed_at null)
  -- partial unique index: one open session per table
cart_lines(id, session_id, device_id uuid, menu_item_id,
           option_ids int[], note text, qty int check(qty>=1))
tickets(id, session_id, device_id, created_at)
order_items(id, ticket_id, session_id, menu_item_id, name_snapshot,
            options_snapshot jsonb, note, unit_price int,
            status enum[pending,cancel_requested,in_progress,served,cancelled],
            updated_at)
```
TableSession and Bill are 1:1, so they share one row (`table_sessions`); "Bill" is the user-facing name. Prices are integer Baht. `order_items` snapshots name/options/price so history is stable if menu changes.

### D4. Session opening is idempotent
First cart add runs `INSERT … ON CONFLICT DO NOTHING` against the partial unique index (`table_id WHERE status='open'`), then selects the open row. Two phones adding simultaneously land in the same session.

### D5. Status transitions as conditional UPDATEs
Each transition is one statement: `UPDATE order_items SET status=$to WHERE id=$id AND status=ANY($allowedFrom) RETURNING id`. Zero rows → 409 with current status. This makes the cancel-vs-start race (order-tracking spec) safe without locks. The allowed-transition table lives in one shared module used by API and UI.

### D6. Cart confirmation in one transaction
Within a transaction: lock the device's cart lines (`SELECT … FOR UPDATE`), reject if empty, insert one `tickets` row, expand each line into `qty` `order_items` rows with snapshots, delete the lines.

### D7. Payment gate and closing in one transaction
Shared function used by both the stub QR endpoint and the console "Mark paid": lock the session row, check status `open`, the requesting device's cart empty (customer path only), and no `order_items` outside `served`/`cancelled`; then, if other devices still have `cart_lines` and the request lacks `force=true`, return 409 `unsent_carts` with the line count (UI shows the warning and retries with `force=true` on "Pay anyway"); otherwise set `paid`, `closed_at`, delete all `cart_lines` of the session. Force-clear uses the same close path with status `voided` and no gate.

### D8. Bill number
Postgres sequence `bill_seq`; `bill_no = 'T' || lpad(table,2,'0') || '-' || lpad(nextval,4,'0')`. Globally unique, human-keyable at the cashier.

### D9. Device identity and layout preference
`crypto.randomUUID()` stored in `localStorage` as `deviceId`, sent with every customer request; layout mode stored in `localStorage`. Storage access wrapped in try/catch; on failure a per-tab ID is used.

### D10. Polling
Customer Orders tab and console fetch their state every 5 s with `setInterval` + `fetch`, paused when `document.hidden`. No client data library.

### D11. Stub payment
`/t/[table]/pay` shows a static list of fake banks (e.g. "SCB (simulated)", "KBank (simulated)"). Selecting one POSTs to `/api/sessions/:id/pay` (D7) and redirects to `/t/[table]?paid=1`. No PromptPay QR generation.

### D12. Printing
`/console/bills/[id]/print` renders a receipt with print CSS and calls `window.print()` on load. Reprint = open again.

### D13. Seed
`scripts/seed.ts` (run via `npm run db:seed`) inserts 10 tables and 60 Thai dishes across the six categories with 0–3 options each; idempotent (truncates menu/tables first).

### D14. Tests
Vitest for pure logic (transition table, Bill total, Traditional-layout pagination) and for API handlers against a test Postgres database (transaction rules, gate, races). UI verified by a scripted manual walkthrough in tasks.md.

## Risks / Trade-offs

- [No auth: anyone with the URL can open the console or act on any table] → Accepted per scope; console path not linked from customer UI.
- [Polling every 5 s × devices × tables] → Fine at demo scale; switch to a realtime service if ever productised.
- [Device ID in localStorage: private mode or cleared storage loses the cart] → Cart lines are discarded at session close anyway; per-tab fallback keeps the page usable.
- [Neon cold start adds latency to the first request] → Accepted for a demo.
- [Another device's unconfirmed cart is discarded when the table pays] → Warning + explicit "Pay anyway" before discarding (payment spec).
- [Bill history grows unbounded] → Fine for a demo; history is a plain query on closed `table_sessions`, nothing extra stored.

## Migration Plan

Greenfield. Deploy: create Neon DB from Vercel Marketplace → `drizzle-kit migrate` → `npm run db:seed` → deploy. Rollback = redeploy previous build; schema is new.
