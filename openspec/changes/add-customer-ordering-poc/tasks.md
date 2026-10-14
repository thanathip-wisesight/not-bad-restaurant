# Tasks

## 1. Setup

- [x] 1.1 Scaffold Next.js (App Router, TypeScript) app in repo root; verify `npm run dev` serves a page
- [x] 1.2 Add `drizzle-orm`, `pg`, `@vercel/functions`, `drizzle-kit`, `vitest`, plus a `docker-compose.yml` with local Postgres; verify `npm run build` and `npx vitest run` (zero tests) succeed
- [x] 1.3 Configure `DATABASE_URL` / `TEST_DATABASE_URL` via `.env.local` with an `.env.example`; verify a DB ping script connects to the Docker Postgres

## 2. Data model and seed

- [x] 2.1 Define Drizzle schema per design D3 (enums, partial unique index on open session, `bill_seq`, qty check); verify `drizzle-kit generate` + `migrate` apply cleanly to an empty DB
- [x] 2.2 Write `scripts/seed.ts` with 10 tables and 60 Thai dishes across six categories with options (D13); verify counts via a query: 10 tables, 60 items, all six categories non-empty
- [x] 2.3 Document setup, migrate and seed commands in README.md; verify the commands run as written on a fresh DB

## 3. Domain logic (pure)

- [x] 3.1 Implement OrderItem transition table and `canTransition(from,to,actor)` (order-tracking spec); verify Vitest covers every allowed and a sample of rejected transitions
- [x] 3.2 Implement Bill total (served only, option deltas included); verify Vitest for the ฿140 scenario in the payment spec
- [x] 3.3 Implement Traditional-layout pagination (8 per page, new page per category); verify Vitest for the 10-item Soup scenario

## 4. API

- [x] 4.1 `GET /api/tables/:n/menu` and unknown-table 404; verify Vitest handler test
- [x] 4.2 Cart endpoints (add/edit/remove/list, per device) with idempotent session open (D4); verify tests: concurrent first adds yield one session; device carts isolated
- [x] 4.3 `POST confirm` with qty split in one transaction (D6); verify tests: ×3 line → 3 pending items, empty cart rejected, other device's cart untouched
- [x] 4.4 `GET /api/tables/:n/orders` (table-wide items, Bill number, total); verify test against a seeded session
- [x] 4.5 Item transition endpoint via conditional UPDATE (D5) for customer cancel request and staff actions; verify tests: cancel after start → 409, start on `cancel_requested` → 409
- [x] 4.6 Pay / mark-paid / force-clear sharing the close path (D7, D8); verify tests: gate rejections (cart non-empty, unresolved item), other devices' carts → 409 `unsent_carts` unless `force=true`, paid closes session and deletes carts, force-clear records `voided`, next add opens new Bill number
- [x] 4.7 Console endpoints: tables overview and Bill history; verify tests return open sessions and closed Bills newest first

## 5. Customer UI

- [x] 5.1 `/t/[table]` shell with table number, tabs (Menu / Cart / Orders), deviceId + layout in localStorage (D9); verify in browser that reload keeps cart and layout
- [x] 5.2 Modern layout with category tabs scrolling to sections; verify at 390px width
- [x] 5.3 Traditional-like layout with horizontal paging and category tabs; verify Soup page break in browser
- [x] 5.4 Options sheet (extras, qty, note, confirm/cancel) and cart editing; verify the Pad Thai ฿90 scenario manually
- [x] 5.5 Orders tab with 5 s polling, status badges, cancel request control on `pending` only; verify a second browser sees changes within 10 s
- [x] 5.6 Pay button with gate messages, unsent-carts warning with "Pay anyway", `/t/[table]/pay` stub bank list, success banner on return; verify blocked, warned, and successful paths manually
- [ ] 5.7 Landscape-only Traditional: effective layout from preference + orientation, portrait falls back to Modern with a "turn your phone sideways" hint, no fullscreen/lock; verify at 390×844 and 844×390 that rotating switches layout without changing the stored choice
- [ ] 5.8 Compact landscape chrome: single top bar (table, category tabs, Cart/Orders counts, Modern switch), one 4×2 page per screen with no vertical scroll, swipe + ◀ ▶ with page indicator, Cart/Orders/options as overlays that return to the same page; verify at 844×390 and 667×375

## 6. Restaurant console

- [x] 6.1 `/console` tables overview with 5 s polling, highlighted `cancel_requested`, per-status actions; verify each action changes the customer view
- [x] 6.2 Mark paid with rejection message and unsent-carts warning, and force-clear with confirm prompt; verify both manually
- [x] 6.3 `/console/history` and `/console/bills/[id]/print` receipt with print CSS; verify print dialog opens and reprint shows identical content

## 7. Integration and deploy

- [x] 7.1 Scripted end-to-end walkthrough on two phones + console: scan → add/edit → confirm → cancel request → reject → start/serve → pay (stub) → table cleared → history → reprint; verify every step behaves per specs
- [ ] 7.2 Deploy to Vercel with Neon from Marketplace, run migrate + seed against production DB; verify the walkthrough on the deployed URL
- [ ] 7.3 Extend the browser walkthrough with landscape Traditional (portrait fallback, page turn, cart overlay keeps page); verify `npm run e2e` passes

## Workflow follow-up

- Run `openspec validate add-customer-ordering-poc --strict` before apply.
- Archive the change after the walkthrough passes.
