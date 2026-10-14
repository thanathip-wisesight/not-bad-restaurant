import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { baht, formatTime } from "@/lib/format";
import { billHistory } from "@/lib/service";

export const metadata = { title: "Bill history · Not Bad Restaurant" };

export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 xl:max-w-none xl:px-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bill history</h1>
        <Link href="/console" className="text-sm underline">
          Back to console
        </Link>
      </header>
      <Suspense fallback={<p className="mt-6 text-stone-500">Loading…</p>}>
        <Bills />
      </Suspense>
    </main>
  );
}

async function Bills() {
  await connection();
  const bills = await billHistory();
  if (!bills.length) return <p className="mt-6 text-stone-500">No closed bills yet.</p>;
  return (
    <table className="mt-4 w-full text-sm">
      <thead>
        <tr className="border-b text-left text-stone-500">
          <th className="py-2">Bill</th>
          <th>Table</th>
          <th>Closed</th>
          <th className="text-right">Total</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {bills.map((b) => (
          <tr key={b.id} className="border-b">
            <td className="py-2 font-mono">{b.billNo}</td>
            <td>{b.tableNumber}</td>
            <td>{b.closedAt ? formatTime(b.closedAt) : "-"}</td>
            <td className="text-right">{baht(b.total)}</td>
            <td className={b.status === "voided" ? "text-red-700" : "text-emerald-700"}>{b.status}</td>
            <td className="text-right">
              <Link href={`/console/bills/${b.id}/print`} className="underline">
                Open / print
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
