import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one, callOut } from "@/lib/db";
import { redis, orderEvent, notify, tryRedis } from "@/lib/redis";
import { readCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole("customer");
  return q("customer",
    `SELECT o.order_id, o.order_status, o.placed_at, o.total_amount, o.restaurant_id, r.name AS restaurant,
            (SELECT GROUP_CONCAT(CONCAT(oi.quantity, ' x ', m.name) ORDER BY oi.line_no SEPARATOR ', ')
               FROM order_item oi JOIN menu_item m ON m.item_id = oi.item_id WHERE oi.order_id = o.order_id) AS items,
            EXISTS (SELECT 1 FROM review rv WHERE rv.order_id = o.order_id) AS reviewed
       FROM orders o JOIN restaurant r ON r.restaurant_id = o.restaurant_id
      WHERE o.customer_id = ?
      ORDER BY o.placed_at DESC LIMIT 60`, [u.id]);
});

// Checkout: the whole order is created by one stored procedure (one transaction).
export const POST = handle(async (req) => {
  const u = await requireRole("customer");
  const b = await body(req);
  const cart = await readCart(u.id);
  const items = cart.items.filter((i: any) => i.is_available).map((i: any) => ({ item_id: i.item_id, qty: i.qty }));
  if (!items.length) throw new HttpError(400, "Your cart is empty.");
  const method = ["UPI", "CARD", "NETBANKING", "WALLET", "COD"].includes(b.method) ? b.method : "UPI";
  const coupon = String(b.coupon || "").trim().toUpperCase() || null;

  const out = await callOut<{ oid: number }>("customer",
    "CALL sp_place_order(?, ?, ?, ?, ?, ?, ?, @oid)",
    [u.id, num(b.addressNo), cart.restaurant_id, JSON.stringify(items), coupon, method, b.note || null],
    "SELECT @oid AS oid");
  const orderId = Number(out.oid);

  await tryRedis((r) => r.del(`cart:${u.id}`), 0);
  await orderEvent(orderId, { status: "PLACED", note: "Order placed" });
  await notify("customer", u.id, orderId, `Order #${orderId} is placed. Waiting for the restaurant to accept.`);
  const owner = await one("customer", "SELECT owner_id, name FROM restaurant WHERE restaurant_id = ?", [cart.restaurant_id]);
  if (owner) await notify("owner", owner.owner_id, orderId, `New order #${orderId} at ${owner.name}`);
  return { orderId };
});
