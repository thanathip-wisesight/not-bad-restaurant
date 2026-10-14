// console-access: passwords, sessions, login/logout, and the console guard (tasks 3.1, 3.2, 4.2).
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../app/api/auth/login/route";
import { POST as logout } from "../app/api/auth/logout/route";
import { GET as consoleTables } from "../app/api/console/[branch]/tables/route";
import { db, pool } from "../db";
import { staffSessions, users } from "../db/schema";
import { seedDatabase } from "../db/seed";
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, hashToken, shouldExtend, staffFromToken } from "../lib/auth";
import { hashPassword, verifyPassword } from "../lib/password";

beforeEach(() => seedDatabase(db));
afterAll(() => pool.end());

const userId = async (username: string) => (await db.select().from(users).where(eq(users.username, username)))[0].id;
const post = (body: unknown, cookie?: string) =>
  new Request("http://x", { method: "POST", headers: cookie ? { cookie } : {}, body: JSON.stringify(body) });
const H = 60 * 60 * 1000;

describe("3.1 passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("s3cret");
    expect(stored).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
    expect(await verifyPassword("s3cret", stored)).toBe(true);
    expect(await verifyPassword("S3cret", stored)).toBe(false);
    expect(await verifyPassword("s3cret", "garbage")).toBe(false);
    expect(await hashPassword("s3cret")).not.toBe(stored); // salted
  });
});

describe("3.1 sessions: 24 h inactivity window", () => {
  it("extension rule: only once more than an hour of the window is used", () => {
    const now = Date.now();
    expect(shouldExtend(new Date(now + 23.5 * H), now)).toBe(false);
    expect(shouldExtend(new Date(now + 22 * H), now)).toBe(true);
  });

  it("expires after 24 h without activity", async () => {
    const token = await createSession(await userId("siam.staff"), Date.now() - 25 * H);
    expect(await staffFromToken(token)).toBeNull();
  });

  it("activity extends the session and stores only the token hash", async () => {
    const created = Date.now() - 2 * H;
    const token = await createSession(await userId("siam.staff"), created);
    const staff = await staffFromToken(token);
    expect(staff?.branches.map((b) => b.code)).toEqual(["SIAM"]);
    const [row] = await db.select().from(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
    expect(row.expiresAt.getTime()).toBeGreaterThan(created + SESSION_TTL_MS);
    expect(await db.select().from(staffSessions).where(eq(staffSessions.tokenHash, token))).toHaveLength(0);
  });
});

describe("3.2 login and logout", () => {
  it("correct credentials set an HttpOnly SameSite=Lax session cookie", async () => {
    const res = await login(post({ username: "area.manager", password: "manager-demo" }));
    expect(res.status).toBe(200);
    expect((await res.json()).branches).toEqual(["ASOK", "SIAM"]);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43};`));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("wrong password and unknown user get the same generic 401 and no cookie", async () => {
    for (const body of [
      { username: "siam.staff", password: "nope" },
      { username: "nobody", password: "siam-demo" },
      { username: 1 },
    ]) {
      const res = await login(post(body));
      expect(res.status).toBe(401);
      expect((await res.json()).message).toBe("Invalid username or password");
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("logout deletes the session", async () => {
    const token = await createSession(await userId("siam.staff"));
    const res = await logout(post({}, `${SESSION_COOKIE}=${token}`));
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await staffFromToken(token)).toBeNull();
  });
});

describe("4.2 console API guard", () => {
  const call = (branch: string, cookie?: string) =>
    consoleTables(new Request("http://x", { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ branch }) });

  it("401 without a session, 403 for a non-member branch, 200 for a member", async () => {
    expect((await call("SIAM")).status).toBe(401);
    expect((await call("SIAM", `${SESSION_COOKIE}=forged`)).status).toBe(401);
    const siamStaff = `${SESSION_COOKIE}=${await createSession(await userId("siam.staff"))}`;
    expect((await call("ASOK", siamStaff)).status).toBe(403);
    expect((await call("SIAM", siamStaff)).status).toBe(200);
    const manager = `${SESSION_COOKIE}=${await createSession(await userId("area.manager"))}`;
    const res = await call("ASOK", manager);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(6);
  });
});
