import { deviceIdOf, intParam, json } from "@/lib/http";
import { confirmCart } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; table: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return confirmCart(p.branch, intParam(p.table), deviceIdOf(req));
  });
}
