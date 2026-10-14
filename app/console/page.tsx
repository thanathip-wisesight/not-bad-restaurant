import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LogoutButton } from "./logout-button";
import { staffForPage } from "./guard";

export const metadata = { title: "Console · Not Bad Restaurant" };

// One branch -> straight to it; several -> choose (console-access spec, Branch selection).
export default function ConsoleHome({ searchParams }: PageProps<"/console">) {
  return (
    <Suspense fallback={<p className="p-8 text-stone-500">Loading…</p>}>
      <BranchChooser searchParams={searchParams} />
    </Suspense>
  );
}

async function BranchChooser({ searchParams }: Pick<PageProps<"/console">, "searchParams">) {
  const staff = await staffForPage("/console");
  const { choose } = await searchParams;
  if (staff.branches.length === 1 && !choose) redirect(`/console/${staff.branches[0].code}`);
  return (
    <main className="mx-auto max-w-md p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Choose a branch</h1>
        <LogoutButton />
      </div>
      <p className="mt-1 text-sm text-stone-500">Signed in as {staff.user.displayName}</p>
      <ul className="mt-4 space-y-2">
        {staff.branches.map((b) => (
          <li key={b.code}>
            <Link href={`/console/${b.code}`} className="block rounded-lg border bg-white p-4 hover:bg-stone-50">
              <span className="font-semibold">{b.name}</span> <span className="font-mono text-sm text-stone-500">{b.code}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
