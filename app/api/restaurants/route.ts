import { handle, requireRole, num } from "@/lib/api";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";

// Core query Q1: restaurants this customer can order from right now
// (approved, open now, same city and within 8 km of the chosen address).
export const GET = handle(async (req) => {
  const u = await requireRole("customer");
  const sp = new URL(req.url).searchParams;
  let addressNo = num(sp.get("addressNo"), 0);
  if (!addressNo) {
    const a = await one("customer", "SELECT address_no FROM address WHERE customer_id = ? ORDER BY is_default DESC, address_no LIMIT 1", [u.id]);
    if (!a) return { address: null, restaurants: [], closedNearby: 0 };
    addressNo = a.address_no;
  }
  const cuisine = sp.get("cuisine") || "";
  const params: any[] = [];
  let cuisineFilter = "";
  if (cuisine) {
    cuisineFilter = "AND EXISTS (SELECT 1 FROM restaurant_cuisine c2 WHERE c2.restaurant_id = r.restaurant_id AND c2.cuisine = ?)";
    params.push(cuisine);
  }
  params.push(u.id, addressNo);
  const rows = await q("customer",
    `SELECT r.restaurant_id, r.name, r.address_line, pc.city, r.cost_for_two, r.avg_prep_time,
            r.opening_time, r.closing_time,
            fn_is_open(r.opening_time, r.closing_time, CURTIME()) AS is_open,
            fn_distance_km(a.latitude, a.longitude, r.latitude, r.longitude) AS km,
            fn_eta_minutes(r.avg_prep_time, fn_distance_km(a.latitude, a.longitude, r.latitude, r.longitude)) AS eta,
            COALESCE(v.rating_avg, 0) AS rating, COALESCE(v.rating_count, 0) AS rating_count,
            (SELECT GROUP_CONCAT(rc.cuisine ORDER BY rc.cuisine SEPARATOR ', ')
               FROM restaurant_cuisine rc WHERE rc.restaurant_id = r.restaurant_id) AS cuisines,
            (SELECT COUNT(*) FROM menu_item m WHERE m.restaurant_id = r.restaurant_id AND m.is_veg = FALSE) = 0 AS pure_veg
       FROM address a
       JOIN pincode ap  ON ap.pincode = a.pincode
       JOIN restaurant r ON r.status = 'ACTIVE'
       JOIN pincode pc  ON pc.pincode = r.pincode AND pc.city = ap.city
       LEFT JOIN v_restaurant_rating v ON v.restaurant_id = r.restaurant_id
      WHERE 1 = 1 ${cuisineFilter}
        AND a.customer_id = ? AND a.address_no = ?
     HAVING km <= 8
      ORDER BY is_open DESC, km`, params);
  const address = await one("customer",
    "SELECT a.address_no, a.label, a.address_line, p.city FROM address a JOIN pincode p ON p.pincode = a.pincode WHERE a.customer_id = ? AND a.address_no = ?",
    [u.id, addressNo]);
  const open = rows.filter((r: any) => Number(r.is_open) === 1);
  return { address, restaurants: open, closedNearby: rows.length - open.length, closed: rows.filter((r: any) => Number(r.is_open) !== 1) };
});
