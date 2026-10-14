import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CHARGED } from "@/lib/domain";
import { baht, formatTime } from "@/lib/format";
import { getBill } from "@/lib/service";
import { NoBranchAccess, staffForPage } from "../../../../guard";
import { PrintButton } from "./print-button";

export const metadata = { title: "Receipt · Not Bad Restaurant" };

export default function PrintPage({ params }: PageProps<"/console/[branch]/bills/[id]/print">) {
  return (
    <Suspense fallback={null}>
      <Receipt params={params} />
    </Suspense>
  );
}

async function Receipt({ params }: Pick<PageProps<"/console/[branch]/bills/[id]/print">, "params">) {
  const p = await params;
  const staff = await staffForPage(`/console/${p.branch}/bills/${p.id}/print`, p.branch);
  if (staff === "forbidden") return <NoBranchAccess branchCode={p.branch} />;
  const id = Number(p.id);
  // A Bill of another branch is "not found" (D7).
  const bill = Number.isInteger(id) && id > 0 ? await getBill(staff.branch.id, id) : null;
  if (!bill) notFound();
  // Charged dishes: served while open, finished once the Bill closed (restaurant-console spec, Print receipt).
  const served = bill.items.filter((i) => CHARGED.includes(i.status));
  const status = bill.status === "open" ? "UNPAID" : bill.status.toUpperCase();

  return (
    <main className="mx-auto max-w-xs bg-white p-4 font-mono text-sm text-black">
      <div className="mb-4 flex justify-between print:hidden">
        <Link href={`/console/${p.branch}`} className="underline">
          Console
        </Link>
        <PrintButton />
      </div>
      <h1 className="text-center text-base font-bold">Not Bad Restaurant</h1>
      <p className="text-center">{bill.branchName}</p>
      <p className="text-center">RECEIPT</p>
      <hr className="my-2 border-dashed border-black" />
      <p>Bill: {bill.billNo}</p>
      <p>Table: {bill.tableNumber}</p>
      <p>Opened: {formatTime(bill.openedAt)}</p>
      {bill.closedAt && <p>Closed: {formatTime(bill.closedAt)}</p>}
      <hr className="my-2 border-dashed border-black" />
      {served.length === 0 && <p>(no served items)</p>}
      {served.map((i) => (
        <div key={i.id} className="mb-1">
          <div className="flex justify-between gap-2">
            <span>{i.name}</span>
            <span>{baht(i.unitPrice)}</span>
          </div>
          {i.options.map((o) => (
            <p key={o.name} className="pl-2 text-xs">
              + {o.name}
              {o.priceDelta ? ` ${baht(o.priceDelta)}` : ""}
            </p>
          ))}
        </div>
      ))}
      <hr className="my-2 border-dashed border-black" />
      <p className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{baht(bill.total)}</span>
      </p>
      <p className="mt-2 text-center font-bold">{status}</p>
      <p className="mt-4 text-center text-xs">This receipt is not a tax invoice.</p>
    </main>
  );
}
