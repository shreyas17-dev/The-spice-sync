import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { one, callOut } from "@/lib/db";
import { orderEvent, notify, logActivity, nearbyPartners } from "@/lib/redis";

export const dynamic = "force-dynamic";

const NOTE: Record<string, string> = {
  CONFIRMED: "Restaurant accepted your order", PREPARING: "Your food is being prepared",
  READY: "Food is ready, waiting for the rider", CANCELLED: "The restaurant could not take this order",
};

// Owner confirms / prepares / marks ready / rejects. On CONFIRMED, Redis GEOSEARCH gives a
// quick shortlist of nearby riders; the stored procedure re-checks it in MySQL and assigns.
export const PATCH = handle(async (req, { params }) => {
  const u = await requireRole("owner");
  const id = num(params.id);
  const b = await body(req);
  const status = String(b.status || "");
  const o = await one("owner",
    `SELECT v.order_id, v.customer_id, v.order_status, v.partner_id, r.latitude, r.longitude, r.name
       FROM v_restaurant_orders v JOIN restaurant r ON r.restaurant_id = v.restaurant_id
      WHERE v.order_id = ? AND v.owner_id = ?`, [id, u.id]);
  if (!o) throw new HttpError(404, "Order not found.");

  let hint: number | null = null;
  const assignOnly = b.assign === true;
  if (status === "CONFIRMED" || assignOnly) {
    const near = await nearbyPartners(o.latitude, o.longitude, 5, 5);
    hint = near.length ? near[0].id : null;
  }

  let partnerId: number | null = null;
  if (assignOnly) {
    // retry when nobody was free at confirmation time
    const out = await callOut<{ pid: number }>("owner", "CALL sp_assign_delivery(?, ?, @pid)", [id, hint], "SELECT @pid AS pid");
    partnerId = out.pid ? Number(out.pid) : null;
  } else {
    const out = await callOut<{ pid: number }>("owner",
      "CALL sp_restaurant_update_order(?, ?, ?, ?, @pid)", [id, u.id, status, hint], "SELECT @pid AS pid");
    partnerId = out.pid ? Number(out.pid) : null;
    await orderEvent(id, partnerId ? { status, partner_id: partnerId, note: NOTE[status] || status } : { status, note: NOTE[status] || status });
    await notify("customer", o.customer_id, id, `Order #${id}: ${NOTE[status] || status}.`);
    await logActivity("owner", u.id, "ORDER_" + status, "orders", id);
  }
  if (partnerId) {
    await notify("partner", partnerId, id, `New delivery: order #${id} from ${o.name}.`);
    if (assignOnly) await orderEvent(id, { status: "CONFIRMED", partner_id: partnerId, note: "Rider assigned" });
  }
  return { ok: true, partnerId, hint, noRider: (status === "CONFIRMED" || assignOnly) && !partnerId };
});
