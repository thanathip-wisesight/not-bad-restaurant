import { intParam, json } from "@/lib/http";
import { clearSession } from "@/lib/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  return json(async () => clearSession(intParam((await params).id)));
}
