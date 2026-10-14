# Tasks

## 1. Setup

- [ ] 1.1 Scaffold Next.js (App Router, TypeScript) app in repo root; verify `npm run dev` serves a page
- [ ] 1.2 Add `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, `vitest`; verify `npm run build` and `npx vitest run` (zero tests) succeed
- [ ] 1.3 Configure `DATABASE_URL` / `TEST_DATABASE_URL` via `.env.local` with an `.env.example`; verify a DB ping script connects

## 2. Data model and seed

- [ ] 2.1 Define Drizzle schema per design D3 (enums, partial unique index on open session, `bill_seq`, qty check); verify `drizzle-kit generate` + `migrate` apply cleanly to an empty DB
- [ ] 2.2 Write `scripts/seed.ts` with 10 tables and 60 Thai dishes across six categories with options (D13); verify counts via a query: 10 tables, 60 items, all six categories non-empty
- [ ] 2.3 Document setup, migrate and seed commands in README.md; verify the commands run as written on a fresh DB

## 3. Domain logic (pure)

- [ ] 3.1 Implement OrderItem transition table and `canTransition(from,to,actor)` (order-tracking spec); verify Vitest covers every allowed and a sample of rejected transitions
- [ ] 3.2 Implement Bill total (served only, option deltas included); verify Vitest for the ฿140 scenario in the payment spec
- [ ] 3.3 Implement Traditional-layout pagination (8 per page, new page per category); verify Vitest for the 10-item Soup scenario

## 4. API

- [ ] 4.1 `GET /api/tables/:n/menu` and unknown-table 404; verify Vitest handler test
- [ ] 4.2 Cart endpoints (add/edit/remove/list, per device) with idempotent session open (D4); verify tests: concurrent first adds yield one session; device carts isolated
- [ ] 4.3 `POST confirm` with qty split in one transaction (D6); verify tests: ×3 line → 3 pending items, empty cart rejected, other device's cart untouched
- [ ] 4.4 `GET /api/tables/:n/orders` (table-wide items, Bill number, total); verify test against a seeded session
- [ ] 4.5 Item transition endpoint via conditional UPDATE (D5) for customer cancel request and staff actions; verify tests: cancel after start → 409, start on `cancel_requested` → 409
- [ ] 4.6 Pay / mark-paid / force-clear sharing the close path (D7, D8); verify tests: gate rejections (cart non-empty, unresolved item), other devices' carts → 409 `unsent_carts` unless `force=true`, paid closes session and deletes carts, force-clear records `voided`, next add opens new Bill number
- [ ] 4.7 Console endpoints: tables overview and Bill history; verify tests return open sessions and closed Bills newest first

## 5. Customer UI

- [ ] 5.1 `/t/[table]` shell with table number, tabs (Menu / Cart / Orders), deviceId + layout in localStorage (D9); verify in browser that reload keeps cart and layout
- [ ] 5.2 Modern layout with category tabs scrolling to sections; verify at 390px width
- [ ] 5.3 Traditional-like layout with horizontal paging and category tabs; verify Soup page break in browser
- [ ] 5.4 Options sheet (extras, qty, note, confirm/cancel) and cart editing; verify the Pad Thai ฿90 scenario manually
- [ ] 5.5 Orders tab with 5 s polling, status badges, cancel request control on `pending` only; verify a second browser sees changes within 10 s
- [ ] 5.6 Pay button with gate messages, unsent-carts warning with "Pay anyway", `/t/[table]/pay` stub bank list, success banner on return; verify blocked, warned, and successful paths manually

## 6. Restaurant console

- [ ] 6.1 `/console` tables overview with 5 s polling, highlighted `cancel_requested`, per-status actions; verify each action changes the customer view
- [ ] 6.2 Mark paid with rejection message and unsent-carts warning, and force-clear with confirm prompt; verify both manually
- [ ] 6.3 `/console/history` and `/console/bills/[id]/print` receipt with print CSS; verify print dialog opens and reprint shows identical content

## 7. Integration and deploy

- [ ] 7.1 Scripted end-to-end walkthrough on two phones + console: scan → add/edit → confirm → cancel request → reject → start/serve → pay (stub) → table cleared → history → reprint; verify every step behaves per specs
- [ ] 7.2 Deploy to Vercel with Neon from Marketplace, run migrate + seed against production DB; verify the walkthrough on the deployed URL

## Workflow follow-up

- Run `openspec validate add-customer-ordering-poc --strict` before apply.
- Archive the change after the walkthrough passes.
