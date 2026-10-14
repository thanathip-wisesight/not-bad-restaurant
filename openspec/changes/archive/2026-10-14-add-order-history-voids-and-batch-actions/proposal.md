# Proposal

## Why

Phase 3 (`rough-spec-phase-3.md`) targets edge cases and data: today a dish removed at the customer's request and a dish staff threw out on their own both end as `cancelled`, with no reason and no record of when anything happened, so nothing can be learned about popular or problematic dishes. Staff also have to tap every dish one by one, and the app must now fit Vercel's and Neon's free tiers.

## What Changes

- **BREAKING (data)** The final "removed" status splits in two: `cancelled` (customer asked, staff confirmed, optional remark) and `voided` (staff-initiated from `pending` or `in_progress`, reason of at least 3 characters required). Customers see both as "Cancelled"; only the console distinguishes them.
- When a Bill closes, `served` dishes become `finished`; on a force-clear, dishes still `pending`, `cancel_requested`, or `in_progress` become `voided` with the reason "table cleared". `cancelled` and `voided` keep their status.
- Every status change is logged with from/to status, time, who did it (staff user, customer device, or system), and an optional note. Batch changes share one timestamp. The log starts with this release; earlier dishes are not backfilled.
- Two login-protected, branch-scoped JSON endpoints expose the history: per-dish counts by menu item ID (ordered, finished, cancelled, voided) and per-dish timelines, both filterable by date range (and menu item ID for timelines).
- Staff can select several dishes of the **same table and same status** (board, table drawer, and phone card list, each with "select all") and apply one action to all of them at once; the batch is all-or-nothing.
- Free-tier fit: screens refresh every 10 seconds instead of 5 (spec limit "within 15 seconds" instead of 10); a customer phone stops refreshing while its table has no open Bill and its cart is empty. README documents the Hobby/Neon Free budget and Hobby's non-commercial-use rule.

### Non-goals

- A reports UI, charts, cross-branch reports, or exports (JSON API only, one branch at a time).
- Backfilling history for dishes created before this release.
- Undoing a status change, editing reasons after the fact, or batches spanning tables or statuses.
- Deploying to Vercel (remains the owner's step).

## Capabilities

### New Capabilities

- `order-history`: Status-change log for every dish and the branch-scoped JSON telemetry endpoints built on it.

### Modified Capabilities

- `menu-browsing`: Retired `/t/<tableNo>` links get the standard not-found page instead of "table not found" (the dedicated route was removed).
- `order-tracking`: Status lifecycle gains `voided` and `finished`; customer view shows both removed statuses as "Cancelled"; refresh limit 15 s; refreshing pauses when there is nothing to show.
- `payment`: Payment gate, Bill total, and session closing account for `voided` and `finished`; refresh limit 15 s.
- `restaurant-console`: Item actions (void with reason, cancel decisions with remark), Mark paid, Force-clear, receipt, board columns, header counts, table strip, table drawer, and overview refresh updated for the new statuses; new batch selection and batch update.

## Impact

- Schema: `item_status` enum gains `voided` and `finished`; new `order_item_events` table. Migration only adds; no data rewrite.
- `lib/domain.ts` (statuses, actions, totals), `lib/service.ts` (transitions become batch-capable and log events; closing finishes/voids dishes; telemetry queries), console API gains batch and telemetry routes.
- Console UI (selection, reason/remark prompts, new status labels), customer UI (label mapping, polling pause), polling interval in `lib/client.ts`.
- Tests and the browser walkthrough are extended; README gains the free-tier budget. No new dependencies.
