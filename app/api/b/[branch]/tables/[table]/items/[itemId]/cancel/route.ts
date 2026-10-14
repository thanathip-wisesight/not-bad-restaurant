import { deviceIdOf, intParam, json } from "@/lib/http";
import { transitionItems } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; table: string; itemId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return transitionItems(
      [intParam(p.itemId)],
      "request_cancel",
      { kind: "customer", deviceId: deviceIdOf(req) },
      { table: { branchCode: p.branch, tableNo: intParam(p.table) } },
    );
  });
}
