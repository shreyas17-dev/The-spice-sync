import { handle, requireRole, HttpError, num } from "@/lib/api";
import { one, callSets } from "@/lib/db";

export const dynamic = "force-dynamic";

// Core query Q3 for the owner dashboard: sp_restaurant_sales_report returns a day-by-day
// calendar (recursive CTE) and the top dishes (RANK window function).
export const GET = handle(async (req) => {
  const u = await requireRole("owner");
  const sp = new URL(req.url).searchParams;
  const rid = num(sp.get("restaurantId"));
  const days = Math.min(Math.max(num(sp.get("days"), 14), 1), 90);
  const r = await one("owner", "SELECT restaurant_id, name, status FROM restaurant WHERE restaurant_id = ? AND owner_id = ?", [rid, u.id]);
  if (!r) throw new HttpError(404, "Restaurant not found.");
  const sets = await callSets("owner", "CALL sp_restaurant_sales_report(?, CURDATE() - INTERVAL ? DAY, CURDATE())", [rid, days - 1]);
  const daily = sets[0] || [];
  const top = sets[1] || [];
  const net30 = await one("owner", "SELECT fn_restaurant_revenue(?, CURDATE() - INTERVAL 29 DAY, CURDATE()) AS net", [rid]);
  const today = await one("owner",
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(CASE WHEN order_status <> 'CANCELLED' THEN subtotal END), 0) AS sales,
            SUM(order_status IN ('PLACED','CONFIRMED','PREPARING','READY')) AS in_kitchen,
            SUM(order_status = 'PLACED') AS waiting
       FROM v_restaurant_orders WHERE restaurant_id = ? AND placed_at >= CURDATE()`, [rid]);
  const rating = await one("owner", "SELECT rating_avg, rating_count FROM v_restaurant_rating WHERE restaurant_id = ?", [rid]);
  const totals = daily.reduce((a: any, d: any) => ({
    orders: a.orders + Number(d.orders), gross: a.gross + Number(d.gross_sales),
    commission: a.commission + Number(d.commission), net: a.net + Number(d.net_payout),
  }), { orders: 0, gross: 0, commission: 0, net: 0 });
  return { restaurant: r, daily, top, totals, net30: net30?.net || 0, today, rating };
});
