# Proposal

## Why

The brand runs more than one branch, so a table number alone no longer identifies a table, and the restaurant console is reachable by anyone who knows its URL. Phase 2 (`rough-spec-phase-2.md`) ties every table QR code to a branch and puts the console behind staff login, scoped to the branches each staff user belongs to. This partly reverses phase 1's "no authentication" non-goal, for the console only.

## What Changes

- **BREAKING** Table URLs become `/b/<branchCode>/t/<tableNo>` (e.g. `/b/SIAM/t/5`); the old `/t/<tableNo>` paths show "table not found".
- Branches (code + name) are introduced. Each branch has its own tables numbered from 1; the menu and prices stay shared across the brand. Seed: SIAM (10 tables) and ASOK (6 tables).
- Carts, orders, bills, and bill history belong to a branch through their table; the same table number in two branches never shares a session.
- **BREAKING** Bill numbers gain the branch code: `SIAM-T05-0042` (one global sequence).
- Existing tables, carts, orders, and bill history are migrated to branch SIAM; Bill numbers already issued are kept as they are.
- Staff log in with username and password; a session cookie keeps them logged in until 24 hours without activity or until they log out.
- All of `/console` (board, history, print) and every console API require login. A user with one branch lands on that branch's console; a user with several picks a branch and can switch later. Every console read and action is limited to the selected branch, enforced on the server.
- Staff users are seeded only (`siam.staff`: SIAM; `area.manager`: SIAM and ASOK). A non-destructive `--users-only` seed mode adds branches and staff accounts to an existing database without touching its history. The customer side stays open, without login.

### Non-goals

- Sign-up, user or branch administration screens, password reset or change, roles/permissions beyond branch membership.
- Rate limiting, account lockout, CSRF tokens beyond a `SameSite=Lax` cookie, audit logs, password strength rules.
- Per-branch menus or prices; branch-specific receipt templates.

## Capabilities

### New Capabilities

- `restaurant-branches`: Branch identity, per-branch tables, shared menu, branch isolation of sessions and bills, and migration of existing data to SIAM.
- `console-access`: Staff login/logout, session lifetime, protection of the console and its APIs, branch membership, branch selection and switching, and branch-scoped authorization.

### Modified Capabilities

- `menu-browsing`: Table menu entry by QR URL now includes the branch code and shows the branch.
- `payment`: Bill number format includes the branch code; cashier-payment example updated.
- `restaurant-console`: Tables overview, Table strip, Mark Bill paid, Bill history, and Print receipt are limited to the selected branch; receipts show the branch name.

## Impact

- Schema: new `branches`, `users`, `user_branches`, `staff_sessions`; `tables.branch_id` with unique (branch, number); migration with data backfill to SIAM.
- Routes: customer pages and APIs move under `/b/[branch]/…`; console pages under `/console/[branch]/…`, new `/login`; console APIs under `/api/console/[branch]/…`; new `/api/auth/login` and `/api/auth/logout`.
- `lib/service.ts` gains branch-aware lookups and branch-ownership checks; new `lib/auth.ts` (scrypt hashing, sessions) using only Node's built-in `crypto`.
- Seed, README (demo credentials), demo index links, unit tests, and the browser walkthrough are updated. No new dependencies.
