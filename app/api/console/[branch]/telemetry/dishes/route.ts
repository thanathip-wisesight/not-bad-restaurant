import { requireStaff } from "@/lib/auth";
import { json } from "@/lib/http";
import { dishCounts, parseRange } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string }> };

// GET ?from=&to= -> per menu item: ordered, finished, cancelled, voided (order-history spec).
export async function GET(req: Request, { params }: Ctx) {
  return json(async () => {
    const { branch } = await requireStaff(req, (await params).branch);
    const q = new URL(req.url).searchParams;
    const range = parseRange(q.get("from"), q.get("to"));
    return { branch: branch.code, from: range.from.toISOString(), to: range.to.toISOString(), dishes: await dishCounts(branch.id, range) };
  });
}
