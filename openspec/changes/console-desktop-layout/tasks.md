# Tasks

## 1. Data and pure logic

- [x] 1.1 Add `updatedAt` (ISO string) to the order item DTO in `lib/service.ts`; verify a service test asserts it changes after a status transition
- [x] 1.2 Add `boardColumns()` and `formatElapsed()` in `lib/console.ts` (design D1); verify Vitest covers column order, cancelled exclusion, oldest-first and served-newest-first sorting, and minute formatting

## 2. Shared console pieces

- [x] 2.1 Extract status badge, item action buttons, and bill actions (Mark paid with unsent-carts/unresolved handling, Print bill, Clear table) from `console-board.tsx` into reusable components (design D6); verify `npm run e2e` still passes on the existing console steps

## 3. Kitchen board (≥768 px)

- [x] 3.1 Board with four columns, sticky headers with counts, highlighted Cancel-requested header when > 0, independent column scroll, full-width page (D2, D3); verify screenshots at 768×1024, 1280×800, 1920×1080
- [x] 3.2 Board dish card: table number, dish, options, note, elapsed minutes, valid actions (D4); verify a dish moves column on Start and the card shows "N min"
- [x] 3.3 Table strip: grey free chips, occupied chips with Bill number, served total, unresolved count; verify against a seeded table 3 free / table 5 occupied state
- [x] 3.4 Table drawer with all dishes (incl. cancelled), item actions, Mark paid / Print bill / Clear table, survives refresh, closes on bill close or dismiss (D5); verify paying from the drawer closes it and frees the chip

## 4. Phone and history

- [x] 4.1 Phone (<768 px): keep per-table card list, add count bar with highlighted cancel requests; verify at 390×844
- [x] 4.2 Bill history full width at ≥1280 px, receipt page unchanged; verify at 1920×1080

## 5. Integration

- [x] 5.1 Extend `tests/e2e/walkthrough.mjs` to drive staff actions through the board and drawer at 1280×800 and the count bar at 390×844; verify `npm test` and `npm run e2e` pass and lint/typecheck/build are clean

## Workflow follow-up

- Archive `add-customer-ordering-poc` before archiving this change (it creates the `restaurant-console` main spec).
- After this change is applied, the product owner will propose an additional requirement as a new change; do not archive until that has been reviewed.
