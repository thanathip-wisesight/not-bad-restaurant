import { deviceIdOf, intParam, json } from "@/lib/http";
import { getTableOrders } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; table: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return getTableOrders(p.branch, intParam(p.table), deviceIdOf(req));
  });
}
