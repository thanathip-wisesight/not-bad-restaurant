import Link from "next/link";
import { BRANCHES } from "@/scripts/menu-data";

// Demo index: stands in for the printed table QR codes of every branch.
export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">Not Bad Restaurant (demo)</h1>
      {BRANCHES.map((b) => (
        <section key={b.code} className="mt-5">
          <h2 className="text-sm font-semibold text-stone-500">
            {b.name} <span className="font-mono">({b.code})</span> table QR links
          </h2>
          <ul className="mt-2 grid grid-cols-5 gap-2">
            {Array.from({ length: b.tables }, (_, i) => i + 1).map((n) => (
              <li key={n}>
                <Link href={`/b/${b.code}/t/${n}`} className="block rounded border p-2 text-center">
                  {n}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href="/console" className="mt-6 block rounded bg-stone-800 p-3 text-center text-white">
        Restaurant console (staff login)
      </Link>
    </main>
  );
}
