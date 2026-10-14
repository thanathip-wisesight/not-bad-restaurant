# Tasks

## 1. Schema and domain

- [ ] 1.1 Add `voided` and `finished` to `item_status` and the `order_item_events` table with its actor enum and index (D1, D2); verify the generated migration applies to the test database and existing rows are unchanged
- [ ] 1.2 Update `lib/domain.ts`: statuses, `void → voided` with required reason, optional remark on cancel decisions, `RESOLVED`, `CHARGED`, customer label mapping, reason rule (D3); verify unit tests for every allowed and rejected transition, reason lengths (" ", "ok", "abc", 501 chars), Bill total counting `served` and `finished` only, and labels

## 2. Service layer

- [ ] 2.1 Implement `transitionItems()` with locking, same-table and same-status checks, 404/400/409 errors, one timestamp, and event inserts (D4); route the single-item customer and staff paths through it; verify tests: batch of two shares one `at`, mixed tables → 400, mixed statuses → 400, a dish changed meanwhile → 409 naming it with nothing changed, void without reason → 400, confirm cancel with remark logs the remark
- [ ] 2.2 Log `none → pending` on confirm (D6) and set final statuses with system events on payment, Mark paid, and force-clear (D5); verify tests: paid Bill turns served into finished and keeps cancelled, force-clear voids pending/in-progress with "table cleared", Bill total unchanged after closing, payment gate accepts voided
- [ ] 2.3 Telemetry queries for dish counts and dish timelines with range rules and branch scope (D7); verify tests: counts per menu item for a known scenario, ASOK data excluded from SIAM, `from > to` and bad dates rejected, timeline events in time order with actor and note

## 3. API

- [ ] 3.1 `POST /api/console/[branch]/items/batch`; single-item route forwards to the same service call with an optional note (D4, D8); verify tests: 401 without session, 403 other branch, batch result codes as in 2.1
- [ ] 3.2 `GET /api/console/[branch]/telemetry/dishes` and `/telemetry/items` (D7); verify tests: 401, 403, 400 for bad range or menu item ID, JSON shape and values

## 4. UI

- [ ] 4.1 Console: void/remark dialog for single actions, voided status label and reason in the drawer, board hides voided (D8); verify in the browser walkthrough that a void without reason is blocked and the reason shows in the drawer
- [ ] 4.2 Console: batch selection limited to same table and status, select all, sticky action bar, on board, drawer, and phone list (D8); verify in the walkthrough: two pending dishes started together, other-table checkbox disabled, batch void with one reason
- [ ] 4.3 Customer: voided and cancelled both shown as "Cancelled" without reasons; verify in the walkthrough
- [ ] 4.4 Polling every 10 s and customer pause/resume (D9); verify a unit test of the pause rule and, in the walkthrough, that an idle phone after payment makes no requests for 25 s and resumes on interaction

## 5. Docs and integration

- [ ] 5.1 README: free-tier budget with sources, non-commercial rule, telemetry endpoints with example requests; verify the example requests return the documented shape against a local server
- [ ] 5.2 Run `npm test`, `npm run e2e`, lint, typecheck, and build; all pass

## Workflow follow-up

- When archiving, update `openspec/specs/*/spec.th.md` for every synced capability, create `openspec/specs/order-history/spec.th.md`, and update `docs/SPEC.md` and `docs/SPEC.th.md`.
