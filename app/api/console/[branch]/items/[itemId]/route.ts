import { requireStaff } from "@/lib/auth";
import { isAction } from "@/lib/domain";
import { bodyOf, intParam, json } from "@/lib/http";
import { AppError, transitionItems } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; itemId: string }> };

// Single-dish action: same rule path as a batch of one (design D4).
export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    const { branch, user } = await requireStaff(req, p.branch);
    const { action, note } = await bodyOf(req);
    if (!isAction(action)) throw new AppError(400, "invalid_action", "Unknown action");
    return transitionItems([intParam(p.itemId)], action, { kind: "staff", userId: user.id }, { branchId: branch.id }, note);
  });
}
