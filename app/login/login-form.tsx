"use client";

import { useState, type FormEvent } from "react";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    if (res.ok) return window.location.assign(next);
    setError((await res.json().catch(() => ({}))).message ?? "Login failed");
    setBusy(false);
  };

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-bold">Staff login</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium">
          Username
          <input name="username" autoComplete="username" required className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded border p-2" />
        </label>
        {error && (
          <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-900">
            {error}
          </p>
        )}
        <button disabled={busy} className="w-full rounded bg-stone-800 py-2 text-white disabled:opacity-50">
          Log in
        </button>
      </form>
    </main>
  );
}
