import { handle, body, HttpError } from "@/lib/api";
import { exec } from "@/lib/db";
import { hashPassword, startSession, HOME } from "@/lib/auth";
import { logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

const clean = (v: any) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

// Sign-up only fills the columns each role is allowed to INSERT (06_roles.sql):
// status, loyalty points, verification and approval keep their defaults.
export const POST = handle(async (req) => {
  const b = await body(req);
  const role = b.role;
  const name = clean(b.full_name), email = clean(b.email)?.toLowerCase(), phone = clean(b.phone), pw = String(b.password || "");
  if (!name || !email || !phone) throw new HttpError(400, "Name, email and phone are required.");
  if (pw.length < 8) throw new HttpError(400, "Use a password of at least 8 characters.");
  const hash = hashPassword(pw);
  let id: number;

  if (role === "customer") {
    const r = await exec("customer",
      "INSERT INTO customer (full_name, email, phone, password_hash, date_of_birth) VALUES (?, ?, ?, ?, ?)",
      [name, email, phone, hash, clean(b.date_of_birth)]);
    id = r.insertId;
  } else if (role === "owner") {
    if (!clean(b.pan_number) || !clean(b.bank_account_no)) throw new HttpError(400, "PAN and bank account are needed for payouts.");
    const r = await exec("owner",
      "INSERT INTO restaurant_owner (full_name, email, phone, password_hash, pan_number, bank_account_no) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, phone, hash, String(b.pan_number).toUpperCase().trim(), clean(b.bank_account_no)]);
    id = r.insertId;
  } else if (role === "partner") {
    const vehicle = ["BICYCLE", "SCOOTER", "MOTORBIKE"].includes(b.vehicle_type) ? b.vehicle_type : "SCOOTER";
    const r = await exec("partner",
      "INSERT INTO delivery_partner (full_name, email, phone, password_hash, vehicle_type, vehicle_number, license_no) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name, email, phone, hash, vehicle, vehicle === "BICYCLE" ? null : clean(b.vehicle_number), vehicle === "BICYCLE" ? null : clean(b.license_no)]);
    id = r.insertId;
  } else {
    throw new HttpError(400, "Choose an account type.");
  }

  await startSession(id, role, name);
  await logActivity(role, id, "SIGN_UP", role, id);
  return { ok: true, role, home: HOME[role as "customer"] };
});
