import { Suspense } from "react";
import { ConsoleBoard } from "../console-board";
import { NoBranchAccess, staffForPage } from "../guard";

export const metadata = { title: "Console · Not Bad Restaurant" };

export default function BranchConsole({ params }: PageProps<"/console/[branch]">) {
  return (
    <Suspense fallback={<p className="p-8 text-stone-500">Loading…</p>}>
      <Guarded params={params} />
    </Suspense>
  );
}

async function Guarded({ params }: Pick<PageProps<"/console/[branch]">, "params">) {
  const { branch: code } = await params;
  const staff = await staffForPage(`/console/${code}`, code);
  if (staff === "forbidden") return <NoBranchAccess branchCode={code} />;
  return (
    <ConsoleBoard
      branchCode={staff.branch.code}
      branchName={staff.branch.name}
      staffName={staff.user.displayName}
      canSwitch={staff.branches.length > 1}
    />
  );
}
