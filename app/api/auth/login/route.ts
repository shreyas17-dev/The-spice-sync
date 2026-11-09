import { handle, body, HttpError } from "@/lib/api";
import { one, type Role } from "@/lib/db";
import { verifyPassword, startSession, HOME } from "@/lib/auth";
import { logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

// each role logs in against its own table, through its own MySQL account
const LOOKUP: Record<Role, string> = {
  customer: "SELECT customer_id AS id, full_name, password_hash, status FROM customer WHERE email = ?",
  owner: "SELECT owner_id AS id, full_name, password_hash, status FROM restaurant_owner WHERE email = ?",
  partner: "SELECT partner_id AS id, full_name, password_hash, status FROM delivery_partner WHERE email = ?",
  admin: "SELECT admin_id AS id, full_name, password_hash, 'ACTIVE' AS status FROM admin WHERE email = ?",
};

export const POST = handle(async (req) => {
  const { role, email, password } = await body(req);
  if (!LOOKUP[role as Role]) throw new HttpError(400, "Choose who you are logging in as.");
  if (!email || !password) throw new HttpError(400, "Enter your email and password.");
  const u = await one(role as Role, LOOKUP[role as Role], [String(email).trim().toLowerCase()]);
  if (!u || !verifyPassword(String(password), u.password_hash)) throw new HttpError(401, "Wrong email or password.");
  if (u.status === "BLOCKED") throw new HttpError(403, "This account has been blocked. Please contact support.");
  await startSession(u.id, role as Role, u.full_name);
  await logActivity(role, u.id, "LOGIN", role, u.id);
  return { ok: true, role, name: u.full_name, home: HOME[role as Role], status: u.status };
});
