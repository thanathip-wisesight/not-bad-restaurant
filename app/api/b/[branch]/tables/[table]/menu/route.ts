import { intParam, json } from "@/lib/http";
import { AppError, getMenu, getTable } from "@/lib/service";

type Ctx = { params: Promise<{ branch: string; table: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return json(async () => {
    const p = await params;
    const table = await getTable(p.branch, intParam(p.table));
    if (!table) throw new AppError(404, "table_not_found", "Table not found");
    return { table: { number: table.number, branchCode: table.branchCode, branchName: table.branchName }, items: await getMenu() };
  });
}
