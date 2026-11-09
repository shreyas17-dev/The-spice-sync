import { handle, requireRole, body, HttpError } from "@/lib/api";
import { one, exec } from "@/lib/db";

export const dynamic = "force-dynamic";

// v_customer_profile adds the derived attribute age
export const GET = handle(async () => {
  const u = await requireRole("customer");
  const p = await one("customer",
    `SELECT customer_id, full_name, email, phone, date_of_birth, age, loyalty_points, status, created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.customer_id = v.customer_id AND o.order_status = 'DELIVERED') AS delivered_orders
       FROM v_customer_profile v WHERE customer_id = ?`, [u.id]);
  if (!p) throw new HttpError(404, "Profile not found");
  return p;
});

// column-level grant: a customer may update only full_name, phone and date_of_birth
export const PATCH = handle(async (req) => {
  const u = await requireRole("customer");
  const b = await body(req);
  await exec("customer", "UPDATE customer SET full_name = ?, phone = ?, date_of_birth = ? WHERE customer_id = ?",
    [String(b.full_name || "").trim(), String(b.phone || "").trim(), b.date_of_birth || null, u.id]);
  return { ok: true };
});
