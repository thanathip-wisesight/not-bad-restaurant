import { deviceIdOf, intParam, json } from "@/lib/http";
import { getTableOrders } from "@/lib/service";

type Ctx = { params: Promise<{ table: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return json(async () => getTableOrders(intParam((await params).table), deviceIdOf(req)));
}
