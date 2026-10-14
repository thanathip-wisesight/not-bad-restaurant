import { requireStaff } from "@/lib/auth";
import { isAction } from "@/lib/domain";
import { bodyOf, intParam, json } from "@/lib/http";
import { AppError, transitionItem } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; itemId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    const { branch } = await requireStaff(req, p.branch);
    const { action } = await bodyOf(req);
    if (!isAction(action)) throw new AppError(400, "invalid_action", "Unknown action");
    return transitionItem(intParam(p.itemId), action, "staff", { branchId: branch.id });
  });
}
