import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one, exec } from "@/lib/db";
import { orderEvent, notify, tryRedis, logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Riders read their work only through the view v_delivery_task.
export const GET = handle(async () => {
  const u = await requireRole("partner");
  const current = await q("partner",
    `SELECT * FROM v_delivery_task WHERE partner_id = ? AND delivery_status IN ('ASSIGNED','PICKED_UP')
      ORDER BY assigned_at DESC`, [u.id]);
  return { current };
});

// Picked up / delivered. sp_partner_update_delivery checks the delivery is this rider's;
// the order triggers then update DELIVERY, PAYMENT (cash), rider availability and loyalty points.
export const PATCH = handle(async (req) => {
  const u = await requireRole("partner");
  const b = await body(req);
  const orderId = num(b.orderId);
  const status = String(b.status);
  if (!["PICKED_UP", "DELIVERED"].includes(status)) throw new HttpError(400, "Unknown status.");
  await exec("partner", "CALL sp_partner_update_delivery(?, ?, ?)", [orderId, u.id, status]);
  const t = await one("partner", "SELECT customer_id, restaurant_name FROM v_delivery_task WHERE order_id = ? AND partner_id = ?", [orderId, u.id]);
  const note = status === "PICKED_UP" ? "Rider picked up your food" : "Delivered. Enjoy your meal!";
  await orderEvent(orderId, { status, partner_id: u.id, note });
  if (t) await notify("customer", t.customer_id, orderId, `Order #${orderId}: ${note}`);
  if (status === "DELIVERED") {
    await tryRedis((r) => r.set(`partner:${u.id}:ping`, "ONLINE", "EX", 900), null);
  }
  await logActivity("partner", u.id, "DELIVERY_" + status, "orders", orderId);
  return { ok: true };
});
