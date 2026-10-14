import { isAction } from "@/lib/domain";
import { bodyOf, intParam, json } from "@/lib/http";
import { AppError, transitionItem } from "@/lib/service";

type Ctx = { params: Promise<{ itemId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  return json(async () => {
    const { action } = await bodyOf(req);
    if (!isAction(action)) throw new AppError(400, "invalid_action", "Unknown action");
    return transitionItem(intParam((await params).itemId), action, "staff");
  });
}
