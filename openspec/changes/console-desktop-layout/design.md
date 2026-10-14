# Design

## Context

Current console (`app/console/console-board.tsx`) is one client component polling `GET /api/console/tables` every 5 s and rendering a card per table in a `max-w-6xl` grid. `consoleOverview()` already returns every table with its open session's items; the item DTO (`sessionItems` in `lib/service.ts`) omits `updated_at`, which the board needs for elapsed time and ordering. Motivation: proposal.md – Why.

## Goals / Non-Goals

**Goals:**
- Kitchen board for ≥768 px, unchanged-behaviour card list for phones, from the same polled data.
- No new API routes, schema changes, or dependencies.

**Non-Goals:**
- Server-side grouping or a board-specific endpoint (data volume is tiny).
- Persisting drawer or scroll state across reloads.

## Decisions

### D1. One data source, pure grouping
Keep the single poll. Add `updatedAt` (ISO string) to the item DTO. A pure `boardColumns(tables)` in `lib/console.ts` flattens open-session items with their table number, drops `cancelled`, groups by status into the four ordered columns, and sorts (oldest `updatedAt` first; Served newest first). `formatElapsed(updatedAt, now)` returns whole minutes ("0 min", "4 min"). Both are unit-tested.
*Alternative:* `GET /api/console/board` – rejected, duplicates `consoleOverview()`.

### D2. Breakpoint switch in CSS, not JS
Render the board under `hidden md:flex` and the phone list under `md:hidden` (Tailwind `md` = 768 px). No `matchMedia`, so no hydration mismatch and no layout flash. Both views receive the same props; the hidden one costs only DOM for ≤10 tables.
*Alternative:* `useSyncExternalStore(matchMedia)` as in customer D15 – unnecessary here because neither view has state that must survive a resize.

### D3. Board geometry
Full-width page (`max-w-none`) at `md+`. Layout: header → table strip (wrapping chips) → board filling the remaining viewport height (`h-[calc(100dvh-…)]`) as a 4-column grid; each column has a sticky header and its own vertical scroll, so headers with counts stay visible.

### D4. Elapsed time refresh
`now` is taken at each poll (every 5 s) and passed down; no extra timer. Minute precision makes 5 s staleness invisible.

### D5. Drawer state
`selectedTable: number | null` in the board component. The drawer renders that table from the latest poll; if the table has no open session after a poll (paid/cleared elsewhere), `selectedTable` resets to null. Dismiss via close button, backdrop click, or Escape. Item and bill actions reuse the existing handlers (`act`, `markPaid`, `clear`, print).

### D6. Shared pieces
Extract the existing action buttons, status badge, and bill actions from `console-board.tsx` into small components used by board cards, drawer, and phone list, so the rules (`actionsFor`, unsent-cart warning, unresolved rejection) stay in one place.

## Risks / Trade-offs

- [Served column grows during a long service] → Bounded by open bills only; closes with each bill. Acceptable for a demo.
- [768 px portrait tablet gives ~180 px per column] → Cards use compact text; action buttons wrap.
- [Both views in the DOM] → Tests must target the visible view (e.g. `:visible` selectors).
