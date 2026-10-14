import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TableApp } from "@/components/table-app";
import { getMenu, getTable } from "@/lib/service";

export default function Page({ params }: PageProps<"/b/[branch]/t/[table]">) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-stone-500">Loading menu…</p>}>
      <TablePage params={params} />
    </Suspense>
  );
}

async function TablePage({ params }: Pick<PageProps<"/b/[branch]/t/[table]">, "params">) {
  await connection();
  const p = await params;
  const n = Number(p.table);
  const table = Number.isInteger(n) && n > 0 ? await getTable(p.branch, n) : null;
  if (!table) notFound();
  return <TableApp branchCode={table.branchCode} branchName={table.branchName} tableNumber={table.number} menu={await getMenu()} />;
}
