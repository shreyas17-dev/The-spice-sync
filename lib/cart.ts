import { q } from "./db";
import { redis } from "./redis";

// The cart lives in Redis: hash cart:{customer_id} = { restaurant_id, item:{id} -> qty }
export async function readCart(customerId: number) {
  const h = await redis().hgetall(`cart:${customerId}`);
  const qty: Record<number, number> = {};
  for (const [k, v] of Object.entries(h)) if (k.startsWith("item:")) qty[Number(k.slice(5))] = Number(v);
  const ids = Object.keys(qty).map(Number);
  if (!ids.length) return { restaurant_id: null, restaurant_name: null, items: [], count: 0, subtotal: 0 };
  const rows = await q("customer",
    `SELECT m.item_id, m.name, m.price, m.is_veg, m.is_available, m.category, m.restaurant_id, r.name AS restaurant_name
       FROM menu_item m JOIN restaurant r ON r.restaurant_id = m.restaurant_id WHERE m.item_id IN (?)`, [ids]);
  const items = rows.map((r: any) => ({ ...r, qty: qty[r.item_id] }));
  const subtotal = items.reduce((s: number, i: any) => s + (i.is_available ? i.price * i.qty : 0), 0);
  return {
    restaurant_id: Number(h.restaurant_id) || (rows[0] && rows[0].restaurant_id),
    restaurant_name: rows[0] ? rows[0].restaurant_name : null,
    items,
    count: items.reduce((s: number, i: any) => s + i.qty, 0),
    subtotal: Math.round(subtotal * 100) / 100,
  };
}
