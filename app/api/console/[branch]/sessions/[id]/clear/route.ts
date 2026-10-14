import { requireStaff } from "@/lib/auth";
import { intParam, json } from "@/lib/http";
import { clearSession } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    const { branch } = await requireStaff(req, p.branch);
    return clearSession(branch.id, intParam(p.id));
  });
}
