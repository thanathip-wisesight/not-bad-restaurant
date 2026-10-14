# Not Bad Restaurant – QR ordering demo

Demo/POC for a restaurant brand with several branches. Customers order from their table by phone (no login); staff log in to a console scoped to their branches. No real payment.
Plain-language spec: [docs/SPEC.md](docs/SPEC.md) ([ไทย](docs/SPEC.th.md)). Specs: [openspec/specs](openspec/specs); changes: [openspec/changes](openspec/changes).

## Run locally

Requires Node 24 and Docker.

```bash
npm install
cp .env.example .env.local   # local DB URLs, matches docker-compose.yml
npm run db:up                # Postgres 17 on :5432 (creates restaurant, restaurant_test, restaurant_e2e)
npm run db:ping              # prints the database name and version
npm run db:migrate           # apply db/migrations
npm run db:seed              # fresh DB: branches SIAM (10 tables) + ASOK (6), 60 Thai dishes, staff accounts
npm run dev
```

Seed modes:

| Command | Use it for | Effect |
|---|---|---|
| `npm run db:seed` | empty database | full seed; refuses if any bill exists |
| `npm run db:seed -- --users-only` | existing database with history | adds missing branches, tables, staff accounts; resets demo passwords; never deletes |
| `npm run db:seed -- --force` | throwaway database | wipes everything (bills and accounts too) and re-seeds |

Upgrading a database from before branches: `npm run db:migrate` moves every existing table, order, and bill to SIAM (bill numbers unchanged), then `npm run db:seed -- --users-only` adds ASOK and the staff accounts.

- `http://localhost:3000/` – demo index with links standing in for each branch's table QR codes
- `http://localhost:3000/b/SIAM/t/5` – customer menu for SIAM table 5 (old `/t/5` links show "table not found")
- `http://localhost:3000/console` – restaurant console (staff login at `/login`)

Demo staff accounts (demo only — change for any real use):

| Username | Password | Branches |
|---|---|---|
| `siam.staff` | `siam-demo` | SIAM |
| `area.manager` | `manager-demo` | SIAM, ASOK |

To try on a phone on the same Wi-Fi, open `http://<your-LAN-IP>:3000/b/SIAM/t/5`.

## Tests

```bash
npm test   # Vitest; migrates and uses TEST_DATABASE_URL, never DATABASE_URL
```

Browser walkthrough (two phones + console, needs Google Chrome). It wipes its database, so it uses `restaurant_e2e`, never the dev DB:

```bash
export DATABASE_URL=postgres://app:app@localhost:5432/restaurant_e2e   # created by docker-compose init
npm run db:migrate && npm run db:seed -- --force && npm run build
npx next start -p 3100 &        # separate from any `npm run dev`
npm run e2e -- http://localhost:3100   # screenshots land in tests/e2e/shots/
```

## Deploy (Vercel + Neon)

1. Add Neon from the Vercel Marketplace to the project (sets `DATABASE_URL`).
2. Locally, with `DATABASE_URL` pointed at Neon: `npm run db:migrate`, then `npm run db:seed` on an empty database or `npm run db:seed -- --users-only` on one with history.
3. Deploy with `vercel` or a git push. Session cookies are `Secure` in production, so the console needs HTTPS (Vercel provides it).

## Order history API (staff login required)

Every dish status change is logged (who, when, from → to, reason/remark). Two JSON endpoints read it for the selected branch. Range: `from` inclusive, `to` exclusive, ISO dates; default last 30 days; max 366 days; filtered by when the dish was ordered.

```bash
curl -c cookies.txt -H 'content-type: application/json' \
  -d '{"username":"siam.staff","password":"siam-demo"}' http://localhost:3000/api/auth/login

# per menu item: how often ordered and how those dishes ended
curl -b cookies.txt 'http://localhost:3000/api/console/SIAM/telemetry/dishes?from=2026-10-01&to=2026-11-01'
# {"branch":"SIAM","from":"…","to":"…","dishes":[{"menuItemId":1,"name":"ผัดไทยกุ้งสด / Pad Thai with Shrimp","ordered":2,"finished":1,"cancelled":1,"voided":0}, …]}

# individual dishes (newest first, max 500) with their full status log
curl -b cookies.txt 'http://localhost:3000/api/console/SIAM/telemetry/items?menuItemId=1'
# {"branch":"SIAM","limit":500,"items":[{"id":2,"status":"finished","billNo":"SIAM-T05-0049","tableNumber":5,"orderedAt":"…",
#   "events":[{"from":null,"to":"pending","by":"customer",…},{"from":"pending","to":"in_progress","by":"siam.staff",…},
#             {"from":"in_progress","to":"served",…},{"from":"served","to":"finished","by":"system",…}]}]}
```

401 without a session, 403 for another branch, 400 for a bad range or `menuItemId`.

## Free-tier hosting budget

Free tiers are hard monthly caps, so the app polls every 10 s (not 5 s) and a customer phone stops polling while its table has no open bill and its cart is empty.

| Free tier | Included per month | What uses it here |
|---|---|---|
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) | 1,000,000 function invocations, 4 active-CPU hours; over the limit the feature pauses for 30 days | ≈ 720 requests/hour per active phone, ≈ 360/hour per open console tab |
| [Neon Free](https://neon.com/docs/introduction/plans) | 100 CU-hours (≈ 400 h at 0.25 CU); scales to zero after 5 min idle; compute suspended when exhausted | the database stays awake while any screen polls; a console open 12 h/day ≈ 360 h/month |

Vercel Hobby is for **personal, non-commercial use only** ([fair use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)); a real restaurant needs Pro.

## Layout

- `lib/domain.ts` – status transitions, bill total, menu pagination (pure)
- `lib/service.ts` – all server-side rules (branches, sessions, cart, confirm, pay, console scoping)
- `lib/auth.ts`, `lib/password.ts` – staff sessions and the console guard; scrypt password hashes
- `app/api/**` – thin JSON route handlers over `lib/service.ts`; console APIs call `requireStaff` first
- `components/table-app.tsx` – customer UI; `app/console/**` – staff UI; `app/login` – staff login
- `db/schema.ts`, `db/migrations/` – Drizzle schema and SQL (`0001` backfills existing data to SIAM)
