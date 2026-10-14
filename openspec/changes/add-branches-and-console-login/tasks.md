# Tasks

## 1. Schema and migration

- [x] 1.1 Add `branches`, `tables.branch_id` with unique (branch_id, number), `users`, `user_branches`, `staff_sessions` to `db/schema.ts` (D1, D5); verify `drizzle-kit generate` produces one migration
- [x] 1.2 Hand-edit the migration to insert SIAM and backfill `tables.branch_id` before NOT NULL (D2); verify on a copy of a pre-change database that every table, session, order, and Bill is under SIAM and old Bill numbers are unchanged

## 2. Branches in the service layer and seed

- [x] 2.1 Make table lookups branch-aware (`getTable(branchCode, number)`), Bill number with branch code (D3); verify service tests: same table number in SIAM and ASOK gives separate sessions, Bill numbers `SIAM-T05-…` / `ASOK-T05-…`
- [x] 2.2 Scope console service functions by branch and add ownership checks (D7); verify tests: overview/history show only the branch, another branch's item/Bill id returns 404 and stays unchanged
- [x] 2.3 Seed SIAM (10) and ASOK (6) tables and the two staff users with hashed passwords (D8); verify counts and memberships by query
- [x] 2.4 Add non-destructive `--users-only` seed mode (D8); verify a test: on a database with a paid Bill, running it twice adds ASOK and both users, keeps the Bill and its items, and creates no duplicates

## 3. Authentication

- [x] 3.1 `lib/auth.ts`: scrypt hash/verify, session create/lookup/extend/delete, `requireStaff(branchCode?)` (D5, D6); verify unit tests for hash round-trip, wrong password, expiry after 24 h, extension rule
- [x] 3.2 `/api/auth/login` and `/api/auth/logout` with generic error message and cookie flags; verify tests: correct login sets cookie, wrong password does not, logout deletes the session

## 4. Routes and UI

- [x] 4.1 Move customer pages and APIs under `/b/[branch]/…`, show branch name, delete `/t/…` (D4); verify `/b/SIAM/t/5` works and `/t/5` shows "table not found"
- [x] 4.2 Move console pages and APIs under `/[branch]`, call `requireStaff` everywhere, redirect pages to `/login?next=…`, 403 page; verify tests: console API without cookie → 401, non-member branch → 403
- [x] 4.3 `/login` page, `/console` redirect/picker, branch name + Switch branch + Log out in the console header; verify single-branch user lands on SIAM and multi-branch user sees the picker
- [x] 4.4 Receipt and history show the branch (restaurant-console delta); verify a SIAM receipt shows the SIAM branch name
- [x] 4.5 Update demo index links, README (new URLs, demo credentials, migration steps); verify the README commands run as written on a fresh database

## 5. Integration

- [x] 5.1 Update the browser walkthrough: customer flow under `/b/SIAM/…`, staff login, single-branch redirect, multi-branch picker and switch, ASOK isolation, 403 for `siam.staff` on ASOK, logout; verify `npm test`, `npm run e2e`, lint, typecheck, and build all pass

## Workflow follow-up

- Update `docs/SPEC.md` and `docs/SPEC.th.md` to include branches and console access when this change is applied.
