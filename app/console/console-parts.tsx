"use client";

// Shared console pieces (console-desktop-layout D6): one place for data, actions and their rules.
// Phase 3 adds batch actions, the reason/remark dialog, and same-table/same-status selection (design D8).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_STYLE } from "@/components/table-app";
import { ACTIONS, REASON_MIN, STATUS_LABELS, actionsFor, type Action, type ItemStatus } from "@/lib/domain";
import { ApiError, api, baht, usePolling } from "@/lib/client";
import type { ConsoleTableDto } from "@/lib/service";

export type OpenTable = ConsoleTableDto & { session: NonNullable<ConsoleTableDto["session"]> };
export type ConsoleItem = OpenTable["session"]["items"][number];

export type ConsoleHandlers = {
  // Runs an action on dishes of one table; asks for a reason/remark first when the action takes one.
  request: (ids: number[], action: Action, label: string) => void;
  markPaid: (sessionId: number) => void;
  clear: (sessionId: number, tableNumber: number) => void;
  print: (sessionId: number) => void;
};

type NotePrompt = { ids: number[]; action: Action; label: string };

export function useConsoleData(branchCode: string) {
  const base = `/api/console/${branchCode}`;
  const router = useRouter();
  const [tables, setTables] = useState<ConsoleTableDto[] | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<NotePrompt | null>(null);

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
    let ok = true;
    try {
      await fn();
    } catch (e) {
      ok = false;
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    }
    await refresh();
    return ok;
  };

  // Single and batch actions share one endpoint and one rule path (design D4).
  const send = (ids: number[], action: Action, note?: string) =>
    run(() => api(`${base}/items/batch`, "POST", { ids, action, note }));

  const handlers: ConsoleHandlers = {
    request: (ids, action, label) => {
      if (ACTIONS[action].reason === "none") void send(ids, action);
      else setPrompt({ ids, action, label });
    },
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

  const dialog = prompt && (
    <NoteDialog
      prompt={prompt}
      onCancel={() => setPrompt(null)}
      onSubmit={async (note) => {
        if (await send(prompt.ids, prompt.action, note)) setPrompt(null);
      }}
    />
  );

  return { tables, now, error, handlers, dialog, lastActionOk: error === null };
}

// Reason (required for Void) or remark (optional for cancel decisions) for one or many dishes.
function NoteDialog({
  prompt,
  onCancel,
  onSubmit,
}: {
  prompt: NotePrompt;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const required = ACTIONS[prompt.action].reason === "required";
  const valid = !required || note.trim().length >= REASON_MIN;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-label={prompt.label}
        className="w-full max-w-sm rounded-xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(note);
        }}
      >
        <h2 className="font-semibold">{prompt.label}</h2>
        <p className="text-sm text-stone-500">
          {prompt.ids.length} dish{prompt.ids.length === 1 ? "" : "es"}
        </p>
        <label className="mt-3 block text-sm font-medium">
          {required ? `Reason (required, at least ${REASON_MIN} characters)` : "Remark (optional)"}
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded border p-2 font-normal"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="rounded border py-2">
            Back
          </button>
          <button type="submit" disabled={!valid} className="rounded bg-stone-800 py-2 text-white disabled:opacity-40">
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------- selection: one table, one status (restaurant-console spec, Batch selection) ----------

export type Selection = { tableNumber: number; status: ItemStatus; ids: number[] } | null;

export function useSelection(tables: ConsoleTableDto[] | null) {
  const [raw, setRaw] = useState<Selection>(null);
  // Drop dishes that left the selected status or table since selection (derived, no effect needed).
  const current = new Map<number, { tableNumber: number; status: ItemStatus }>();
  for (const t of tables ?? []) for (const i of t.session?.items ?? []) current.set(i.id, { tableNumber: t.tableNumber, status: i.status });
  const ids = raw ? raw.ids.filter((id) => current.get(id)?.status === raw.status && current.get(id)?.tableNumber === raw.tableNumber) : [];
  const selection: Selection = raw && ids.length ? { ...raw, ids } : null;

  const canSelect = (tableNumber: number, item: { status: ItemStatus }) =>
    actionsFor(item.status, "staff").length > 0 &&
    (!selection || (selection.tableNumber === tableNumber && selection.status === item.status));
  const toggle = (tableNumber: number, item: { id: number; status: ItemStatus }) => {
    if (!canSelect(tableNumber, item)) return;
    if (!selection) return setRaw({ tableNumber, status: item.status, ids: [item.id] });
    const next = selection.ids.includes(item.id) ? selection.ids.filter((x) => x !== item.id) : [...selection.ids, item.id];
    setRaw(next.length ? { ...selection, ids: next } : null);
  };
  const selectAll = (tableNumber: number, status: ItemStatus) => {
    const all = [...current].filter(([, v]) => v.tableNumber === tableNumber && v.status === status).map(([id]) => id);
    if (all.length && actionsFor(status, "staff").length) setRaw({ tableNumber, status, ids: all });
  };
  const groupSize = (tableNumber: number, status: ItemStatus) =>
    [...current.values()].filter((v) => v.tableNumber === tableNumber && v.status === status).length;
  return { selection, canSelect, toggle, selectAll, groupSize, clear: () => setRaw(null), isSelected: (id: number) => ids.includes(id) };
}
export type SelectionApi = ReturnType<typeof useSelection>;

export function SelectBox({ sel, tableNumber, item }: { sel: SelectionApi; tableNumber: number; item: { id: number; name: string; status: ItemStatus } }) {
  return (
    <input
      type="checkbox"
      aria-label={`Select ${item.name} (table ${tableNumber})`}
      checked={sel.isSelected(item.id)}
      disabled={!sel.canSelect(tableNumber, item)}
      onChange={() => sel.toggle(tableNumber, item)}
      className="h-4 w-4 shrink-0 disabled:opacity-30"
    />
  );
}

// Sticky bar: what is selected, select all of that group, and the actions valid for its status.
export function BatchBar({ sel, handlers }: { sel: SelectionApi; handlers: ConsoleHandlers }) {
  const s = sel.selection;
  if (!s) return null;
  const total = sel.groupSize(s.tableNumber, s.status);
  return (
    <div role="toolbar" aria-label="Selected dishes" className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 p-3 shadow-lg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">
          {s.ids.length} selected · Table {s.tableNumber} · {STATUS_LABELS[s.status]}
        </span>
        {s.ids.length < total && (
          <button onClick={() => sel.selectAll(s.tableNumber, s.status)} className="rounded border px-2 py-1">
            Select all {total}
          </button>
        )}
        <span className="flex-1" />
        {actionsFor(s.status, "staff").map((a) => (
          <button
            key={a}
            onClick={() => handlers.request(s.ids, a, `${ACTIONS[a].label} ${s.ids.length} dish${s.ids.length === 1 ? "" : "es"}`)}
            className="rounded bg-stone-800 px-3 py-1 text-white"
          >
            {ACTIONS[a].label}
          </button>
        ))}
        <button onClick={sel.clear} className="rounded border px-2 py-1">
          Clear selection
        </button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  return <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function ItemActions({ item, handlers }: { item: { id: number; status: ItemStatus; name: string }; handlers: ConsoleHandlers }) {
  return (
    <>
      {actionsFor(item.status, "staff").map((a) => (
        <button
          key={a}
          onClick={() => handlers.request([item.id], a, `${ACTIONS[a].label}: ${item.name}`)}
          className="rounded border bg-white px-2 py-0.5 text-xs hover:bg-stone-100"
        >
          {ACTIONS[a].label}
        </button>
      ))}
    </>
  );
}

export function OptionsAndNote({ item }: { item: Pick<ConsoleItem, "options" | "note"> }) {
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

// Every dish of one open bill with selection, actions, and staff reasons; then the bill actions.
// Used by phone cards and the drawer.
export function TableDetail({ table, handlers, sel }: { table: OpenTable; handlers: ConsoleHandlers; sel: SelectionApi }) {
  const s = table.session;
  const groups = [...new Set(s.items.map((i) => i.status))].filter((st) => actionsFor(st, "staff").length && sel.groupSize(table.tableNumber, st) > 1);
  return (
    <>
      {s.unsentCartQty > 0 && <p className="text-xs text-stone-500">{s.unsentCartQty} dish(es) in customer carts (not sent)</p>}
      {groups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {groups.map((st) => (
            <button
              key={st}
              onClick={() => sel.selectAll(table.tableNumber, st)}
              disabled={!!sel.selection && (sel.selection.tableNumber !== table.tableNumber || sel.selection.status !== st)}
              className="rounded border px-2 py-0.5 text-xs disabled:opacity-30"
            >
              Select all {STATUS_LABELS[st]} ({sel.groupSize(table.tableNumber, st)})
            </button>
          ))}
        </div>
      )}
      <ul className="mt-2 divide-y">
        {s.items.map((i) => (
          <li key={i.id} className={`flex gap-2 py-2 ${i.status === "cancel_requested" ? "-mx-3 bg-amber-100 px-3" : ""}`}>
            <SelectBox sel={sel} tableNumber={table.tableNumber} item={i} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-medium">{i.name}</span>
                <span className={i.status === "cancelled" || i.status === "voided" ? "text-stone-400 line-through" : ""}>
                  {baht(i.unitPrice)}
                </span>
              </div>
              <OptionsAndNote item={i} />
              {i.staffNote && (
                <p className="text-xs text-rose-800">
                  {i.status === "voided" ? "Reason" : "Remark"}: {i.staffNote}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <StatusBadge status={i.status} />
                <ItemActions item={i} handlers={handlers} />
              </div>
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
