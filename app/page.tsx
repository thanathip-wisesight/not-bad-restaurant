import Link from "next/link";
import { TABLE_COUNT } from "@/scripts/menu-data";

// Demo index: stands in for the printed table QR codes.
export default function Home() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">Not Bad Restaurant (demo)</h1>
      <h2 className="mt-4 text-sm font-semibold text-stone-500">Table QR links</h2>
      <ul className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <Link href={`/t/${n}`} className="block rounded border p-2 text-center">
              {n}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/console" className="mt-6 block rounded bg-stone-800 p-3 text-center text-white">
        Restaurant console
      </Link>
    </main>
  );
}
