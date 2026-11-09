import { handle, requireRole, HttpError, num } from "@/lib/api";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  const u = await requireRole("customer");
  const id = num(params.id);
  const addressNo = num(new URL(req.url).searchParams.get("addressNo"), 0);
  const r = await one("customer",
    `SELECT r.restaurant_id, r.name, r.phone, r.address_line, pc.city, r.latitude, r.longitude,
            r.opening_time, r.closing_time, r.avg_prep_time, r.cost_for_two, r.status,
            fn_is_open(r.opening_time, r.closing_time, CURTIME()) AS is_open,
            COALESCE(v.rating_avg, 0) AS rating, COALESCE(v.rating_count, 0) AS rating_count,
            (SELECT GROUP_CONCAT(rc.cuisine ORDER BY rc.cuisine SEPARATOR ', ')
               FROM restaurant_cuisine rc WHERE rc.restaurant_id = r.restaurant_id) AS cuisines
       FROM restaurant r
       JOIN pincode pc ON pc.pincode = r.pincode
       LEFT JOIN v_restaurant_rating v ON v.restaurant_id = r.restaurant_id
      WHERE r.restaurant_id = ? AND r.status = 'ACTIVE'`, [id]);
  if (!r) throw new HttpError(404, "This restaurant is not available.");
  let distance: any = null;
  if (addressNo) {
    distance = await one("customer",
      `SELECT fn_distance_km(a.latitude, a.longitude, ?, ?) AS km,
              fn_eta_minutes(?, fn_distance_km(a.latitude, a.longitude, ?, ?)) AS eta
         FROM address a WHERE a.customer_id = ? AND a.address_no = ?`,
      [r.latitude, r.longitude, r.avg_prep_time, r.latitude, r.longitude, u.id, addressNo]);
  }
  const menu = await q("customer",
    `SELECT item_id, name, description, category, price, is_veg, is_available
       FROM menu_item WHERE restaurant_id = ? ORDER BY category, is_available DESC, name`, [id]);
  return { restaurant: { ...r, km: distance?.km ?? null, eta: distance?.eta ?? null }, menu };
});
