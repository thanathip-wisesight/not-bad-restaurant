# Design

## Context

Today (`lib/domain.ts`, `lib/service.ts`): statuses `pending | cancel_requested | in_progress | served | cancelled`; staff Void and Confirm cancel both end in `cancelled`; `transitionItem()` changes one dish with a single conditional UPDATE; closing a Bill only flips the session and deletes carts, so unfinished dishes of a cleared table stay `pending` forever. No per-change timestamps exist beyond `order_items.updated_at`. Screens poll every 5 s (`usePolling` in `lib/client.ts`). Motivation: proposal.md – Why. This is treated as the first production version: no history backfill.

## Goals / Non-Goals

**Goals:**
- One code path for single and batch status changes that validates, updates, and logs atomically with one timestamp.
- Append-only status log that the telemetry endpoints read.
- Stay within Vercel Hobby and Neon Free for a demo-sized restaurant.

**Non-Goals:**
- Database triggers or event sourcing; the log is written by the service layer only.
- Pagination/cursors beyond a fixed result cap; reports UI.

## Decisions

### D1. Two new enum values, no data rewrite
`ALTER TYPE item_status ADD VALUE 'voided'` and `'finished'` in a generated migration. Existing rows keep their values (first production version, nothing to remap). Postgres allows adding enum values in a migration as long as the same transaction does not use them; this migration only adds.

### D2. `order_item_events` table
`id bigserial`, `order_item_id` (FK), `from_status item_status null`, `to_status item_status not null`, `at timestamptz not null`, `actor` enum `customer | staff | system`, `staff_user_id` (FK users, null), `device_id uuid null`, `note text null`; index `(order_item_id, at)`. Only inserts exist in code; nothing updates or deletes it. Customer events carry the device id, staff events the user id, system events neither.
*Alternative:* status-history JSON on `order_items` — harder to query for telemetry and easy to overwrite.

### D3. Domain table drives rules and labels
`ACTIONS` gains `void → voided` with `reason: "required"`, and `confirm_cancel`/`reject_cancel` with `reason: "optional"`. `RESOLVED = served, cancelled, voided`; `CHARGED = served, finished` (Bill total and receipt). `customerLabel(status)` maps `cancelled` and `voided` to "Cancelled". Reason rule: trimmed length ≥ 3 when required, ≤ 500 always.

### D4. Batch transitions replace the single conditional UPDATE
`transitionItems(ids, action, actor, scope, note?)` runs in one transaction: `SELECT … FOR UPDATE` the dishes within scope (customer: one table; staff: one branch, as today); any id not found → 404; dishes from more than one table or not all in the same status → 400; any dish whose status is not a valid `from` for the action → 409 listing those dishes; then one UPDATE and one multi-row INSERT into `order_item_events` using a single `now`. Row locks keep the cancel-vs-start race safe (the loser waits, re-reads, and gets 409). The single-dish API calls it with one id, so there is one rule path.

### D5. Closing a Bill sets final statuses
`closeSession()` (payment, Mark paid, force-clear) in its existing transaction: `served → finished`; `pending | cancel_requested | in_progress → voided` with note "table cleared" (only possible on force-clear, since payment requires resolution); logs each change as `system` with one timestamp.

### D6. Confirm logs the first event
`confirmCart()` inserts `none → pending` events (actor customer, device id) with the ticket's creation time for every created dish.

### D7. Telemetry queries
- Range: `from` inclusive, `to` exclusive, ISO-8601; default last 30 days; `from > to`, unparsable dates, or a range over 366 days → 400. The range filters by ticket creation time (when the dish was ordered).
- `GET /api/console/[branch]/telemetry/dishes`: group by `order_items.menu_item_id` within the branch: name (latest snapshot), ordered = count, finished/cancelled/voided = counts by current status.
- `GET /api/console/[branch]/telemetry/items?menuItemId=`: dishes newest first, capped at 500, each with Bill number, table, status, and its events in time order (actor shown as `customer`, `system`, or the staff username).
Both call `requireStaff` first (401/403 as elsewhere).

### D8. Console UI
Selection state `{ tableNumber, status, ids }` shared by board, drawer, and phone list; checkboxes of other tables/statuses are disabled while a selection exists; "Select all" per table+status group. A sticky action bar shows the count and the actions for that status. Void, Confirm cancel, and Reject cancel open one small dialog with a textarea (required for Void, optional otherwise), used for single and batch actions. Batch calls `POST /api/console/[branch]/items/batch { ids, action, note }`; the existing single-item route forwards to the same service function.

### D9. Free-tier polling
Poll interval 10 s (console and customer). The customer page pauses polling while there is no open session and its cart is empty, and resumes on `pointerdown`, `keydown`, `focus`, or `visibilitychange` to visible. Budget check (Hobby: 1,000,000 invocations/month; Neon Free: 100 CU-hours ≈ 400 h at 0.25 CU): one active phone ≈ 720 requests/hour (2 calls per 10 s), console ≈ 360/hour. README documents this and Hobby's non-commercial rule (sources: vercel.com/docs/plans/hobby, neon.com/docs/introduction/plans).

## Risks / Trade-offs

- [Enum values cannot be removed easily] → Accepted; rollback means redeploying old code, which ignores the new values only for display.
- [Row locks serialise concurrent batches on the same dishes] → Batches are per table and tiny; contention is negligible.
- [Hobby limits are monthly hard caps (30-day pause)] → Polling slowed and paused when idle; documented budget; heavier use needs Pro.
- [Neon stays awake while any screen polls] → Same mitigation; an always-open console tab for 12 h/day uses ≈ 360 of ≈ 400 free hours.
- [Old `cancelled` rows from earlier phases mix customer and staff removals] → First production version; no historical data to separate.

## Migration Plan

`npm run db:generate` → review the enum and table migration → `npm run db:migrate`. No seed change. Rollback: redeploy the previous build; the new enum values and table remain unused.
