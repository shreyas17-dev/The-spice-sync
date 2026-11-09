import { handle, requireRole, HttpError, num } from "@/lib/api";
import { q, one } from "@/lib/db";
import { tryRedis, entry } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Core query Q2: one order end to end, plus its live events from Redis.
export const GET = handle(async (req, { params }) => {
  const u = await requireRole("customer");
  const id = num(params.id);
  const o = await one("customer",
    `SELECT o.order_id, o.order_status, o.placed_at, o.subtotal, o.discount_amount, o.tax_amount, o.delivery_fee,
            o.total_amount, o.special_instructions, o.restaurant_id,
            r.name AS restaurant, r.phone AS restaurant_phone, r.address_line AS restaurant_address,
            r.latitude AS r_lat, r.longitude AS r_long,
            a.label AS address_label, a.address_line, a.pincode, pc.city, a.latitude AS a_lat, a.longitude AS a_long,
            p.method, p.payment_status, p.paid_at, p.transaction_ref, cp.code AS coupon_code,
            d.delivery_status, d.assigned_at, d.picked_up_at, d.delivered_at, d.distance_km,
            dp.partner_id, dp.full_name AS partner_name, dp.phone AS partner_phone, dp.vehicle_type, dp.vehicle_number,
            dp.cur_lat AS p_lat, dp.cur_long AS p_long, ps.rating_avg AS partner_rating,
            rv.food_rating, rv.delivery_rating, rv.comment AS review_comment
       FROM orders o
       JOIN restaurant r ON r.restaurant_id = o.restaurant_id
       JOIN address a    ON a.customer_id = o.customer_id AND a.address_no = o.address_no
       JOIN pincode pc   ON pc.pincode = a.pincode
       JOIN payment p    ON p.order_id = o.order_id
       LEFT JOIN coupon cp           ON cp.coupon_id = o.coupon_id
       LEFT JOIN delivery d          ON d.order_id = o.order_id
       LEFT JOIN delivery_partner dp ON dp.partner_id = d.partner_id
       LEFT JOIN v_partner_stats ps  ON ps.partner_id = d.partner_id
       LEFT JOIN review rv           ON rv.order_id = o.order_id
      WHERE o.order_id = ? AND o.customer_id = ?`, [id, u.id]);
  if (!o) throw new HttpError(404, "Order not found.");
  const items = await q("customer",
    `SELECT oi.line_no, oi.quantity, oi.unit_price, oi.item_total, m.name, m.is_veg
       FROM order_item oi JOIN menu_item m ON m.item_id = oi.item_id WHERE oi.order_id = ? ORDER BY oi.line_no`, [id]);
  const events = await tryRedis(async (r) => (await r.xrange(`order:${id}:events`, "-", "+")).map(entry), [] as any[]);
  let rider: any = null;
  const lastLoc = [...events].reverse().find((e: any) => e.type === "location");
  if (lastLoc) rider = { lat: Number(lastLoc.lat), lng: Number(lastLoc.long) };
  else if (o.partner_id) {
    const pos = await tryRedis((r) => r.geopos("partners:geo", String(o.partner_id)), [] as any[]);
    if (pos && pos[0]) rider = { lat: Number(pos[0][1]), lng: Number(pos[0][0]) };
    else if (o.p_lat) rider = { lat: Number(o.p_lat), lng: Number(o.p_long) };
  }
  return { order: o, items, events, rider };
});
