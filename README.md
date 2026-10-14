# Not Bad Restaurant – QR ordering demo

Demo/POC: customers order from their table by phone; staff run a simple console. No auth, no real payment.
Plain-language spec: [docs/SPEC.md](docs/SPEC.md). OpenSpec change: [openspec/changes/add-customer-ordering-poc](openspec/changes/add-customer-ordering-poc).

## Run locally

Requires Node 24 and Docker.

```bash
npm install
cp .env.example .env.local   # local DB URLs, matches docker-compose.yml
npm run db:up                # Postgres 17 on :5432 (creates restaurant + restaurant_test)
npm run db:ping              # prints the database name and version
npm run db:migrate           # apply db/migrations
npm run db:seed              # 10 tables + 60 Thai dishes (refuses if bills exist; add -- --force to wipe)
npm run dev
```

- `http://localhost:3000/` – demo index with links standing in for table QR codes
- `http://localhost:3000/t/5` – customer menu for table 5
- `http://localhost:3000/console` – restaurant console

To try on a phone on the same Wi-Fi, open `http://<your-LAN-IP>:3000/t/5`.

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
2. Locally, with `DATABASE_URL` pointed at Neon: `npm run db:migrate && npm run db:seed`.
3. Deploy with `vercel` or a git push.

## Layout

- `lib/domain.ts` – status transitions, bill total, menu pagination (pure)
- `lib/service.ts` – all server-side rules (sessions, cart, confirm, pay, console)
- `app/api/**` – thin JSON route handlers over `lib/service.ts`
- `components/table-app.tsx` – customer UI; `app/console/**` – staff UI
- `db/schema.ts`, `db/migrations/` – Drizzle schema and SQL
