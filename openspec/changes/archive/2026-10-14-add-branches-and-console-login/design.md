# Design

## Context

Current state: tables are identified by a globally unique `tables.number`; customer routes are `/t/[table]` and `/api/tables/[table]/…`; console routes are `/console`, `/console/history`, `/console/bills/[id]/print` and `/api/console/…`, all unauthenticated. Rules live in `lib/service.ts`; Bill numbers are generated in SQL in `openSession()`. Postgres via Drizzle + `pg`; Next.js 16 with Cache Components (request data must be read inside `<Suspense>` or in route handlers). Motivation: proposal.md – Why.

## Goals / Non-Goals

**Goals:**
- Branch-aware data model with a safe migration of existing rows to SIAM.
- Staff login and branch-scoped authorization enforced in server code for every console page and API.
- No new dependencies.

**Non-Goals:**
- An auth framework, OAuth, or JWTs.
- Denormalising `branch_id` onto sessions, carts, or orders (derived through `tables`).

## Decisions

### D1. Branch via the table, not copied onto every row
New `branches(id, code unique, name)`; `tables.branch_id` (FK, not null) with unique `(branch_id, number)` replacing unique `number`. Sessions, carts, tickets, and order items already reference `tables` (directly or via the session), so their branch is a join away and can never disagree with their table.
*Alternative:* `branch_id` on every table — redundant and can drift.

### D2. Migration with backfill
One generated Drizzle migration, hand-edited for data: create `branches`; insert `('SIAM','Not Bad Siam')`; add `tables.branch_id` nullable; set it to SIAM for all rows; set NOT NULL; swap the unique constraints. Existing `bill_no` values are untouched. ASOK and its tables come from the seed, not the migration.

### D3. Bill number
`openSession()` builds `code || '-T' || lpad(number,2,'0') || '-' || lpad(nextval('bill_seq')::text,4,'0')` — global sequence, unique index unchanged.

### D4. Routes
- Customer: `/b/[branch]/t/[table]` (+ `/pay`); APIs `/api/b/[branch]/tables/[table]/…`. `getTable(branchCode, number)` replaces `getTable(number)`; old `/t/…` routes are deleted (404 → "table not found" page).
- Console: `/login` (public), `/console` (redirects to the user's branch or shows the picker), `/console/[branch]`, `/console/[branch]/history`, `/console/[branch]/bills/[id]/print`; APIs `/api/console/[branch]/…`; auth APIs `/api/auth/login`, `/api/auth/logout`.
Putting the branch in the URL makes the selection explicit, bookmarkable, and checkable on every request without extra session state.

### D5. Passwords and sessions with `node:crypto`
- Tables: `users(id, username unique, password_hash, display_name)`, `user_branches(user_id, branch_id)` PK both, `staff_sessions(token_hash pk, user_id, expires_at)`.
- Hash: `scrypt(password, 16-byte random salt, 64)` stored as `scrypt$<salt b64>$<hash b64>`; verify with `timingSafeEqual`. Unknown username still runs a dummy verify so timing doesn't reveal which part was wrong.
- Session: 32 random bytes, base64url, sent as cookie `staff_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production); only its SHA-256 is stored. `expires_at = now + 24h`, extended on a console request when less than 23h remain (sliding window without a write per request). Logout deletes the row and clears the cookie.

### D6. One guard, called everywhere
`lib/auth.ts` exports `requireStaff(branchCode?)`: reads the cookie, loads the session and user, rejects expired sessions, and when a branch is given checks membership → returns `{ user, branch }` or throws `AppError` 401/403. Console route handlers call it first; console pages call it inside their `<Suspense>` child and turn 401 into `redirect('/login?next=…')` and 403 into a "no access to this branch" page. No Next.js proxy/middleware: a guard that touches the DB belongs next to the code it protects, and one helper keeps the rule in one place.
*Alternative:* HTTP Basic Auth — no logout or branch picker; Auth.js — more than a seeded-users demo needs.

### D7. Branch-ownership checks in the service layer
Console service functions take the resolved `branchId`: overview/history filter by it; `transitionItem`, `markPaid`, `clearSession`, and `getBill` add `tables.branch_id = $branchId` to their lookups, so an id from another branch behaves exactly like a missing id (404) and nothing changes.

### D8. Seed
Seed creates SIAM (10 tables), ASOK (6 tables), the shared menu, and users `siam.staff` / `area.manager` with demo passwords hashed at seed time; passwords are printed in the README only. The existing `--force` guard is kept for a full re-seed.

`--users-only` is non-destructive: in one transaction it upserts branches by code (inserting missing ASOK tables, never renumbering or deleting existing ones), upserts users by username (resetting their password hash to the demo value), and inserts missing `user_branches` rows. It never truncates and never touches menu, sessions, carts, orders, or Bills, so an existing database keeps its history. It runs without `--force` and can be repeated safely.

### D9. Tests
- Unit: hash/verify round-trip and rejection; session expiry/extension rule.
- Service/route: branch isolation (same table number in two branches), Bill number format, 401 without cookie, 403 for non-member branch, 404 for another branch's item.
- Browser walkthrough: customer flow under `/b/SIAM/…`, staff login, single-branch redirect, multi-branch picker and switch, 403 page.

## Risks / Trade-offs

- [Breaking URLs: any saved `/t/<n>` link stops working] → Accepted for a demo; README and demo index list the new links.
- [Cookie theft gives 24 h of access] → `HttpOnly` + `Secure` + `SameSite=Lax`; rate limiting and lockout are out of scope.
- [Seed `--force` wipes users too] → Same guard as today; documented.
- [Migration on a live DB] → Single transaction; demo data only.

## Migration Plan

1. `npm run db:generate` then hand-edit the migration for the SIAM backfill (D2); `npm run db:migrate`.
2. Fresh database: `npm run db:seed`. Existing database with history: `npm run db:seed -- --users-only` to add ASOK and the staff accounts without touching bills (D8).
3. Rollback: redeploy the previous build and restore the database backup; the schema change is not backward-compatible.
