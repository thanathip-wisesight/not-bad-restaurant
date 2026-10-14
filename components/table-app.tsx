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
import { ApiError, api, baht, readLocal, subscribeLocal, useLandscape, usePolling, writeLocal } from "@/lib/client";
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

export function TableApp({
  branchCode,
  branchName,
  tableNumber,
  menu,
}: {
  branchCode: string;
  branchName: string;
  tableNumber: number;
  menu: MenuItemDto[];
}) {
  const base = `/api/b/${branchCode}/tables/${tableNumber}`;
  const page = `/b/${branchCode}/t/${tableNumber}`;
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
  // Traditional renders only in landscape; upright phones fall back to Modern (menu-browsing spec, D15).
  const landscape = useLandscape();
  const traditional = layout === "traditional" && landscape;

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
    router.push(`${page}/pay`);
  };

  const cartCount = cart.lines.reduce((n, l) => n + l.qty, 0);
  const activeOrders = orders?.items.filter((i) => i.status !== "cancelled").length ?? 0;

  const banners = (
    <>
      {paid && (
        <div role="status" className="mx-4 mt-3 flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 shadow">
          <span>Payment successful. Thank you!</span>
          <button onClick={() => router.replace(page)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className={`mx-4 mt-3 flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm shadow ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}
    </>
  );

  const cartView = (
    <CartView
      cart={cart}
      onEdit={(line) => setSheet({ item: menu.find((m) => m.id === line.menuItemId)!, line })}
      onRemove={(line) => run(() => api(`${base}/cart/${line.id}`, "DELETE"))}
      onConfirm={confirmOrder}
    />
  );
  const ordersView = (
    <OrdersView
      orders={orders}
      onCancel={requestCancel}
      onPay={startPay}
      payWarning={payWarning}
      onPayAnyway={() => router.push(`${page}/pay?force=1`)}
      onDismissWarning={() => setPayWarning(null)}
    />
  );
  const optionsSheet = sheet && (
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
  );

  if (traditional)
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-white">
        <TraditionalMenu
          menu={menu}
          tableNumber={tableNumber}
          branchName={branchName}
          cartCount={cartCount}
          orderCount={activeOrders}
          onOpen={setTab}
          onModern={switchLayout}
          onAdd={(item) => setSheet({ item })}
        />
        <div className="pointer-events-none fixed inset-x-0 top-10 z-40 mx-auto max-w-md [&>*]:pointer-events-auto">{banners}</div>
        {tab !== "menu" && (
          // Overlay above the pager: the pager stays mounted, so closing returns to the same page.
          <div className="fixed inset-0 z-30 flex justify-center bg-black/40 p-2" onClick={() => setTab("menu")}>
            <div
              role="dialog"
              aria-label={tab === "cart" ? "Cart" : "Orders"}
              className="h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-2">
                <h2 className="font-semibold">{tab === "cart" ? "Cart" : "Orders"}</h2>
                <button onClick={() => setTab("menu")} aria-label="Close">
                  ✕
                </button>
              </div>
              {tab === "cart" ? cartView : ordersView}
            </div>
          </div>
        )}
        {optionsSheet}
      </div>
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <p className="text-xs text-stone-500">{branchName}</p>
          <h1 className="text-lg font-bold">Table {tableNumber}</h1>
        </div>
        {tab === "menu" && (
          <button onClick={switchLayout} className="rounded-full border px-3 py-1 text-sm">
            {layout === "modern" ? "📖 Traditional" : "📱 Modern"}
          </button>
        )}
        {tab !== "menu" && orders?.session && <span className="text-sm text-stone-500">Bill {orders.session.billNo}</span>}
      </header>

      {banners}
      {tab === "menu" && layout === "traditional" && (
        <p role="note" className="mx-4 mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">
          ↻ Turn your phone sideways to see the Traditional menu.
        </p>
      )}

      <main className="flex-1 pb-20">
        {tab === "menu" && <MenuView menu={menu} onAdd={(item) => setSheet({ item })} />}
        {tab === "cart" && cartView}
        {tab === "orders" && ordersView}
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

      {optionsSheet}
    </div>
  );
}

// ---------- menu ----------

function MenuView({ menu, onAdd }: { menu: MenuItemDto[]; onAdd: (i: MenuItemDto) => void }) {
  const [active, setActive] = useState<Category>("main");
  const present = CATEGORIES.filter((c) => menu.some((m) => m.category === c));

  const jump = (c: Category) => {
    setActive(c);
    document.getElementById(`cat-${c}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    </>
  );
}

// Landscape-only book-like menu: one 4x2 page per screen, compact top bar (menu-browsing spec, D15).
function TraditionalMenu({
  menu,
  tableNumber,
  branchName,
  cartCount,
  orderCount,
  onOpen,
  onModern,
  onAdd,
}: {
  menu: MenuItemDto[];
  tableNumber: number;
  branchName: string;
  cartCount: number;
  orderCount: number;
  onOpen: (tab: Tab) => void;
  onModern: () => void;
  onAdd: (i: MenuItemDto) => void;
}) {
  const pagerRef = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => paginateByCategory(menu), [menu]);
  const [page, setPage] = useState(0);
  const present = CATEGORIES.filter((c) => pages.some((p) => p.category === c));
  const active = pages[page]?.category;

  const go = (index: number) => {
    const el = pagerRef.current;
    const target = Math.max(0, Math.min(pages.length - 1, index));
    el?.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = pagerRef.current;
    if (el) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const counter = (label: string, count: number, tab: Tab) => (
    <button onClick={() => onOpen(tab)} className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium">
      {label}
      {count > 0 && <span className="ml-1 rounded-full bg-orange-600 px-1.5 text-white">{count}</span>}
    </button>
  );

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b px-2 py-1">
        <h1 className="shrink-0 text-sm font-bold">
          <span className="font-normal text-stone-500">{branchName} · </span>Table {tableNumber}
        </h1>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" data-testid="category-tabs">
          {present.map((c) => (
            <button
              key={c}
              onClick={() => go(pages.findIndex((p) => p.category === c))}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${active === c ? "bg-orange-600 text-white" : "bg-stone-100"}`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        {counter("Cart", cartCount, "cart")}
        {counter("Orders", orderCount, "orders")}
        <button onClick={onModern} className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs">
          📱 Modern
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={pagerRef} onScroll={onScroll} className="flex h-full snap-x snap-mandatory overflow-x-auto" data-testid="traditional-pager">
          {pages.map((p, i) => (
            <section
              key={i}
              aria-label={`${CATEGORY_LABELS[p.category]} page`}
              className="grid h-full w-full shrink-0 snap-start grid-cols-4 grid-rows-2 gap-1.5 px-9 py-1.5"
            >
              {p.items.map((m) => (
                <TraditionalCard key={m.id} item={m} onAdd={onAdd} />
              ))}
            </section>
          ))}
        </div>
        <button
          aria-label="Previous page"
          onClick={() => go(page - 1)}
          disabled={page === 0}
          className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-1.5 py-2 text-sm shadow disabled:opacity-30"
        >
          ◀
        </button>
        <button
          aria-label="Next page"
          onClick={() => go(page + 1)}
          disabled={page === pages.length - 1}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-1.5 py-2 text-sm shadow disabled:opacity-30"
        >
          ▶
        </button>
      </div>
      <p className="shrink-0 pb-1 text-center text-xs text-stone-500" data-testid="page-indicator">
        {active && CATEGORY_LABELS[active]} · {page + 1}/{pages.length}
      </p>
    </>
  );
}

function TraditionalCard({ item, onAdd }: { item: MenuItemDto; onAdd: (i: MenuItemDto) => void }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white">
      {/* image placeholder drops on very short screens so names and Add stay visible (D15 risk) */}
      <div className="flex min-h-0 flex-1 items-center justify-center bg-orange-50 text-3xl [@media(max-height:340px)]:hidden">
        {EMOJI[item.category]}
      </div>
      <div className="flex flex-col p-1.5">
        <p className="line-clamp-2 text-xs font-medium leading-tight">{item.nameTh}</p>
        <p className="line-clamp-2 text-[10px] leading-tight text-stone-500">{item.nameEn}</p>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-xs font-semibold">{baht(item.price)}</span>
          <button onClick={() => onAdd(item)} className="rounded bg-orange-600 px-2 text-[11px] font-medium text-white">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, onAdd }: { item: MenuItemDto; onAdd: (i: MenuItemDto) => void }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white">
      <div className="flex h-24 items-center justify-center bg-orange-50 text-5xl">{EMOJI[item.category]}</div>
      <div className="flex flex-1 flex-col p-2">
        <p className="text-sm font-medium leading-tight">{item.nameTh}</p>
        <p className="text-xs leading-tight text-stone-500">{item.nameEn}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-sm font-semibold">{baht(item.price)}</span>
          <button onClick={() => onAdd(item)} className="rounded bg-orange-600 px-2 py-0.5 text-xs font-medium text-white">
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 landscape:items-center landscape:p-2" onClick={onCancel}>
      <div
        role="dialog"
        aria-label={`Options for ${item.nameEn}`}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 landscape:rounded-2xl"
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

        <div className="sticky -bottom-4 -mx-4 mt-4 grid grid-cols-2 gap-2 bg-white px-4 py-3">
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
