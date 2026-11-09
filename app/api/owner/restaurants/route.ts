import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, exec, one } from "@/lib/db";
import { logActivity, notify } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole("owner");
  const rows = await q("owner",
    `SELECT r.restaurant_id, r.name, r.phone, r.address_line, r.pincode, pc.city, r.latitude, r.longitude,
            r.opening_time, r.closing_time, r.avg_prep_time, r.cost_for_two, r.commission_pct, r.status, r.approved_at,
            fn_is_open(r.opening_time, r.closing_time, CURTIME()) AS is_open,
            COALESCE(v.rating_avg, 0) AS rating, COALESCE(v.rating_count, 0) AS rating_count,
            (SELECT GROUP_CONCAT(rc.cuisine ORDER BY rc.cuisine SEPARATOR ', ') FROM restaurant_cuisine rc
              WHERE rc.restaurant_id = r.restaurant_id) AS cuisines
       FROM restaurant r
       JOIN pincode pc ON pc.pincode = r.pincode
       LEFT JOIN v_restaurant_rating v ON v.restaurant_id = r.restaurant_id
      WHERE r.owner_id = ? ORDER BY r.restaurant_id`, [u.id]);
  return rows;
});

// Register a new restaurant. The owner's INSERT grant has no status/commission/approval
// columns, so it always starts as PENDING until an admin approves it.
export const POST = handle(async (req) => {
  const u = await requireRole("owner");
  const b = await body(req);
  if (!b.name || !b.address_line || !b.pincode) throw new HttpError(400, "Name, address and PIN code are required.");
  const r = await exec("owner",
    `INSERT INTO restaurant (owner_id, name, phone, address_line, pincode, latitude, longitude,
                             opening_time, closing_time, avg_prep_time, cost_for_two)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u.id, b.name, b.phone || "", b.address_line, b.pincode, num(b.latitude), num(b.longitude),
     b.opening_time || "10:00", b.closing_time || "23:00", num(b.avg_prep_time, 20), num(b.cost_for_two, 400)]);
  const cuisines: string[] = String(b.cuisines || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const c of cuisines) await exec("owner", "INSERT IGNORE INTO restaurant_cuisine (restaurant_id, cuisine) VALUES (?, ?)", [r.insertId, c]);
  await logActivity("owner", u.id, "REGISTER_RESTAURANT", "restaurant", r.insertId);
  await notify("admin", 1, null, `New restaurant "${b.name}" is waiting for approval.`);
  return { ok: true, restaurant_id: r.insertId };
});

// Edit operating details (column-level UPDATE grant) and cuisines.
export const PATCH = handle(async (req) => {
  const u = await requireRole("owner");
  const b = await body(req);
  const id = num(b.restaurant_id);
  const mine = await one("owner", "SELECT restaurant_id FROM restaurant WHERE restaurant_id = ? AND owner_id = ?", [id, u.id]);
  if (!mine) throw new HttpError(404, "Restaurant not found.");
  await exec("owner",
    `UPDATE restaurant SET name = ?, phone = ?, opening_time = ?, closing_time = ?, avg_prep_time = ?, cost_for_two = ?
      WHERE restaurant_id = ? AND owner_id = ?`,
    [b.name, b.phone, b.opening_time, b.closing_time, num(b.avg_prep_time, 20), num(b.cost_for_two, 400), id, u.id]);
  if (typeof b.cuisines === "string") {
    const want = b.cuisines.split(",").map((s: string) => s.trim()).filter(Boolean);
    const have = (await q("owner", "SELECT cuisine FROM restaurant_cuisine WHERE restaurant_id = ?", [id])).map((r: any) => r.cuisine);
    for (const c of have) if (!want.includes(c)) await exec("owner", "DELETE FROM restaurant_cuisine WHERE restaurant_id = ? AND cuisine = ?", [id, c]);
    for (const c of want) if (!have.includes(c)) await exec("owner", "INSERT INTO restaurant_cuisine (restaurant_id, cuisine) VALUES (?, ?)", [id, c]);
  }
  await logActivity("owner", u.id, "UPDATE_RESTAURANT", "restaurant", id);
  return { ok: true };
});
