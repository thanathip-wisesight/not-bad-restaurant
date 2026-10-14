import { bodyOf, deviceIdOf, intParam, json } from "@/lib/http";
import { addCartLine, listCart, parseCartInput } from "@/lib/service";

type Ctx = { params: Promise<{ table: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return json(async () => listCart(intParam((await params).table), deviceIdOf(req)));
}

export async function POST(req: Request, { params }: Ctx) {
  return json(async () =>
    addCartLine(intParam((await params).table), deviceIdOf(req), parseCartInput(await bodyOf(req))),
  );
}
