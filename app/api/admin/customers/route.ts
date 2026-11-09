import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, exec } from "@/lib/db";
import { logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole("admin");
  return q("admin",
    `SELECT v.customer_id, v.full_name, v.email, v.phone, v.age, v.loyalty_points, v.status, v.created_at,
            COUNT(o.order_id) AS orders, COALESCE(SUM(CASE WHEN o.order_status = 'DELIVERED' THEN o.total_amount END), 0) AS spent
       FROM v_customer_profile v LEFT JOIN orders o ON o.customer_id = v.customer_id
      GROUP BY v.customer_id, v.full_name, v.email, v.phone, v.age, v.loyalty_points, v.status, v.created_at
      ORDER BY spent DESC`);
});

export const PATCH = handle(async (req) => {
  const u = await requireRole("admin");
  const b = await body(req);
  const id = num(b.customer_id);
  const status = b.action === "block" ? "BLOCKED" : b.action === "unblock" ? "ACTIVE" : null;
  if (!status) throw new HttpError(400, "Unknown action.");
  await exec("admin", "UPDATE customer SET status = ? WHERE customer_id = ?", [status, id]);
  await logActivity("admin", u.id, status === "BLOCKED" ? "BLOCK_CUSTOMER" : "UNBLOCK_CUSTOMER", "customer", id);
  return { ok: true };
});
