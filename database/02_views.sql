-- =====================================================================
--  02_views.sql : derived attributes and role-specific views
-- =====================================================================
USE food_delivery;

-- CUSTOMER.age (derived from date_of_birth)
CREATE OR REPLACE VIEW v_customer_profile AS
SELECT c.customer_id, c.full_name, c.email, c.phone, c.date_of_birth,
       TIMESTAMPDIFF(YEAR, c.date_of_birth, CURDATE()) AS age,
       c.loyalty_points, c.status, c.created_at
FROM customer c;

-- RESTAURANT.rating_avg (derived from reviews of its orders)
CREATE OR REPLACE VIEW v_restaurant_rating AS
SELECT r.restaurant_id,
       ROUND(AVG(rv.food_rating), 1) AS rating_avg,
       COUNT(rv.review_id)           AS rating_count
FROM restaurant r
LEFT JOIN orders o  ON o.restaurant_id = r.restaurant_id
LEFT JOIN review rv ON rv.order_id = o.order_id
GROUP BY r.restaurant_id;

-- DELIVERY_PARTNER.rating_avg and total_earnings
CREATE OR REPLACE VIEW v_partner_stats AS
SELECT p.partner_id, p.full_name,
       ROUND(AVG(rv.delivery_rating), 1) AS rating_avg,
       COALESCE(SUM(d.delivery_status = 'DELIVERED'), 0) AS deliveries_done,
       COALESCE(SUM(CASE WHEN d.delivery_status = 'DELIVERED' THEN d.partner_earning END), 0) AS total_earnings
FROM delivery_partner p
LEFT JOIN delivery d ON d.partner_id = p.partner_id
LEFT JOIN review rv  ON rv.order_id = d.order_id
GROUP BY p.partner_id, p.full_name;

-- What a restaurant owner sees for incoming orders (no customer email or password columns)
CREATE OR REPLACE VIEW v_restaurant_orders AS
SELECT o.order_id, o.restaurant_id, r.owner_id, o.customer_id, o.order_status, o.placed_at,
       c.full_name AS customer_name, o.special_instructions,
       o.subtotal, o.discount_amount, o.commission_amount, o.total_amount,
       (SELECT COUNT(*) FROM order_item oi WHERE oi.order_id = o.order_id) AS item_lines,
       d.partner_id, dp.full_name AS partner_name, d.delivery_status
FROM orders o
JOIN restaurant r  ON r.restaurant_id = o.restaurant_id
JOIN customer c    ON c.customer_id = o.customer_id
LEFT JOIN delivery d          ON d.order_id = o.order_id
LEFT JOIN delivery_partner dp ON dp.partner_id = d.partner_id;

-- What a delivery partner sees for a task: pickup and drop details only
CREATE OR REPLACE VIEW v_delivery_task AS
SELECT d.delivery_id, d.order_id, d.partner_id, o.customer_id, d.delivery_status, d.assigned_at,
       d.picked_up_at, d.delivered_at, d.distance_km, d.partner_earning,
       r.name AS restaurant_name, r.phone AS restaurant_phone, r.address_line AS pickup_address,
       r.latitude AS pickup_lat, r.longitude AS pickup_long,
       c.full_name AS customer_name, c.phone AS customer_phone,
       a.address_line AS drop_address, a.pincode AS drop_pincode,
       a.latitude AS drop_lat, a.longitude AS drop_long,
       o.order_status, o.total_amount, p.method AS payment_method, p.payment_status
FROM delivery d
JOIN orders o     ON o.order_id = d.order_id
JOIN restaurant r ON r.restaurant_id = o.restaurant_id
JOIN customer c   ON c.customer_id = o.customer_id
JOIN address a    ON a.customer_id = o.customer_id AND a.address_no = o.address_no
JOIN payment p    ON p.order_id = o.order_id;
