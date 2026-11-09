import { handle, requireRole } from "@/lib/api";
import { q, one } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole("admin");
  const today = await one("admin",
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(CASE WHEN order_status <> 'CANCELLED' THEN total_amount END), 0) AS gmv,
            COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN commission_amount END), 0) AS commission,
            SUM(order_status IN ('PLACED','CONFIRMED','PREPARING','READY','PICKED_UP')) AS live
       FROM orders WHERE placed_at >= CURDATE()`);
  const counts = await one("admin",
    `SELECT (SELECT COUNT(*) FROM restaurant WHERE status = 'ACTIVE') AS restaurants,
            (SELECT COUNT(*) FROM restaurant WHERE status = 'PENDING') AS pending_restaurants,
            (SELECT COUNT(*) FROM delivery_partner WHERE status = 'PENDING') AS pending_partners,
            (SELECT COUNT(*) FROM delivery_partner WHERE availability IN ('ONLINE','BUSY')) AS riders_online,
            (SELECT COUNT(*) FROM delivery_partner WHERE availability = 'BUSY') AS riders_busy,
            (SELECT COUNT(*) FROM customer) AS customers`);
  const daily = await q("admin",
    `WITH RECURSIVE cal (day) AS (
        SELECT CURDATE() - INTERVAL 13 DAY UNION ALL SELECT day + INTERVAL 1 DAY FROM cal WHERE day < CURDATE())
     SELECT cal.day, COUNT(o.order_id) AS orders,
            COALESCE(SUM(o.total_amount), 0) AS gmv, COALESCE(SUM(o.commission_amount), 0) AS commission
       FROM cal LEFT JOIN orders o ON DATE(o.placed_at) = cal.day AND o.order_status = 'DELIVERED'
      GROUP BY cal.day ORDER BY cal.day`);
  const top = await q("admin",
    `SELECT r.restaurant_id, r.name, pc.city, COUNT(*) AS orders, SUM(o.subtotal) AS gross, SUM(o.commission_amount) AS commission
       FROM orders o JOIN restaurant r ON r.restaurant_id = o.restaurant_id JOIN pincode pc ON pc.pincode = r.pincode
      WHERE o.order_status = 'DELIVERED' AND o.placed_at >= CURDATE() - INTERVAL 29 DAY
      GROUP BY r.restaurant_id, r.name, pc.city ORDER BY gross DESC LIMIT 6`);
  const live = await q("admin",
    `SELECT order_status, COUNT(*) AS n FROM orders
      WHERE order_status IN ('PLACED','CONFIRMED','PREPARING','READY','PICKED_UP') GROUP BY order_status`);
  const methods = await q("admin",
    `SELECT p.method, COUNT(*) AS n FROM payment p JOIN orders o ON o.order_id = p.order_id
      WHERE o.order_status = 'DELIVERED' GROUP BY p.method ORDER BY n DESC`);
  const cities = await q("admin",
    `SELECT pc.city, COUNT(*) AS orders, SUM(o.total_amount) AS gmv
       FROM orders o JOIN restaurant r ON r.restaurant_id = o.restaurant_id JOIN pincode pc ON pc.pincode = r.pincode
      WHERE o.order_status = 'DELIVERED' GROUP BY pc.city ORDER BY gmv DESC`);
  return { today, counts, daily, top, live, methods, cities };
});
