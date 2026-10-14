import { deviceIdOf, intParam, json } from "@/lib/http";
import { confirmCart } from "@/lib/service";

type Ctx = { params: Promise<{ table: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => confirmCart(intParam((await params).table), deviceIdOf(req)));
}
