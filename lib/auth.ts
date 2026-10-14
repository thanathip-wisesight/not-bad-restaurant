// Staff sessions and branch authorization (console-access spec, design D5–D6).
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { branches, staffSessions, userBranches, users } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";
import { AppError } from "./service";

export const SESSION_COOKIE = "staff_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// Sliding window without a DB write per request: extend only once an hour has been used.
const EXTEND_BELOW_MS = 23 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const shouldExtend = (expiresAt: Date, now: number) => expiresAt.getTime() - now < EXTEND_BELOW_MS;

let dummyHash: Promise<string> | undefined;

// Unknown usernames still pay for one scrypt, so timing does not reveal which part was wrong.
export async function checkCredentials(username: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  const ok = await verifyPassword(password, user?.passwordHash ?? (await (dummyHash ??= hashPassword("unused-dummy"))));
  return user && ok ? user : null;
}

export async function createSession(userId: number, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(staffSessions).values({ tokenHash: hashToken(token), userId, expiresAt: new Date(now + SESSION_TTL_MS) });
  return token;
}

export async function deleteSession(token: string | undefined) {
  if (token) await db.delete(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
}

export type StaffBranch = { id: number; code: string; name: string };

export async function staffFromToken(token: string | undefined, now = Date.now()) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ expiresAt: staffSessions.expiresAt, user: { id: users.id, username: users.username, displayName: users.displayName } })
    .from(staffSessions)
    .innerJoin(users, eq(users.id, staffSessions.userId))
    .where(and(eq(staffSessions.tokenHash, tokenHash), gt(staffSessions.expiresAt, new Date(now))));
  if (!row) return null;
  if (shouldExtend(row.expiresAt, now))
    await db.update(staffSessions).set({ expiresAt: new Date(now + SESSION_TTL_MS) }).where(eq(staffSessions.tokenHash, tokenHash));
  const memberOf: StaffBranch[] = await db
    .select({ id: branches.id, code: branches.code, name: branches.name })
    .from(userBranches)
    .innerJoin(branches, eq(branches.id, userBranches.branchId))
    .where(eq(userBranches.userId, row.user.id))
    .orderBy(asc(branches.code));
  return { user: row.user, branches: memberOf };
}
export type Staff = NonNullable<Awaited<ReturnType<typeof staffFromToken>>>;

// The one guard (D6): 401 without a valid session, 403 for a branch the user does not belong to.
export async function requireStaffToken(token: string | undefined): Promise<Staff>;
export async function requireStaffToken(token: string | undefined, branchCode: string): Promise<Staff & { branch: StaffBranch }>;
export async function requireStaffToken(token: string | undefined, branchCode?: string) {
  const staff = await staffFromToken(token);
  if (!staff) throw new AppError(401, "unauthenticated", "Please log in.");
  if (branchCode === undefined) return staff;
  const branch = staff.branches.find((b) => b.code === branchCode);
  if (!branch) throw new AppError(403, "forbidden_branch", "You do not have access to this branch.");
  return { ...staff, branch };
}

export function tokenFromRequest(req: Request): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=");
  }
}

export const requireStaff = (req: Request, branchCode: string) => requireStaffToken(tokenFromRequest(req), branchCode);

// The server enforces the 24 h inactivity limit; the cookie just outlives it.
export function sessionCookie(token: string, maxAgeSeconds = 30 * 24 * 60 * 60) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}
