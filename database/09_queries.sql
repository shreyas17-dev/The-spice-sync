-- =====================================================================
--  09_queries.sql : join, nested, correlated and recursive queries
--  Q1-Q4 are the four core queries from the problem statement.
-- =====================================================================
USE food_delivery;

-- =====================================================================
-- A. JOIN QUERIES
-- =====================================================================

-- Q1. Restaurants customer 7 can order from right now: open, approved, within 8 km
--     of the default address, with cuisines, rating, distance and ETA.
SELECT r.restaurant_id,
       r.name,
       GROUP_CONCAT(DISTINCT rc.cuisine ORDER BY rc.cuisine SEPARATOR ', ') AS cuisines,
       COALESCE(v.rating_avg, 'New') AS rating,
       r.cost_for_two,
       fn_distance_km(a.latitude, a.longitude, r.latitude, r.longitude) AS distance_km,
       fn_eta_minutes(r.avg_prep_time,
                      fn_distance_km(a.latitude, a.longitude, r.latitude, r.longitude)) AS eta_min
FROM address a
JOIN pincode pa            ON pa.pincode = a.pincode
JOIN restaurant r          ON r.status = 'ACTIVE'
JOIN pincode pr            ON pr.pincode = r.pincode AND pr.city = pa.city
JOIN restaurant_cuisine rc ON rc.restaurant_id = r.restaurant_id
LEFT JOIN v_restaurant_rating v ON v.restaurant_id = r.restaurant_id
WHERE a.customer_id = 7
  AND a.is_default = TRUE
  AND fn_is_open(r.opening_time, r.closing_time, CURTIME())
  AND fn_distance_km(a.latitude, a.longitude, r.latitude, r.longitude) <= 8
GROUP BY r.restaurant_id, r.name, v.rating_avg, r.cost_for_two, r.avg_prep_time,
         a.latitude, a.longitude, r.latitude, r.longitude
ORDER BY distance_km;

-- Q2. Track order 761 from placement to delivery (one row with the whole story)
SELECT o.order_id, o.order_status,
       c.full_name  AS customer,
       r.name       AS restaurant,
       CONCAT(a.address_line, ', ', pc.city, ' ', a.pincode) AS deliver_to,
       o.placed_at,
       p.method, p.payment_status, p.paid_at,
       dp.full_name AS partner, dp.phone AS partner_phone,
       d.assigned_at, d.picked_up_at, d.delivered_at,
       TIMESTAMPDIFF(MINUTE, o.placed_at, COALESCE(d.delivered_at, NOW())) AS minutes_elapsed,
       o.total_amount
FROM orders o
JOIN customer c   ON c.customer_id = o.customer_id
JOIN restaurant r ON r.restaurant_id = o.restaurant_id
JOIN address a    ON a.customer_id = o.customer_id AND a.address_no = o.address_no
JOIN pincode pc   ON pc.pincode = a.pincode
JOIN payment p    ON p.order_id = o.order_id
LEFT JOIN delivery d          ON d.order_id = o.order_id
LEFT JOIN delivery_partner dp ON dp.partner_id = d.partner_id
WHERE o.order_id = 761;

-- Q3a. Revenue of every restaurant over the last 30 days (BR-19)
SELECT r.name                                   AS restaurant,
       COUNT(*)                                 AS orders,
       SUM(o.subtotal)                          AS gross_sales,
       SUM(o.commission_amount)                 AS commission,
       SUM(o.subtotal - o.commission_amount
           - IF(c.restaurant_id IS NULL, 0, o.discount_amount)) AS net_payout,
       ROUND(AVG(o.total_amount), 2)            AS avg_bill
FROM orders o
JOIN restaurant r  ON r.restaurant_id = o.restaurant_id
LEFT JOIN coupon c ON c.coupon_id = o.coupon_id
WHERE o.order_status = 'DELIVERED'
  AND o.placed_at >= CURDATE() - INTERVAL 30 DAY
GROUP BY r.restaurant_id, r.name
ORDER BY net_payout DESC;

-- Q3b. Three most popular dishes of each restaurant (CTE + window function)
WITH item_sales AS (
    SELECT o.restaurant_id, oi.item_id,
           SUM(oi.quantity)   AS qty_sold,
           SUM(oi.item_total) AS revenue
    FROM order_item oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.order_status = 'DELIVERED'
    GROUP BY o.restaurant_id, oi.item_id
),
ranked AS (
    SELECT s.*, RANK() OVER (PARTITION BY s.restaurant_id ORDER BY s.qty_sold DESC) AS sales_rank
    FROM item_sales s
)
SELECT r.name AS restaurant, m.name AS dish, rk.qty_sold, rk.revenue, rk.sales_rank
FROM ranked rk
JOIN restaurant r ON r.restaurant_id = rk.restaurant_id
JOIN menu_item m  ON m.item_id = rk.item_id
WHERE rk.sales_rank <= 3
ORDER BY r.name, rk.sales_rank;

-- Q4. Delivery partners who could take a new order from Biryani Bhavan (restaurant 2):
--     verified, online, not on another delivery, within 5 km; nearest and best rated first
SELECT p.partner_id, p.full_name, p.vehicle_type,
       fn_distance_km(r.latitude, r.longitude, p.cur_lat, p.cur_long) AS km_away,
       s.rating_avg, s.deliveries_done
FROM restaurant r
JOIN delivery_partner p ON p.status = 'ACTIVE' AND p.availability = 'ONLINE'
JOIN v_partner_stats s  ON s.partner_id = p.partner_id
WHERE r.restaurant_id = 2
  AND NOT EXISTS (SELECT 1 FROM delivery d
                   WHERE d.partner_id = p.partner_id
                     AND d.delivery_status IN ('ASSIGNED','PICKED_UP'))
  AND fn_distance_km(r.latitude, r.longitude, p.cur_lat, p.cur_long) <= 5
ORDER BY km_away, s.rating_avg DESC;

-- J1. Price snapshot at work: dishes sold at a price different from today's menu price
SELECT r.name AS restaurant, m.name AS dish, oi.unit_price AS price_paid, m.price AS price_today,
       COUNT(*) AS order_lines
FROM order_item oi
JOIN menu_item m  ON m.item_id = oi.item_id
JOIN restaurant r ON r.restaurant_id = m.restaurant_id
WHERE oi.unit_price <> m.price
GROUP BY r.name, m.name, oi.unit_price, m.price;

-- J2. Payment mix per city (four-table join + conditional aggregation)
SELECT pc.city,
       COUNT(*) AS orders,
       ROUND(100 * SUM(p.method = 'UPI') / COUNT(*), 1) AS upi_pct,
       ROUND(100 * SUM(p.method = 'COD') / COUNT(*), 1) AS cod_pct,
       ROUND(100 * SUM(p.method IN ('CARD','NETBANKING','WALLET')) / COUNT(*), 1) AS other_pct
FROM orders o
JOIN payment p     ON p.order_id = o.order_id
JOIN restaurant r  ON r.restaurant_id = o.restaurant_id
JOIN pincode pc    ON pc.pincode = r.pincode
WHERE o.order_status = 'DELIVERED'
GROUP BY pc.city;

-- =====================================================================
-- B. NESTED (non-correlated) QUERIES
-- =====================================================================

-- N1. Restaurants whose average bill is above the platform-wide average
SELECT r.name, ROUND(AVG(o.total_amount), 2) AS avg_bill
FROM orders o
JOIN restaurant r ON r.restaurant_id = o.restaurant_id
WHERE o.order_status = 'DELIVERED'
GROUP BY r.restaurant_id, r.name
HAVING AVG(o.total_amount) > (SELECT AVG(total_amount) FROM orders WHERE order_status = 'DELIVERED')
ORDER BY avg_bill DESC;

-- N2. Dishes that have never been ordered
SELECT r.name AS restaurant, m.name AS dish, m.price
FROM menu_item m
JOIN restaurant r ON r.restaurant_id = m.restaurant_id
WHERE m.item_id NOT IN (SELECT DISTINCT item_id FROM order_item)
ORDER BY r.name, m.name;

-- N3. Veg dishes under Rs 200 from restaurants that serve South Indian food
SELECT r.name AS restaurant, m.name AS dish, m.category, m.price
FROM menu_item m
JOIN restaurant r ON r.restaurant_id = m.restaurant_id
WHERE m.is_veg = TRUE AND m.is_available = TRUE AND m.price < 200
  AND r.status = 'ACTIVE'
  AND r.restaurant_id IN (SELECT restaurant_id FROM restaurant_cuisine WHERE cuisine = 'South Indian')
ORDER BY m.price;

-- N4. Our best customers: total spend above Rs 5,000 (subquery in FROM)
SELECT c.full_name, t.orders, t.spent
FROM (SELECT customer_id, COUNT(*) AS orders, SUM(total_amount) AS spent
        FROM orders
       WHERE order_status = 'DELIVERED'
       GROUP BY customer_id) AS t
JOIN customer c ON c.customer_id = t.customer_id
WHERE t.spent > 5000
ORDER BY t.spent DESC;

-- =====================================================================
-- C. CORRELATED SUBQUERIES
-- =====================================================================

-- C1. The most expensive dish of every restaurant
SELECT r.name AS restaurant, m.name AS dish, m.price
FROM menu_item m
JOIN restaurant r ON r.restaurant_id = m.restaurant_id
WHERE m.price = (SELECT MAX(m2.price) FROM menu_item m2 WHERE m2.restaurant_id = m.restaurant_id)
ORDER BY m.price DESC;

-- C2. Customers whose most recent order was cancelled (good targets for a win-back coupon)
SELECT c.customer_id, c.full_name, o.order_id, o.placed_at
FROM customer c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_status = 'CANCELLED'
  AND o.placed_at = (SELECT MAX(o2.placed_at) FROM orders o2 WHERE o2.customer_id = c.customer_id);

-- C3. Partners whose average delivery time beats the average of all partners in the same city
SELECT p.full_name, pc.city,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, d.picked_up_at, d.delivered_at)), 1) AS avg_ride_min
FROM delivery d
JOIN delivery_partner p ON p.partner_id = d.partner_id
JOIN orders o           ON o.order_id = d.order_id
JOIN restaurant r       ON r.restaurant_id = o.restaurant_id
JOIN pincode pc         ON pc.pincode = r.pincode
WHERE d.delivery_status = 'DELIVERED'
GROUP BY p.partner_id, p.full_name, pc.city
HAVING AVG(TIMESTAMPDIFF(MINUTE, d.picked_up_at, d.delivered_at)) <
       (SELECT AVG(TIMESTAMPDIFF(MINUTE, d2.picked_up_at, d2.delivered_at))
          FROM delivery d2
          JOIN orders o2      ON o2.order_id = d2.order_id
          JOIN restaurant r2  ON r2.restaurant_id = o2.restaurant_id
          JOIN pincode pc2    ON pc2.pincode = r2.pincode
         WHERE d2.delivery_status = 'DELIVERED' AND pc2.city = pc.city)
ORDER BY pc.city, avg_ride_min;

-- C4. For each customer, how many of their orders used a coupon (scalar correlated subquery)
SELECT c.full_name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS orders,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id AND o.coupon_id IS NOT NULL) AS with_coupon
FROM customer c
ORDER BY with_coupon DESC, orders DESC
LIMIT 10;

-- =====================================================================
-- D. RECURSIVE QUERIES (WITH RECURSIVE)
-- =====================================================================

-- R1. Daily sales of Biryani Bhavan for the last 14 days, including days with no sales.
--     The recursive CTE generates the calendar; a LEFT JOIN fills in the numbers.
WITH RECURSIVE calendar (day) AS (
    SELECT CURDATE() - INTERVAL 13 DAY
    UNION ALL
    SELECT day + INTERVAL 1 DAY FROM calendar WHERE day < CURDATE()
)
SELECT cal.day,
       COUNT(o.order_id)            AS orders,
       COALESCE(SUM(o.subtotal), 0) AS gross_sales
FROM calendar cal
LEFT JOIN orders o ON DATE(o.placed_at) = cal.day
                  AND o.restaurant_id = 2
                  AND o.order_status = 'DELIVERED'
GROUP BY cal.day
ORDER BY cal.day;

-- R2. Demand curve: delivered orders for every hour of the day (0-23)
WITH RECURSIVE hours (h) AS (
    SELECT 0
    UNION ALL
    SELECT h + 1 FROM hours WHERE h < 23
)
SELECT h AS hour_of_day, COUNT(o.order_id) AS orders
FROM hours
LEFT JOIN orders o ON HOUR(o.placed_at) = h AND o.order_status = 'DELIVERED'
GROUP BY h
ORDER BY h;

-- R3. Every possible path through the order lifecycle (BR-12), found by walking the
--     transition graph recursively from PLACED until no further move exists.
WITH RECURSIVE transition (from_status, to_status) AS (
    SELECT 'PLACED', 'CONFIRMED'      UNION ALL
    SELECT 'PLACED', 'CANCELLED'      UNION ALL
    SELECT 'CONFIRMED', 'PREPARING'   UNION ALL
    SELECT 'PREPARING', 'READY'       UNION ALL
    SELECT 'READY', 'PICKED_UP'       UNION ALL
    SELECT 'PICKED_UP', 'DELIVERED'
),
lifecycle (status, step, path) AS (
    SELECT CAST('PLACED' AS CHAR(12)), 1, CAST('PLACED' AS CHAR(200))
    UNION ALL
    SELECT t.to_status, l.step + 1, CONCAT(l.path, ' -> ', t.to_status)
    FROM lifecycle l
    JOIN transition t ON t.from_status = l.status
)
SELECT step, status, path
FROM lifecycle
WHERE status NOT IN (SELECT from_status FROM transition)   -- end states only
ORDER BY step;

-- R4. Running total of platform revenue (commission) by day for the last week (CTE + window)
WITH daily AS (
    SELECT DATE(placed_at) AS day, SUM(commission_amount) AS commission
    FROM orders
    WHERE order_status = 'DELIVERED' AND placed_at >= CURDATE() - INTERVAL 7 DAY
    GROUP BY DATE(placed_at)
)
SELECT day, commission,
       SUM(commission) OVER (ORDER BY day) AS running_total
FROM daily
ORDER BY day;
