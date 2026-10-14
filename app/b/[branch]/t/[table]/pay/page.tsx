import { Suspense } from "react";
import { BankPicker } from "./bank-picker";

export default function Page({ params, searchParams }: PageProps<"/t/[table]/pay">) {
  return (
    <Suspense fallback={null}>
      <Pay params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Pay({ params, searchParams }: Pick<PageProps<"/t/[table]/pay">, "params" | "searchParams">) {
  const { table } = await params;
  const { force } = await searchParams;
  return <BankPicker tableNumber={Number(table)} force={force === "1"} />;
}
