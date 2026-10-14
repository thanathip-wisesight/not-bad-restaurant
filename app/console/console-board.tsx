"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUS_STYLE } from "@/components/table-app";
import { ACTIONS, STATUS_LABELS, actionsFor, type Action } from "@/lib/domain";
import { ApiError, api, baht, usePolling } from "@/lib/client";
import type { ConsoleTableDto } from "@/lib/service";

export function ConsoleBoard() {
  const [tables, setTables] = useState<ConsoleTableDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setTables(await api<ConsoleTableDto[]>("/api/console/tables"));
    } catch {
      // next poll retries
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

  const act = (itemId: number, action: Action) => run(() => api(`/api/console/items/${itemId}`, "POST", { action }));

  const markPaid = (sessionId: number) =>
    run(async () => {
      try {
        await api(`/api/console/sessions/${sessionId}/pay`, "POST", { force: false });
      } catch (e) {
        if (e instanceof ApiError && e.body.error === "unsent_carts") {
          if (window.confirm(`${e.message}\n\nPay anyway?`))
            await api(`/api/console/sessions/${sessionId}/pay`, "POST", { force: true });
          return;
        }
        if (e instanceof ApiError && e.body.error === "unresolved_items") {
          const items = (e.body.items as { name: string; status: keyof typeof STATUS_LABELS }[]) ?? [];
          throw new ApiError(409, {
            message: `Cannot mark paid. Unresolved: ${items.map((i) => `${i.name} (${STATUS_LABELS[i.status]})`).join(", ")}`,
          });
        }
        throw e;
      }
    });

  const clear = (sessionId: number, tableNumber: number) => {
    if (window.confirm(`Clear table ${tableNumber}? An unpaid bill will be recorded as voided.`))
      run(() => api(`/api/console/sessions/${sessionId}/clear`, "POST"));
  };

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Restaurant console</h1>
        <Link href="/console/history" className="text-sm underline">
          Bill history
        </Link>
      </header>
      {error && (
        <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {!tables && <p className="mt-6 text-stone-500">Loading…</p>}
      <div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables?.map((t) => (
          <section key={t.tableNumber} className="rounded-lg border bg-white p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">Table {t.tableNumber}</h2>
              {t.session ? (
                <span className="font-mono text-sm">{t.session.billNo}</span>
              ) : (
                <span className="text-sm text-emerald-700">Free</span>
              )}
            </div>
            {t.session && (
              <>
                {t.session.unsentCartQty > 0 && (
                  <p className="text-xs text-stone-500">{t.session.unsentCartQty} dish(es) in customer carts (not sent)</p>
                )}
                <ul className="mt-2 divide-y">
                  {t.session.items.map((i) => (
                    <li key={i.id} className={`py-2 ${i.status === "cancel_requested" ? "-mx-3 bg-amber-100 px-3" : ""}`}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">{i.name}</span>
                        <span>{baht(i.unitPrice)}</span>
                      </div>
                      {i.options.length > 0 && <p className="text-xs text-stone-600">{i.options.map((o) => o.name).join(", ")}</p>}
                      {i.note && <p className="text-xs italic text-stone-600">“{i.note}”</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[i.status]}`}>{STATUS_LABELS[i.status]}</span>
                        {actionsFor(i.status, "staff").map((a) => (
                          <button key={a} onClick={() => act(i.id, a)} className="rounded border px-2 py-0.5 text-xs hover:bg-stone-100">
                            {ACTIONS[a].label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                  {!t.session.items.length && <li className="py-2 text-sm text-stone-500">No confirmed orders yet.</li>}
                </ul>
                <p className="mt-2 flex justify-between text-sm font-semibold">
                  <span>Total (served)</span>
                  <span>{baht(t.session.total)}</span>
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <button onClick={() => markPaid(t.session!.id)} className="rounded bg-emerald-600 py-1.5 text-white">
                    Mark paid
                  </button>
                  <button
                    onClick={() => window.open(`/console/bills/${t.session!.id}/print?print=1`, "_blank")}
                    className="rounded border py-1.5"
                  >
                    Print bill
                  </button>
                  <button onClick={() => clear(t.session!.id, t.tableNumber)} className="rounded border border-red-300 py-1.5 text-red-700">
                    Clear table
                  </button>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
