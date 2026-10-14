"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/client";

// Simulated bank apps only (design D11): no real payment system is contacted.
const BANKS = ["K PLUS (simulated)", "SCB EASY (simulated)", "Krungthai NEXT (simulated)", "Bangkok Bank (simulated)"];

export function BankPicker({ branchCode, tableNumber, force }: { branchCode: string; tableNumber: number; force: boolean }) {
  const page = `/b/${branchCode}/t/${tableNumber}`;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/b/${branchCode}/tables/${tableNumber}/pay`, "POST", { force });
      router.replace(`${page}?paid=1`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Payment failed");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-lg font-bold">Pay with QR · Table {tableNumber}</h1>
      <p className="mt-1 text-sm text-stone-500">Choose your banking app. This demo simulates the payment.</p>
      <ul className="mt-4 space-y-2">
        {BANKS.map((b) => (
          <li key={b}>
            <button disabled={busy} onClick={pay} className="w-full rounded-lg border p-3 text-left disabled:opacity-50">
              {b}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      <Link href={page} className="mt-6 block text-center text-sm underline">
        Back to menu
      </Link>
    </main>
  );
}
