import { bodyOf, deviceIdOf, intParam, json } from "@/lib/http";
import { parseCartInput, removeCartLine, updateCartLine } from "@/lib/service";

type Ctx = { params: Promise<{ table: string; lineId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return updateCartLine(intParam(p.table), deviceIdOf(req), intParam(p.lineId), parseCartInput(await bodyOf(req)));
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return removeCartLine(intParam(p.table), deviceIdOf(req), intParam(p.lineId));
  });
}
