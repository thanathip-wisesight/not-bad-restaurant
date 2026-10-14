import { intParam, json } from "@/lib/http";
import { AppError, getMenu, getTable } from "@/lib/service";

type Ctx = { params: Promise<{ table: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return json(async () => {
    const table = await getTable(intParam((await params).table));
    if (!table) throw new AppError(404, "table_not_found", "Table not found");
    return { table: { number: table.number }, items: await getMenu() };
  });
}

