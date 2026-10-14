import { checkCredentials, createSession, sessionCookie, staffFromToken } from "@/lib/auth";
import { bodyOf } from "@/lib/http";

export async function POST(req: Request) {
  const { username, password } = await bodyOf(req);
  const user =
    typeof username === "string" && typeof password === "string" ? await checkCredentials(username, password) : null;
  // Same message whichever part was wrong (console-access spec).
  if (!user) return Response.json({ error: "invalid_credentials", message: "Invalid username or password" }, { status: 401 });
  const token = await createSession(user.id);
  const staff = await staffFromToken(token);
  return Response.json(
    { ok: true, branches: staff?.branches.map((b) => b.code) ?? [] },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
}
