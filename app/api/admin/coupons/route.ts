import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, exec } from "@/lib/db";
import { logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole("admin");
  return q("admin",
    `SELECT c.coupon_id, c.code, c.description, c.discount_type, c.discount_value, c.max_discount, c.min_order_value,
            c.valid_from, c.valid_to, c.usage_limit, c.status, r.name AS restaurant,
            NOW() BETWEEN c.valid_from AND c.valid_to AS in_window,
            (SELECT COUNT(*) FROM orders o WHERE o.coupon_id = c.coupon_id AND o.order_status <> 'CANCELLED') AS used
       FROM coupon c LEFT JOIN restaurant r ON r.restaurant_id = c.restaurant_id
      ORDER BY c.status, c.valid_to DESC`);
});

// Platform-wide coupon (restaurant_id stays NULL).
export const POST = handle(async (req) => {
  const u = await requireRole("admin");
  const b = await body(req);
  const code = String(b.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new HttpError(400, "Use 3 to 20 letters or digits for the code.");
  const days = Math.max(1, num(b.days, 30));
  const r = await exec("admin",
    `INSERT INTO coupon (code, description, discount_type, discount_value, max_discount, min_order_value, valid_from, valid_to, usage_limit)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW() + INTERVAL ? DAY, ?)`,
    [code, b.description || null, b.discount_type === "FLAT" ? "FLAT" : "PERCENT", num(b.discount_value),
     b.max_discount ? num(b.max_discount) : null, num(b.min_order_value), days, Math.max(1, num(b.usage_limit, 1000))]);
  await logActivity("admin", u.id, "CREATE_COUPON", "coupon", r.insertId);
  return { ok: true };
});

export const PATCH = handle(async (req) => {
  const u = await requireRole("admin");
  const b = await body(req);
  await exec("admin", "UPDATE coupon SET status = ? WHERE coupon_id = ?", [b.status === "ACTIVE" ? "ACTIVE" : "INACTIVE", num(b.coupon_id)]);
  await logActivity("admin", u.id, "UPDATE_COUPON", "coupon", num(b.coupon_id));
  return { ok: true };
});
