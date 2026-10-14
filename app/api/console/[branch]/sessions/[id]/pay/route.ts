import { requireStaff } from "@/lib/auth";
import { bodyOf, intParam, json } from "@/lib/http";
import { markPaid } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    const { branch } = await requireStaff(req, p.branch);
    return markPaid(branch.id, intParam(p.id), (await bodyOf(req)).force === true);
  });
}
