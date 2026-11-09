// Login, passwords and sessions.
// Passwords: scrypt$<salt hex>$<hash hex> (N=16384, r=8, p=1, 64 bytes), same format as the seed data.
// Session: a signed JWT in an httpOnly cookie + a session:{sid} hash in Redis (deleted on logout).
import { SignJWT, jwtVerify } from "jose";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redis } from "./redis";
import type { Role } from "./db";

export type { Role };
export type SessionUser = { id: number; role: Role; name: string; sid: string };

export const COOKIE = "session";
export const HOME: Record<Role, string> = { customer: "/", owner: "/owner", partner: "/partner", admin: "/admin" };

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, saltHex, hashHex] = stored.split("$");
  const ref = Buffer.from(hashHex, "hex");
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), ref.length || 64, { N: 16384, r: 8, p: 1 });
  return ref.length === hash.length && timingSafeEqual(hash, ref);
}

export async function signToken(u: SessionUser): Promise<string> {
  return new SignJWT({ role: u.role, name: u.name, sid: u.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(u.id))
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

export async function readToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: Number(payload.sub), role: payload.role as Role, name: String(payload.name || ""), sid: String(payload.sid || "") };
  } catch {
    return null;
  }
}

/** Starts a session: Redis hash + cookie. */
export async function startSession(id: number, role: Role, name: string) {
  const sid = randomBytes(16).toString("hex");
  try {
    const r = redis();
    await r.hset(`session:${sid}`, "user_id", String(id), "role", role, "name", name, "login_at", new Date().toISOString());
    await r.expire(`session:${sid}`, 86400);
  } catch (e: any) {
    console.warn("[session] redis unavailable:", e?.message);
  }
  const token = await signToken({ id, role, name, sid });
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
  return sid;
}

export async function endSession(u: SessionUser | null) {
  if (u?.sid) {
    try { await redis().del(`session:${u.sid}`); } catch {}
  }
  cookies().set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/** The logged-in user, or null. The Redis session must still exist (logout kills it). */
export async function getUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const u = await readToken(token);
  if (!u) return null;
  try {
    const r = redis();
    const alive = await r.exists(`session:${u.sid}`);
    if (!alive) return null;
    await r.expire(`session:${u.sid}`, 86400); // sliding session
  } catch {
    // Redis down: fall back to the signed cookie alone
  }
  return u;
}
