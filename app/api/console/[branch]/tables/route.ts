import { requireStaff } from "@/lib/auth";
import { json } from "@/lib/http";
import { consoleOverview } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return json(async () => {
    const { branch } = await requireStaff(req, (await params).branch);
    return consoleOverview(branch.id);
  });
}
