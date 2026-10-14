import { requireStaff } from "@/lib/auth";
import { isAction } from "@/lib/domain";
import { bodyOf, json } from "@/lib/http";
import { AppError, transitionItems } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string }> };

// Batch action on dishes of one table in one status, all-or-nothing (restaurant-console spec, D4).
export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const { branch, user } = await requireStaff(req, (await params).branch);
    const { ids, action, note } = await bodyOf(req);
    if (!isAction(action)) throw new AppError(400, "invalid_action", "Unknown action");
    if (!Array.isArray(ids)) throw new AppError(400, "invalid_input", "ids must be an array");
    return transitionItems(ids as number[], action, { kind: "staff", userId: user.id }, { branchId: branch.id }, note);
  });
}
