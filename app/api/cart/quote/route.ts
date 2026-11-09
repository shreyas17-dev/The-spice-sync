import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one } from "@/lib/db";
import { readCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

// Bill preview before checkout. Uses the same rules as sp_place_order
// (BR-7 to BR-11); the procedure recalculates everything when the order is placed.
export const POST = handle(async (req) => {
  const u = await requireRole("customer");
  const b = await body(req);
  const cart = await readCart(u.id);
  if (!cart.items.length) return { empty: true };
  const addressNo = num(b.addressNo);
  const rest = await one("customer",
    `SELECT r.restaurant_id, r.name, fn_is_open(r.opening_time, r.closing_time, CURTIME()) AS is_open,
            fn_distance_km(a.latitude, a.longitude, r.latitude, r.longitude) AS km
       FROM restaurant r JOIN address a ON a.customer_id = ? AND a.address_no = ?
      WHERE r.restaurant_id = ?`, [u.id, addressNo, cart.restaurant_id]);
  if (!rest) throw new HttpError(400, "Choose a delivery address.");
  const subtotal = cart.subtotal;

  let discount = 0, couponError: string | null = null, coupon: any = null;
  const code = String(b.coupon || "").trim().toUpperCase();
  if (code) {
    const c = await one("customer",
      `SELECT c.coupon_id, c.code, c.description, c.min_order_value, c.status,
              CASE WHEN c.discount_type = 'PERCENT'
                   THEN LEAST(ROUND(? * c.discount_value / 100, 2), COALESCE(c.max_discount, ?))
                   ELSE LEAST(c.discount_value, ?) END AS discount,
              NOW() BETWEEN c.valid_from AND c.valid_to AS in_window,
              (c.restaurant_id IS NULL OR c.restaurant_id = ?) AS right_restaurant,
              (SELECT COUNT(*) FROM orders o WHERE o.coupon_id = c.coupon_id AND o.order_status <> 'CANCELLED') < c.usage_limit AS has_uses
         FROM coupon c WHERE c.code = ?`, [subtotal, subtotal, subtotal, rest.restaurant_id, code]);
    if (!c) couponError = "This coupon code doesn't exist.";
    else if (c.status !== "ACTIVE" || !Number(c.in_window)) couponError = "This coupon has expired.";
    else if (!Number(c.right_restaurant)) couponError = "This coupon works only at another restaurant.";
    else if (subtotal < c.min_order_value) couponError = `Add items worth ₹${Math.ceil(c.min_order_value - subtotal)} more to use this coupon.`;
    else if (!Number(c.has_uses)) couponError = "This coupon has been fully used.";
    else { discount = Number(c.discount); coupon = { code: c.code, description: c.description }; }
  }

  const fee = await one("customer", "SELECT fn_delivery_fee(?, ?) AS fee", [subtotal, rest.km]);
  const tax = Math.round((subtotal - discount) * 0.05 * 100) / 100;
  const delivery = Number(fee?.fee || 0);
  const total = Math.round((subtotal - discount + tax + delivery) * 100) / 100;
  const offers = await q("customer",
    `SELECT code, description, min_order_value FROM coupon
      WHERE status = 'ACTIVE' AND NOW() BETWEEN valid_from AND valid_to
        AND (restaurant_id IS NULL OR restaurant_id = ?)
      ORDER BY restaurant_id IS NULL, min_order_value LIMIT 6`, [rest.restaurant_id]);
  return {
    cart, restaurant: rest, km: rest.km, isOpen: Number(rest.is_open) === 1,
    bill: { subtotal, discount, tax, delivery, total }, coupon, couponError, offers,
    freeDeliveryGap: subtotal < 499 ? Math.ceil(499 - subtotal) : 0,
  };
});
