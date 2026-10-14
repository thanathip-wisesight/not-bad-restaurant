import { requireStaff } from "@/lib/auth";
import { json } from "@/lib/http";
import { TIMELINE_LIMIT, dishTimelines, parseMenuItemId, parseRange } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string }> };

// GET ?from=&to=&menuItemId= -> dishes (newest first, capped) with their status log (order-history spec).
export async function GET(req: Request, { params }: Ctx) {
  return json(async () => {
    const { branch } = await requireStaff(req, (await params).branch);
    const q = new URL(req.url).searchParams;
    const range = parseRange(q.get("from"), q.get("to"));
    const menuItemId = parseMenuItemId(q.get("menuItemId"));
    const items = await dishTimelines(branch.id, range, menuItemId);
    return { branch: branch.code, from: range.from.toISOString(), to: range.to.toISOString(), limit: TIMELINE_LIMIT, items };
  });
}
