import { AppError } from "./service";

// Runs a handler body and maps AppError to a JSON error response.
export async function json(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.code, message: e.message, ...e.details }, { status: e.status });
    console.error(e);
    return Response.json({ error: "internal", message: "Something went wrong" }, { status: 500 });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function deviceIdOf(req: Request): string {
  const id = req.headers.get("x-device-id") ?? "";
  if (!UUID.test(id)) throw new AppError(400, "invalid_device", "Missing or invalid device id");
  return id;
}

export function intParam(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new AppError(404, "not_found", "Not found");
  return n;
}

export async function bodyOf(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : {};
  } catch {
    return {};
  }
}
