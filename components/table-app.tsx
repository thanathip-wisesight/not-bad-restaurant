"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  RESOLVED,
  STATUS_LABELS,
  paginateByCategory,
  type Category,
  type ItemStatus,
} from "@/lib/domain";
import { ApiError, api, baht, readLocal, subscribeLocal, usePolling, writeLocal } from "@/lib/client";
import type { CartLineDto, MenuItemDto, OrderItemDto } from "@/lib/service";

type Cart = { lines: CartLineDto[]; total: number };
type Orders = {
  session: { id: number; billNo: string } | null;
  items: OrderItemDto[];
  total: number;
  myCartQty: number;
  otherCartQty: number;
};
type Tab = "menu" | "cart" | "orders";
type Layout = "modern" | "traditional";
type Sheet = { item: MenuItemDto; line?: CartLineDto };

const EMOJI: Record<Category, string> = {
  main: "🍛",
  a_la_carte: "🥘",
  soup: "🍲",
  special: "🦐",
  dessert: "🥭",
  drink: "🧋",
};

export const STATUS_STYLE: Record<ItemStatus, string> = {
  pending: "bg-stone-200 text-stone-800",
  cancel_requested: "bg-amber-200 text-amber-900",
  in_progress: "bg-sky-200 text-sky-900",
  served: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-stone-100 text-stone-500 line-through",
};

export function TableApp({ tableNumber, menu }: { tableNumber: number; menu: MenuItemDto[] }) {
  const base = `/api/tables/${tableNumber}`;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("menu");
  const [cart, setCart] = useState<Cart>({ lines: [], total: 0 });
  const [orders, setOrders] = useState<Orders | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [payWarning, setPayWarning] = useState<string | null>(null);

  // Layout choice persists per device (menu-browsing spec); server render always starts Modern.
  const layout = useSyncExternalStore<Layout>(
    subscribeLocal,
    () => (readLocal("menuLayout") === "traditional" ? "traditional" : "modern"),
    () => "modern",
  );
  const paid = useSearchParams().has("paid");

  const refresh = async () => {
    try {
      const [c, o] = await Promise.all([api<Cart>(`${base}/cart`), api<Orders>(`${base}/orders`)]);
      setCart(c);
      setOrders(o);
    } catch {
      // transient network error: next poll retries
    }
  };
  usePolling(refresh);

  const switchLayout = () => {
    writeLocal("menuLayout", layout === "modern" ? "traditional" : "modern");
  };

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      await refresh();
      if (ok) setNotice({ kind: "ok", text: ok });
    } catch (e) {
      setNotice({ kind: "warn", text: e instanceof ApiError ? e.message : "Something went wrong" });
      await refresh();
    }
  };

  const confirmOrder = () =>
    run(async () => {
      await api(`${base}/confirm`, "POST");
      setTab("orders");
    }, "Order sent to the kitchen.");

  const requestCancel = (id: number) =>
    run(() => api(`${base}/items/${id}/cancel`, "POST"), "Cancel requested. Staff will come to your table to confirm.");

  // Payment gate mirrors the server (payment spec); the server re-checks on pay.
  const startPay = () => {
    setPayWarning(null);
    setNotice(null);
    if (!orders?.session) return setNotice({ kind: "warn", text: "There is nothing to pay yet." });
    if (cart.lines.length)
      return setNotice({ kind: "warn", text: "Confirm or remove the dishes in your cart before paying." });
    const unresolved = orders.items.filter((i) => !RESOLVED.includes(i.status));
    if (unresolved.length)
      return setNotice({
        kind: "warn",
        text: `${unresolved.length} dish(es) are not served or cancelled yet. Please ask staff before paying.`,
      });
    if (orders.otherCartQty)
      return setPayWarning(
        `${orders.otherCartQty} unsent dish(es) on other phones at this table will be discarded. Please sort it out at the table first.`,
      );
    router.push(`/t/${tableNumber}/pay`);
  };

  const cartCount = cart.lines.reduce((n, l) => n + l.qty, 0);
  const activeOrders = orders?.items.filter((i) => i.status !== "cancelled").length ?? 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <p className="text-xs text-stone-500">Not Bad Restaurant</p>
          <h1 className="text-lg font-bold">Table {tableNumber}</h1>
        </div>
        {tab === "menu" && (
          <button onClick={switchLayout} className="rounded-full border px-3 py-1 text-sm">
            {layout === "modern" ? "📖 Traditional" : "📱 Modern"}
          </button>
        )}
        {tab !== "menu" && orders?.session && <span className="text-sm text-stone-500">Bill {orders.session.billNo}</span>}
      </header>

      {paid && (
        <div role="status" className="mx-4 mt-3 flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>Payment successful. Thank you!</span>
          <button onClick={() => router.replace(`/t/${tableNumber}`)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`mx-4 mt-3 flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 pb-20">
        {tab === "menu" && (
          <MenuView menu={menu} layout={layout} onAdd={(item) => setSheet({ item })} />
        )}
        {tab === "cart" && (
          <CartView
            cart={cart}
            onEdit={(line) => setSheet({ item: menu.find((m) => m.id === line.menuItemId)!, line })}
            onRemove={(line) => run(() => api(`${base}/cart/${line.id}`, "DELETE"))}
            onConfirm={confirmOrder}
          />
        )}
        {tab === "orders" && (
          <OrdersView
            orders={orders}
            onCancel={requestCancel}
            onPay={startPay}
            payWarning={payWarning}
            onPayAnyway={() => router.push(`/t/${tableNumber}/pay?force=1`)}
            onDismissWarning={() => setPayWarning(null)}
          />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-md grid-cols-3 border-t bg-white">
        {(
          [
            ["menu", "Menu", 0],
            ["cart", "Cart", cartCount],
            ["orders", "Orders", activeOrders],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-3 text-sm font-medium ${tab === key ? "text-orange-600" : "text-stone-500"}`}
          >
            {label}
            {count > 0 && <span className="ml-1 rounded-full bg-orange-600 px-1.5 text-xs text-white">{count}</span>}
          </button>
        ))}
      </nav>

      {sheet && (
        <OptionsSheet
          sheet={sheet}
          onCancel={() => setSheet(null)}
          onSubmit={(input) =>
            run(async () => {
              if (sheet.line) await api(`${base}/cart/${sheet.line.id}`, "PATCH", input);
              else await api(`${base}/cart`, "POST", input);
              setSheet(null);
            }, sheet.line ? "Cart updated." : "Added to cart.")
          }
        />
      )}
    </div>
  );
}

// ---------- menu ----------

function MenuView({ menu, layout, onAdd }: { menu: MenuItemDto[]; layout: Layout; onAdd: (i: MenuItemDto) => void }) {
  const [active, setActive] = useState<Category>("main");
  const pagerRef = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => paginateByCategory(menu), [menu]);
  const present = CATEGORIES.filter((c) => menu.some((m) => m.category === c));

  const jump = (c: Category) => {
    setActive(c);
    if (layout === "modern") {
      document.getElementById(`cat-${c}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      const el = pagerRef.current;
      const index = pages.findIndex((p) => p.category === c);
      if (el && index >= 0) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    }
  };

  const onPagerScroll = () => {
    const el = pagerRef.current;
    if (!el) return;
    const page = pages[Math.round(el.scrollLeft / el.clientWidth)];
    if (page) setActive(page.category);
  };

  return (
    <>
      <div className="sticky top-[61px] z-10 flex gap-2 overflow-x-auto border-b bg-white px-4 py-2">
        {present.map((c) => (
          <button
            key={c}
            onClick={() => jump(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm ${active === c ? "bg-orange-600 text-white" : "bg-stone-100"}`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {layout === "modern" ? (
        <div className="px-4">
          {present.map((c) => (
            <section key={c} id={`cat-${c}`} className="scroll-mt-28 pt-4">
              <h2 className="mb-2 font-semibold">{CATEGORY_LABELS[c]}</h2>
              <div className="grid grid-cols-2 gap-3">
                {menu
                  .filter((m) => m.category === c)
                  .map((m) => (
                    <ItemCard key={m.id} item={m} onAdd={onAdd} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          ref={pagerRef}
          onScroll={onPagerScroll}
          className="flex snap-x snap-mandatory overflow-x-auto"
          data-testid="traditional-pager"
        >
          {pages.map((p, i) => (
            <section key={i} className="w-full shrink-0 snap-start px-2 py-3">
              <h2 className="mb-2 px-1 text-sm font-semibold">
                {CATEGORY_LABELS[p.category]}
                <span className="ml-2 font-normal text-stone-400">
                  page {i + 1}/{pages.length}
                </span>
              </h2>
              <div className="grid grid-cols-4 grid-rows-2 gap-1.5">
                {p.items.map((m) => (
                  <ItemCard key={m.id} item={m} onAdd={onAdd} compact />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function ItemCard({ item, onAdd, compact }: { item: MenuItemDto; onAdd: (i: MenuItemDto) => void; compact?: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
      <div className={`flex items-center justify-center bg-orange-50 ${compact ? "h-12 text-2xl" : "h-24 text-5xl"}`}>
        {EMOJI[item.category]}
      </div>
      <div className={`flex flex-1 flex-col ${compact ? "p-1" : "p-2"}`}>
        <p className={`font-medium leading-tight ${compact ? "text-[11px]" : "text-sm"}`}>{item.nameTh}</p>
        <p className={`leading-tight text-stone-500 ${compact ? "text-[10px]" : "text-xs"}`}>{item.nameEn}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className={`font-semibold ${compact ? "text-[11px]" : "text-sm"}`}>{baht(item.price)}</span>
          <button
            onClick={() => onAdd(item)}
            className={`rounded bg-orange-600 font-medium text-white ${compact ? "px-1.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- options sheet ----------

type CartInput = { menuItemId: number; optionIds: number[]; note: string; qty: number };

function OptionsSheet({
  sheet,
  onCancel,
  onSubmit,
}: {
  sheet: Sheet;
  onCancel: () => void;
  onSubmit: (input: CartInput) => void;
}) {
  const { item, line } = sheet;
  const [optionIds, setOptionIds] = useState<number[]>(line?.options.map((o) => o.id) ?? []);
  const [qty, setQty] = useState(line?.qty ?? 1);
  const [note, setNote] = useState(line?.note ?? "");
  const unit = item.price + item.options.filter((o) => optionIds.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0);
  const toggle = (id: number) => setOptionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={`Options for ${item.nameEn}`}
        className="w-full max-w-md rounded-t-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{item.nameTh}</h2>
        <p className="text-sm text-stone-500">
          {item.nameEn} · {baht(item.price)}
        </p>

        {item.options.length > 0 && (
          <fieldset className="mt-4">
            <legend className="mb-1 text-sm font-semibold">Extras</legend>
            {item.options.map((o) => (
              <label key={o.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={optionIds.includes(o.id)} onChange={() => toggle(o.id)} />
                  {o.name}
                </span>
                <span className="text-stone-500">{o.priceDelta ? `+${baht(o.priceDelta)}` : "free"}</span>
              </label>
            ))}
          </fieldset>
        )}

        <label className="mt-4 block text-sm font-semibold">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. no beansprout!"
            className="mt-1 w-full rounded border p-2 font-normal"
          />
        </label>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-full border">
              −
            </button>
            <span aria-label="Quantity" className="w-6 text-center">
              {qty}
            </span>
            <button aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)} className="h-8 w-8 rounded-full border">
              +
            </button>
          </div>
          <span className="font-semibold">{baht(unit * qty)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="rounded-lg border py-2">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ menuItemId: item.id, optionIds, note, qty })}
            className="rounded-lg bg-orange-600 py-2 font-medium text-white"
          >
            {line ? "Save" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- cart ----------

function CartView({
  cart,
  onEdit,
  onRemove,
  onConfirm,
}: {
  cart: Cart;
  onEdit: (l: CartLineDto) => void;
  onRemove: (l: CartLineDto) => void;
  onConfirm: () => void;
}) {
  if (!cart.lines.length) return <p className="p-8 text-center text-stone-500">Your cart is empty.</p>;
  return (
    <div className="p-4">
      <p className="mb-2 text-xs text-stone-500">Only this phone&apos;s dishes. They are not sent to the kitchen until you confirm.</p>
      <ul className="divide-y">
        {cart.lines.map((l) => (
          <li key={l.id} className="py-3">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-medium">
                  {l.qty} × {l.nameTh}
                </p>
                <p className="text-xs text-stone-500">{l.nameEn}</p>
                <OptionsAndNote options={l.options} note={l.note} />
              </div>
              <span className="font-semibold">{baht(l.lineTotal)}</span>
            </div>
            <div className="mt-1 flex gap-3 text-sm">
              <button onClick={() => onEdit(l)} className="text-orange-700 underline">
                Edit
              </button>
              <button onClick={() => onRemove(l)} className="text-stone-500 underline">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between font-semibold">
        <span>Total</span>
        <span>{baht(cart.total)}</span>
      </div>
      <button onClick={onConfirm} className="mt-4 w-full rounded-lg bg-orange-600 py-3 font-medium text-white">
        Confirm order
      </button>
    </div>
  );
}

function OptionsAndNote({ options, note }: { options: { name: string; priceDelta: number }[]; note: string }) {
  return (
    <>
      {options.length > 0 && (
        <p className="text-xs text-stone-600">
          {options.map((o) => (o.priceDelta ? `${o.name} (+${baht(o.priceDelta)})` : o.name)).join(", ")}
        </p>
      )}
      {note && <p className="text-xs italic text-stone-600">“{note}”</p>}
    </>
  );
}

// ---------- orders ----------

function OrdersView({
  orders,
  onCancel,
  onPay,
  payWarning,
  onPayAnyway,
  onDismissWarning,
}: {
  orders: Orders | null;
  onCancel: (id: number) => void;
  onPay: () => void;
  payWarning: string | null;
  onPayAnyway: () => void;
  onDismissWarning: () => void;
}) {
  if (!orders) return <p className="p-8 text-center text-stone-500">Loading…</p>;
  if (!orders.session) return <p className="p-8 text-center text-stone-500">No orders yet.</p>;
  return (
    <div className="p-4">
      <p className="text-sm text-stone-500">
        Bill number <span className="font-mono font-semibold text-stone-900">{orders.session.billNo}</span>
      </p>
      {!orders.items.length && <p className="py-6 text-center text-stone-500">Nothing sent to the kitchen yet.</p>}
      <ul className="mt-2 divide-y">
        {orders.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-2 py-3">
            <div>
              <p className="font-medium">{i.name}</p>
              <OptionsAndNote options={i.options} note={i.note} />
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${STATUS_STYLE[i.status]}`}>
                {STATUS_LABELS[i.status]}
              </span>
              {i.status === "cancel_requested" && (
                <p className="text-xs text-amber-800">Staff will come to your table to confirm.</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={i.status === "cancelled" ? "text-stone-400 line-through" : ""}>{baht(i.unitPrice)}</span>
              {i.status === "pending" && (
                <button onClick={() => onCancel(i.id)} className="text-sm text-red-700 underline">
                  Cancel
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-between font-semibold">
        <span>Total (served)</span>
        <span>{baht(orders.total)}</span>
      </div>

      {payWarning ? (
        <div role="alertdialog" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{payWarning}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onDismissWarning} className="rounded border bg-white py-2">
              Back
            </button>
            <button onClick={onPayAnyway} className="rounded bg-amber-600 py-2 font-medium text-white">
              Pay anyway
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onPay} className="mt-4 w-full rounded-lg bg-emerald-600 py-3 font-medium text-white">
          Pay
        </button>
      )}
      <p className="mt-2 text-center text-xs text-stone-500">
        Or pay at the cashier with bill number {orders.session.billNo}.
      </p>
    </div>
  );
}
