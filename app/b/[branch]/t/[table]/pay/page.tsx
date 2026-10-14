import { Suspense } from "react";
import { BankPicker } from "./bank-picker";

export default function Page({ params, searchParams }: PageProps<"/b/[branch]/t/[table]/pay">) {
  return (
    <Suspense fallback={null}>
      <Pay params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Pay({ params, searchParams }: Pick<PageProps<"/b/[branch]/t/[table]/pay">, "params" | "searchParams">) {
  const { branch, table } = await params;
  const { force } = await searchParams;
  return <BankPicker branchCode={branch} tableNumber={Number(table)} force={force === "1"} />;
}
