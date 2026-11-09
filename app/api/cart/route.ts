import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one } from "@/lib/db";
import { redis } from "@/lib/redis";
import { readCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

const WEEK = 604800;

export const GET = handle(async () => {
  const u = await requireRole("customer");
  return readCart(u.id);
});

// { item_id, delta } adds or removes; { reorder: order_id } copies an old order; replace: true clears another restaurant's cart
export const POST = handle(async (req) => {
  const u = await requireRole("customer");
  const b = await body(req);
  const key = `cart:${u.id}`;
  const r = redis();

  if (b.reorder) {
    const lines = await q("customer",
      `SELECT oi.item_id, oi.quantity, o.restaurant_id FROM order_item oi JOIN orders o ON o.order_id = oi.order_id
        JOIN menu_item m ON m.item_id = oi.item_id
        WHERE o.order_id = ? AND o.customer_id = ? AND m.is_available = TRUE`, [num(b.reorder), u.id]);
    if (!lines.length) throw new HttpError(400, "None of these dishes are available right now.");
    await r.del(key);
    const args: string[] = ["restaurant_id", String(lines[0].restaurant_id)];
    for (const l of lines) args.push(`item:${l.item_id}`, String(l.quantity));
    await r.hset(key, ...args);
    await r.expire(key, WEEK);
    return readCart(u.id);
  }

  const itemId = num(b.item_id);
  const delta = num(b.delta, 1);
  const item = await one("customer", "SELECT item_id, restaurant_id, is_available FROM menu_item WHERE item_id = ?", [itemId]);
  if (!item) throw new HttpError(404, "Dish not found.");
  if (delta > 0 && !item.is_available) throw new HttpError(400, "This dish is sold out right now.");
  const current = await r.hget(key, "restaurant_id");
  if (current && Number(current) !== item.restaurant_id) {
    if (!b.replace) {
      const other = await one("customer", "SELECT name FROM restaurant WHERE restaurant_id = ?", [Number(current)]);
      throw new HttpError(409, `Your cart has dishes from ${other ? other.name : "another restaurant"}. Start a new cart?`, "OTHER_RESTAURANT");
    }
    await r.del(key);
  }
  await r.hset(key, "restaurant_id", String(item.restaurant_id));
  const n = await r.hincrby(key, `item:${itemId}`, delta);
  if (n <= 0) await r.hdel(key, `item:${itemId}`);
  const fields = await r.hkeys(key);
  if (!fields.some((f) => f.startsWith("item:"))) await r.del(key);
  else await r.expire(key, WEEK);
  return readCart(u.id);
});

export const DELETE = handle(async () => {
  const u = await requireRole("customer");
  await redis().del(`cart:${u.id}`);
  return readCart(u.id);
});
