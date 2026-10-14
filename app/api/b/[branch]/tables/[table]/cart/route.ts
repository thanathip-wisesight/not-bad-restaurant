import { bodyOf, deviceIdOf, intParam, json } from "@/lib/http";
import { addCartLine, listCart, parseCartInput } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; table: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return listCart(p.branch, intParam(p.table), deviceIdOf(req));
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return addCartLine(p.branch, intParam(p.table), deviceIdOf(req), parseCartInput(await bodyOf(req)));
  });
}
