import { bodyOf, intParam, json } from "@/lib/http";
import { markPaid } from "@/lib/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => markPaid(intParam((await params).id), (await bodyOf(req)).force === true));
}
