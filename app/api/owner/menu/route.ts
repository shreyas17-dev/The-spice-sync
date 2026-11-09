import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one, exec } from "@/lib/db";
import { logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

async function ownRestaurant(ownerId: number, rid: number) {
  const r = await one("owner", "SELECT restaurant_id FROM restaurant WHERE restaurant_id = ? AND owner_id = ?", [rid, ownerId]);
  if (!r) throw new HttpError(404, "Restaurant not found.");
}

export const GET = handle(async (req) => {
  const u = await requireRole("owner");
  const rid = num(new URL(req.url).searchParams.get("restaurantId"));
  await ownRestaurant(u.id, rid);
  return q("owner",
    `SELECT m.item_id, m.name, m.description, m.category, m.price, m.is_veg, m.is_available,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_item oi WHERE oi.item_id = m.item_id) AS sold
       FROM menu_item m WHERE m.restaurant_id = ? ORDER BY m.category, m.name`, [rid]);
});

export const POST = handle(async (req) => {
  const u = await requireRole("owner");
  const b = await body(req);
  const rid = num(b.restaurant_id);
  await ownRestaurant(u.id, rid);
  if (!b.name || !b.category) throw new HttpError(400, "Name and category are required.");
  const r = await exec("owner",
    "INSERT INTO menu_item (restaurant_id, name, description, category, price, is_veg) VALUES (?, ?, ?, ?, ?, ?)",
    [rid, String(b.name).trim(), b.description || null, String(b.category).trim(), num(b.price), b.is_veg ? 1 : 0]);
  await logActivity("owner", u.id, "ADD_DISH", "menu_item", r.insertId);
  return { ok: true, item_id: r.insertId };
});

// Price change or sold-out toggle. Old order lines keep their own unit_price (BR-6).
export const PATCH = handle(async (req) => {
  const u = await requireRole("owner");
  const b = await body(req);
  const id = num(b.item_id);
  const sets: string[] = [], vals: any[] = [];
  if (b.price !== undefined) { sets.push("m.price = ?"); vals.push(num(b.price)); }
  if (b.is_available !== undefined) { sets.push("m.is_available = ?"); vals.push(b.is_available ? 1 : 0); }
  if (b.name !== undefined) { sets.push("m.name = ?"); vals.push(String(b.name)); }
  if (b.description !== undefined) { sets.push("m.description = ?"); vals.push(b.description || null); }
  if (!sets.length) return { ok: true };
  const r = await exec("owner",
    `UPDATE menu_item m JOIN restaurant r ON r.restaurant_id = m.restaurant_id SET ${sets.join(", ")}
      WHERE m.item_id = ? AND r.owner_id = ?`, [...vals, id, u.id]);
  if (!r.affectedRows) throw new HttpError(404, "Dish not found.");
  await logActivity("owner", u.id, b.price !== undefined ? "UPDATE_MENU_PRICE" : "UPDATE_MENU_ITEM", "menu_item", id);
  return { ok: true };
});
