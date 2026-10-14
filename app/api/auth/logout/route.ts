import { deleteSession, sessionCookie, tokenFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  await deleteSession(tokenFromRequest(req));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("", 0) } });
}
