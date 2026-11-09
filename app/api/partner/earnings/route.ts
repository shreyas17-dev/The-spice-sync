import { handle, requireRole } from "@/lib/api";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole("partner");
  const sum = await one("partner",
    `SELECT COALESCE(SUM(CASE WHEN delivered_at >= CURDATE() THEN partner_earning END), 0) AS today,
            COALESCE(SUM(CASE WHEN delivered_at >= CURDATE() - INTERVAL 6 DAY THEN partner_earning END), 0) AS week,
            COALESCE(SUM(partner_earning), 0) AS lifetime,
            COUNT(*) AS deliveries,
            COALESCE(SUM(distance_km), 0) AS km
       FROM v_delivery_task WHERE partner_id = ? AND delivery_status = 'DELIVERED'`, [u.id]);
  const stats = await one("partner", "SELECT rating_avg, deliveries_done, total_earnings FROM v_partner_stats WHERE partner_id = ?", [u.id]);
  // last 7 days, including days with nothing (recursive CTE)
  const days = await q("partner",
    `WITH RECURSIVE cal (day) AS (
        SELECT CURDATE() - INTERVAL 6 DAY UNION ALL SELECT day + INTERVAL 1 DAY FROM cal WHERE day < CURDATE())
     SELECT cal.day, COALESCE(SUM(t.partner_earning), 0) AS earned, COUNT(t.order_id) AS trips
       FROM cal LEFT JOIN v_delivery_task t
         ON DATE(t.delivered_at) = cal.day AND t.partner_id = ? AND t.delivery_status = 'DELIVERED'
      GROUP BY cal.day ORDER BY cal.day`, [u.id]);
  const recent = await q("partner",
    `SELECT order_id, restaurant_name, drop_address, distance_km, partner_earning, delivered_at, payment_method
       FROM v_delivery_task WHERE partner_id = ? AND delivery_status = 'DELIVERED'
      ORDER BY delivered_at DESC LIMIT 15`, [u.id]);
  return { summary: sum, stats, days, recent };
});
