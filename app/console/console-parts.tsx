"use client";

// Shared console pieces (console-desktop-layout design D6): one place for data, actions and their rules.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_STYLE } from "@/components/table-app";
import { ACTIONS, STATUS_LABELS, actionsFor, type Action, type ItemStatus } from "@/lib/domain";
import { ApiError, api, baht, usePolling } from "@/lib/client";
import type { ConsoleTableDto, OrderItemDto } from "@/lib/service";

export type OpenTable = ConsoleTableDto & { session: NonNullable<ConsoleTableDto["session"]> };

export type ConsoleHandlers = {
  act: (itemId: number, action: Action) => void;
  markPaid: (sessionId: number) => void;
  clear: (sessionId: number, tableNumber: number) => void;
  print: (sessionId: number) => void;
};

export function useConsoleData(branchCode: string) {
  const base = `/api/console/${branchCode}`;
  const router = useRouter();
  const [tables, setTables] = useState<ConsoleTableDto[] | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setTables(await api<ConsoleTableDto[]>(`${base}/tables`));
      setNow(Date.now());
    } catch (e) {
      // Session expired or logged out elsewhere: back to login, then here (console-access spec).
      if (e instanceof ApiError && e.status === 401)
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      // anything else: next poll retries
    }
  };
  usePolling(refresh);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    }
    await refresh();
  };

  const handlers: ConsoleHandlers = {
    act: (itemId, action) => run(() => api(`${base}/items/${itemId}`, "POST", { action })),
    markPaid: (sessionId) =>
      run(async () => {
        try {
          await api(`${base}/sessions/${sessionId}/pay`, "POST", { force: false });
        } catch (e) {
          if (e instanceof ApiError && e.body.error === "unsent_carts") {
            if (window.confirm(`${e.message}\n\nPay anyway?`))
              await api(`${base}/sessions/${sessionId}/pay`, "POST", { force: true });
            return;
          }
          if (e instanceof ApiError && e.body.error === "unresolved_items") {
            const items = (e.body.items as { name: string; status: ItemStatus }[]) ?? [];
            throw new ApiError(409, {
              message: `Cannot mark paid. Unresolved: ${items.map((i) => `${i.name} (${STATUS_LABELS[i.status]})`).join(", ")}`,
            });
          }
          throw e;
        }
      }),
    clear: (sessionId, tableNumber) => {
      if (window.confirm(`Clear table ${tableNumber}? An unpaid bill will be recorded as voided.`))
        run(() => api(`${base}/sessions/${sessionId}/clear`, "POST"));
    },
    print: (sessionId) => window.open(`/console/${branchCode}/bills/${sessionId}/print?print=1`, "_blank"),
  };

  return { tables, now, error, handlers };
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function ItemActions({ item, act }: { item: Pick<OrderItemDto, "id" | "status">; act: ConsoleHandlers["act"] }) {
  return (
    <>
      {actionsFor(item.status, "staff").map((a) => (
        <button key={a} onClick={() => act(item.id, a)} className="rounded border bg-white px-2 py-0.5 text-xs hover:bg-stone-100">
          {ACTIONS[a].label}
        </button>
      ))}
    </>
  );
}

export function OptionsAndNote({ item }: { item: Pick<OrderItemDto, "options" | "note"> }) {
  return (
    <>
      {item.options.length > 0 && <p className="text-xs text-stone-600">{item.options.map((o) => o.name).join(", ")}</p>}
      {item.note && <p className="text-xs italic text-stone-600">“{item.note}”</p>}
    </>
  );
}

export function BillActions({ table, handlers }: { table: OpenTable; handlers: ConsoleHandlers }) {
  const { id } = table.session;
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <button onClick={() => handlers.markPaid(id)} className="rounded bg-emerald-600 py-1.5 text-white">
        Mark paid
      </button>
      <button onClick={() => handlers.print(id)} className="rounded border py-1.5">
        Print bill
      </button>
      <button onClick={() => handlers.clear(id, table.tableNumber)} className="rounded border border-red-300 py-1.5 text-red-700">
        Clear table
      </button>
    </div>
  );
}

// Every dish of one open bill with its actions, then the bill actions. Used by phone cards and the drawer.
export function TableDetail({ table, handlers }: { table: OpenTable; handlers: ConsoleHandlers }) {
  const s = table.session;
  return (
    <>
      {s.unsentCartQty > 0 && <p className="text-xs text-stone-500">{s.unsentCartQty} dish(es) in customer carts (not sent)</p>}
      <ul className="mt-2 divide-y">
        {s.items.map((i) => (
          <li key={i.id} className={`py-2 ${i.status === "cancel_requested" ? "-mx-3 bg-amber-100 px-3" : ""}`}>
            <div className="flex justify-between gap-2 text-sm">
              <span className="font-medium">{i.name}</span>
              <span>{baht(i.unitPrice)}</span>
            </div>
            <OptionsAndNote item={i} />
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <StatusBadge status={i.status} />
              <ItemActions item={i} act={handlers.act} />
            </div>
          </li>
        ))}
        {!s.items.length && <li className="py-2 text-sm text-stone-500">No confirmed orders yet.</li>}
      </ul>
      <p className="mt-2 flex justify-between text-sm font-semibold">
        <span>Total (served)</span>
        <span>{baht(s.total)}</span>
      </p>
      <div className="mt-3">
        <BillActions table={table} handlers={handlers} />
      </div>
    </>
  );
}

export const isOpen = (t: ConsoleTableDto): t is OpenTable => t.session !== null;
