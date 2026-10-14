import Link from "next/link";
import { Suspense } from "react";
import { baht, formatTime } from "@/lib/format";
import { billHistory } from "@/lib/service";
import { NoBranchAccess, staffForPage } from "../../guard";

export const metadata = { title: "Bill history · Not Bad Restaurant" };

export default function HistoryPage({ params }: PageProps<"/console/[branch]/history">) {
  return (
    <Suspense fallback={<p className="p-6 text-stone-500">Loading…</p>}>
      <Bills params={params} />
    </Suspense>
  );
}

// Closed bills of the selected branch only (restaurant-console spec, Bill history).
async function Bills({ params }: Pick<PageProps<"/console/[branch]/history">, "params">) {
  const { branch: code } = await params;
  const staff = await staffForPage(`/console/${code}/history`, code);
  if (staff === "forbidden") return <NoBranchAccess branchCode={code} />;
  const bills = await billHistory(staff.branch.id);
  return (
    <main className="mx-auto max-w-3xl p-4 xl:max-w-none xl:px-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bill history · {staff.branch.name}</h1>
        <Link href={`/console/${code}`} className="text-sm underline">
          Back to console
        </Link>
      </header>
      {bills.length ? <BillTable bills={bills} branchCode={code} /> : <p className="mt-6 text-stone-500">No closed bills yet.</p>}
    </main>
  );
}

function BillTable({ bills, branchCode }: { bills: Awaited<ReturnType<typeof billHistory>>; branchCode: string }) {
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
              <Link href={`/console/${branchCode}/bills/${b.id}/print`} className="underline">
                Open / print
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
