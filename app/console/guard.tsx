import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, requireStaffToken, type Staff, type StaffBranch } from "@/lib/auth";
import { AppError } from "@/lib/service";

// Page-side use of the one guard (design D6): 401 -> login with return path, 403 -> no-access page.
export async function staffForPage(next: string): Promise<Staff>;
export async function staffForPage(next: string, branchCode: string): Promise<(Staff & { branch: StaffBranch }) | "forbidden">;
export async function staffForPage(next: string, branchCode?: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return branchCode === undefined ? await requireStaffToken(token) : await requireStaffToken(token, branchCode);
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
    if (e instanceof AppError && e.status === 403) return "forbidden";
    throw e;
  }
}

export function NoBranchAccess({ branchCode }: { branchCode: string }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">No access to this branch</h1>
      <p className="mt-2 text-stone-500">Your account does not belong to branch {branchCode}.</p>
      <Link href="/console" className="mt-4 inline-block underline">
        Go to your console
      </Link>
    </main>
  );
}
