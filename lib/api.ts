// Small helpers shared by every API route: role checks and error handling.
import { getUser, type SessionUser } from "./auth";
import type { Role } from "./db";

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Please log in again.");
  if (roles.length && !roles.includes(u.role)) throw new HttpError(403, "This page is not available for your role.");
  return u;
}

export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Turns thrown errors into JSON responses. MySQL errors become friendly messages. */
export function handle(fn: (req: Request, ctx: any) => Promise<any>) {
  return async (req: Request, ctx: any) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e: any) {
      if (e instanceof HttpError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
      const code = e?.errno;
      // our own SIGNAL ... SQLSTATE '45000' messages are written for users
      if (e?.sqlState === "45000") return Response.json({ error: e.sqlMessage }, { status: 400 });
      if (code === 1062) return Response.json({ error: duplicateMessage(e.sqlMessage) }, { status: 409 });
      if (code === 1451) return Response.json({ error: "This record is used by past orders, so it can't be removed." }, { status: 409 });
      if (code === 1452) return Response.json({ error: "A referenced record does not exist." }, { status: 400 });
      if (code === 3819) return Response.json({ error: checkMessage(e.sqlMessage || "") }, { status: 400 });
      if (code === 1142 || code === 1143 || code === 1370) {
        console.error("[db privilege]", e.sqlMessage);
        return Response.json({ error: "The database refused this action for your role.", detail: e.sqlMessage }, { status: 403 });
      }
      if (code === 1045 || e?.code === "ECONNREFUSED") {
        console.error("[db connect]", e.message);
        return Response.json({ error: "Cannot connect to MySQL. Is the database set up and running?" }, { status: 503 });
      }
      console.error("[api]", e);
      return Response.json({ error: e?.sqlMessage || e?.message || "Something went wrong" }, { status: 500 });
    }
  };
}

const CHECKS: Record<string, string> = {
  chk_customer_phone: "Enter a valid 10-digit Indian mobile number.",
  chk_customer_email: "Enter a valid email address.",
  chk_admin_email: "Enter a valid email address.",
  chk_owner_pan: "Enter a valid PAN, for example ABCDE1234F.",
  chk_partner_vehicle: "Scooters and motorbikes need a vehicle number and a licence number.",
  chk_partner_online: "You can go online only after an admin verifies your account.",
  chk_restaurant_commission: "Commission must be between 0 and 50 percent.",
  chk_restaurant_approval: "A restaurant can be active only after an admin approves it.",
  chk_menu_price: "Price must be more than zero.",
  chk_coupon_value: "Discount must be positive, and a percentage can't be more than 100.",
  chk_coupon_dates: "The end date must be after the start date.",
  chk_pincode_format: "Enter a valid 6-digit PIN code.",
};
function checkMessage(msg: string) {
  const m = msg.match(/'(chk_[a-z_]+)'/);
  return (m && CHECKS[m[1]]) || "Invalid value: " + msg;
}

function duplicateMessage(msg = "") {
  if (/review/i.test(msg)) return "You have already rated this order.";
  if (/email/i.test(msg)) return "An account with this email already exists.";
  if (/phone/i.test(msg)) return "This phone number is already registered.";
  if (/code/i.test(msg)) return "That coupon code already exists.";
  if (/name/i.test(msg)) return "That name is already used.";
  return "This entry already exists.";
}

export const num = (v: any, d = 0) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? d : Number(v));
