# Proposal

## Why

The restaurant console is mainly used on a tablet or a cashier PC, but the current layout is a phone-style card list capped at 1152 px: on wide screens it wastes space, needs scrolling, and makes cancel requests easy to miss among ten table cards. Staff need a kitchen-board view that surfaces what needs attention across all tables at once.

## What Changes

- At 768 px and wider (tablet portrait and up), the console becomes a kitchen board with four status columns: Cancel requested | Pending | In progress | Served. Each dish card shows its table number, dish, options, note, time since its last status change, and the valid staff actions. Cancelled dishes are not on the board.
- Sticky column headers show counts; the Cancel-requested header is highlighted when its count is above zero.
- A table strip above the board lists every table: free tables as grey chips, occupied ones with Bill number, served total, and unresolved-dish count. Tapping an occupied table opens a side drawer with all its dishes (including cancelled) and the Mark paid / Print bill / Clear table actions.
- Below 768 px (phones), the existing per-table card list stays, with a compact count bar at the top.
- Bill history uses the full desktop width. The receipt print page is unchanged.

### Non-goals

- New staff actions or changed business rules; every action keeps its existing rules from `add-customer-ordering-poc`.
- Separate kitchen-only or cashier-only screens, filtering, sound alerts, or drag-and-drop between columns.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `restaurant-console`: adds layout requirements (kitchen board, table strip and drawer, phone count bar, full-width history). Existing requirements are unchanged. This capability is introduced by `add-customer-ordering-poc`, which must be archived before this change.

## Impact

- `app/console/console-board.tsx` split into board, table strip/drawer, and phone list views; `app/console/history/page.tsx` width.
- `lib/service.ts`: order item DTO gains its last status-change time.
- `tests/e2e/walkthrough.mjs` and unit tests extended. No schema, API route, or dependency changes.
