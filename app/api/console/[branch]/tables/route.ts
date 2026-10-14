import { connection } from "next/server";
import { json } from "@/lib/http";
import { consoleOverview } from "@/lib/service";

export async function GET() {
  await connection(); // always read live DB state (cacheComponents would otherwise try to prerender)
  return json(consoleOverview);
}
