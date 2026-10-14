"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BOARD_COLUMNS, boardColumns, formatElapsed, type BoardCard, type BoardStatus } from "@/lib/console";
import { RESOLVED, STATUS_LABELS } from "@/lib/domain";
import { baht } from "@/lib/client";
import type { ConsoleTableDto } from "@/lib/service";
import { LogoutButton } from "./logout-button";
import {
  ItemActions,
  OptionsAndNote,
  TableDetail,
  isOpen,
  useConsoleData,
  type ConsoleHandlers,
  type OpenTable,
} from "./console-parts";

// Kitchen board at md (>= 768 px), per-table cards below it; switched in CSS (design D2).
export function ConsoleBoard({
  branchCode,
  branchName,
  staffName,
  canSwitch,
}: {
  branchCode: string;
  branchName: string;
  staffName: string;
  canSwitch: boolean;
}) {
  const { tables, now, error, handlers } = useConsoleData(branchCode);
  const [drawerSession, setDrawerSession] = useState<number | null>(null);
  const open = tables?.filter(isOpen) ?? [];
  const cols = boardColumns(open);
  // Keyed by session, so the drawer disappears once that bill closes (design D5).
  const drawerTable = open.find((t) => t.session.id === drawerSession);

  return (
    <main className="mx-auto max-w-6xl p-4 md:flex md:h-dvh md:max-w-none md:flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">
          Restaurant console <span className="font-normal text-stone-500">· {branchName}</span>
        </h1>
        <nav className="flex items-center gap-4 text-sm">
          <span className="text-stone-500">{staffName}</span>
          {canSwitch && (
            <Link href="/console?choose=1" className="underline">
              Switch branch
            </Link>
          )}
          <Link href={`/console/${branchCode}/history`} className="underline">
            Bill history
          </Link>
          <LogoutButton />
        </nav>
      </header>
      {error && (
        <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {!tables && <p className="mt-6 text-stone-500">Loading…</p>}
      {tables && (
        <>
          <div className="md:hidden" data-testid="phone-console">
            <CountBar cols={cols} />
            <PhoneList tables={tables} handlers={handlers} />
          </div>
          <div className="hidden min-h-0 flex-1 flex-col md:flex" data-testid="board-console">
            <TableStrip tables={tables} selected={drawerSession} onSelect={setDrawerSession} />
            <Board cols={cols} now={now} handlers={handlers} />
          </div>
          {drawerTable && <TableDrawer table={drawerTable} handlers={handlers} onClose={() => setDrawerSession(null)} />}
        </>
      )}
    </main>
  );
}

const headerStyle = (s: BoardStatus, count: number) =>
  s === "cancel_requested" && count > 0 ? "bg-amber-300 text-amber-950" : "bg-stone-200 text-stone-800";

function Board({ cols, now, handlers }: { cols: Record<BoardStatus, BoardCard[]>; now: number; handlers: ConsoleHandlers }) {
  return (
    <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 gap-3" data-testid="kitchen-board">
      {BOARD_COLUMNS.map((s) => (
        <section key={s} aria-label={STATUS_LABELS[s]} className="flex min-h-0 flex-col rounded-lg border bg-stone-100">
          <h2 className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-sm font-semibold ${headerStyle(s, cols[s].length)}`}>
            <span>{STATUS_LABELS[s]}</span>
            <span data-testid="column-count" className="rounded-full bg-white/70 px-2">
              {cols[s].length}
            </span>
          </h2>
          <ul className="flex-1 space-y-2 overflow-y-auto p-2">
            {cols[s].map((c) => (
              <li key={c.id} className="rounded-md border bg-white p-2 shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold">Table {c.tableNumber}</span>
                  <span className="text-xs text-stone-500" data-testid="elapsed">
                    {formatElapsed(c.updatedAt, now)}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight">{c.name}</p>
                <OptionsAndNote item={c} />
                <div className="mt-1 flex flex-wrap gap-1">
                  <ItemActions item={c} act={handlers.act} />
                </div>
              </li>
            ))}
            {!cols[s].length && <li className="p-2 text-xs text-stone-400">Nothing here</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TableStrip({
  tables,
  selected,
  onSelect,
}: {
  tables: ConsoleTableDto[];
  selected: number | null;
  onSelect: (sessionId: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="table-strip">
      {tables.map((t) =>
        isOpen(t) ? (
          <button
            key={t.tableNumber}
            onClick={() => onSelect(t.session.id)}
            className={`rounded-lg border px-3 py-1.5 text-left text-xs ${t.session.items.some((i) => i.status === "cancel_requested") ? "border-amber-400 bg-amber-50" : "bg-white"} ${selected === t.session.id ? "ring-2 ring-orange-500" : ""}`}
          >
            <span className="block text-sm font-bold">Table {t.tableNumber}</span>
            <span className="font-mono">{t.session.billNo}</span> · {baht(t.session.total)} ·{" "}
            {t.session.items.filter((i) => !RESOLVED.includes(i.status)).length} open
          </button>
        ) : (
          <span key={t.tableNumber} className="rounded-lg bg-stone-200 px-3 py-1.5 text-xs text-stone-500">
            <span className="block text-sm font-bold">Table {t.tableNumber}</span>
            Free
          </span>
        ),
      )}
    </div>
  );
}

function TableDrawer({ table, handlers, onClose }: { table: OpenTable; handlers: ConsoleHandlers; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`Table ${table.tableNumber} bill`}
        className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Table {table.tableNumber}</h2>
          <span className="font-mono text-sm">{table.session.billNo}</span>
          <button onClick={onClose} aria-label="Close" className="text-lg">
            ✕
          </button>
        </div>
        <TableDetail table={table} handlers={handlers} />
      </aside>
    </div>
  );
}

function CountBar({ cols }: { cols: Record<BoardStatus, BoardCard[]> }) {
  const pending = cols.cancel_requested.length;
  return (
    <div className="mt-3 flex gap-2 text-xs" data-testid="count-bar">
      <span className={`rounded-full px-3 py-1 ${pending ? "bg-amber-300 font-semibold text-amber-950" : "bg-stone-200"}`}>
        {pending} cancel requested
      </span>
      <span className="rounded-full bg-stone-200 px-3 py-1">{cols.pending.length} pending</span>
      <span className="rounded-full bg-stone-200 px-3 py-1">{cols.in_progress.length} in progress</span>
    </div>
  );
}

function PhoneList({ tables, handlers }: { tables: ConsoleTableDto[]; handlers: ConsoleHandlers }) {
  return (
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
      {tables.map((t) => (
        <section key={t.tableNumber} className="rounded-lg border bg-white p-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Table {t.tableNumber}</h2>
            {t.session ? <span className="font-mono text-sm">{t.session.billNo}</span> : <span className="text-sm text-emerald-700">Free</span>}
          </div>
          {isOpen(t) && <TableDetail table={t} handlers={handlers} />}
        </section>
      ))}
    </div>
  );
}
