import { bodyOf, deviceIdOf, intParam, json } from "@/lib/http";
import { payByTable } from "@/lib/service";

type Ctx = { params: Promise<{ table: string }> };

// Stub payment (design D11): no external payment system is contacted.
export async function POST(req: Request, { params }: Ctx) {
  return json(async () =>
    payByTable(intParam((await params).table), deviceIdOf(req), (await bodyOf(req)).force === true),
  );
}
