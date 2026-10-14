// Browser-only helpers: device identity (design D9), API calls, polling (D10).
import { useEffect, useRef, useSyncExternalStore } from "react";

function uuidv4(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID is missing on plain-http LAN URLs (insecure context); getRandomValues is not.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

// Fallback so a blocked localStorage still works for the current tab.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

export function writeLocal(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: value lives for this tab only
  }
  listeners.forEach((l) => l());
}

export function subscribeLocal(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let deviceId: string | null = null;
export function getDeviceId(): string {
  deviceId ??= readLocal("deviceId");
  if (!deviceId) {
    deviceId = uuidv4();
    writeLocal("deviceId", deviceId);
  }
  return deviceId;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; [k: string]: unknown },
  ) {
    super(body.message ?? `Request failed (${status})`);
  }
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "content-type": "application/json", "x-device-id": getDeviceId() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

// Free-tier budget (design D9): 10 s keeps every screen within the spec's 15 s refresh limit.
export const POLL_MS = 10_000;

// Calls fn now and every `ms` while the tab is visible. When `active` is false there is no
// periodic request at all; any interaction or returning to the tab calls fn once, which can
// reactivate polling (order-tracking spec, Refresh pauses without an open Bill).
export function usePolling(fn: () => void, ms = POLL_MS, active = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) ref.current();
    };
    const wake = ["pointerdown", "keydown", "focus"] as const;
    let id: ReturnType<typeof setInterval> | undefined;
    if (active) {
      tick();
      id = setInterval(tick, ms);
    } else {
      wake.forEach((e) => window.addEventListener(e, tick));
    }
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      wake.forEach((e) => window.removeEventListener(e, tick));
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms, active]);
}

// True while the screen is landscape; server snapshot is portrait (design D15).
const LANDSCAPE = "(orientation: landscape)";
export function useLandscape(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(LANDSCAPE);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => matchMedia(LANDSCAPE).matches,
    () => false,
  );
}

export { baht } from "./format";
