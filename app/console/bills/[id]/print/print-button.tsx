"use client";

import { useEffect } from "react";

// Auto-opens the print dialog when opened with ?print=1 (design D12).
export function PrintButton() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("print")) window.print();
  }, []);
  return (
    <button onClick={() => window.print()} className="rounded border px-2">
      Print
    </button>
  );
}
