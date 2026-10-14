import { intParam, json } from "@/lib/http";
import { transitionItem } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; table: string; itemId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    return transitionItem(intParam(p.itemId), "request_cancel", "customer", {
      table: { branchCode: p.branch, tableNo: intParam(p.table) },
    });
  });
}
