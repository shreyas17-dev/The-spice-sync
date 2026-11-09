-- =====================================================================
--  04_procedures.sql : stored procedures (transactions + business rules)
--  Every procedure checks that the caller owns the row it touches, so the
--  app can grant EXECUTE per role instead of raw table privileges.
-- =====================================================================
USE food_delivery;
DROP PROCEDURE IF EXISTS sp_place_order;
DROP PROCEDURE IF EXISTS sp_cancel_order;
DROP PROCEDURE IF EXISTS sp_assign_delivery_tx;
DROP PROCEDURE IF EXISTS sp_assign_delivery;
DROP PROCEDURE IF EXISTS sp_restaurant_update_order;
DROP PROCEDURE IF EXISTS sp_partner_update_delivery;
DROP PROCEDURE IF EXISTS sp_add_review;
DROP PROCEDURE IF EXISTS sp_restaurant_sales_report;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Checkout. p_items is a JSON array such as [{"item_id":12,"qty":2}, ...]
-- Runs as one transaction: order, order lines, bill and payment.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_place_order(
  IN  p_customer_id   INT UNSIGNED,
  IN  p_address_no    TINYINT UNSIGNED,
  IN  p_restaurant_id INT UNSIGNED,
  IN  p_items         JSON,
  IN  p_coupon_code   VARCHAR(20),
  IN  p_method        VARCHAR(12),
  IN  p_instructions  VARCHAR(255),
  OUT p_order_id      INT UNSIGNED)
BEGIN
  DECLARE v_status      VARCHAR(12);
  DECLARE v_open, v_close TIME;
  DECLARE v_rlat, v_rlong, v_alat, v_along DECIMAL(9,6);
  DECLARE v_commission  DECIMAL(5,2);
  DECLARE v_km          DECIMAL(7,2);
  DECLARE v_lines, v_inserted INT;
  DECLARE v_subtotal    DECIMAL(10,2);
  DECLARE v_coupon_id   INT UNSIGNED DEFAULT NULL;
  DECLARE v_discount    DECIMAL(10,2) DEFAULT 0;
  DECLARE v_tax, v_fee, v_total DECIMAL(10,2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  -- the customer must be active
  IF NOT EXISTS (SELECT 1 FROM customer WHERE customer_id = p_customer_id AND status = 'ACTIVE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer account is not active';
  END IF;

  -- BR-2 / BR-4: restaurant approved and open right now
  SELECT status, opening_time, closing_time, latitude, longitude, commission_pct
    INTO v_status, v_open, v_close, v_rlat, v_rlong, v_commission
    FROM restaurant WHERE restaurant_id = p_restaurant_id;
  IF v_status IS NULL OR v_status <> 'ACTIVE' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Restaurant is not accepting orders';
  END IF;
  IF NOT fn_is_open(v_open, v_close, CURTIME()) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Restaurant is closed right now';
  END IF;

  -- BR-13: the address must be one of this customer's, and within 8 km (BR-4)
  SELECT latitude, longitude INTO v_alat, v_along
    FROM address WHERE customer_id = p_customer_id AND address_no = p_address_no;
  IF v_alat IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delivery address not found for this customer';
  END IF;
  SET v_km = fn_distance_km(v_rlat, v_rlong, v_alat, v_along);
  IF v_km > 8 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Address is outside the 8 km delivery radius';
  END IF;

  START TRANSACTION;

  INSERT INTO orders (customer_id, address_no, restaurant_id, special_instructions)
  VALUES (p_customer_id, p_address_no, p_restaurant_id, NULLIF(p_instructions, ''));
  SET p_order_id = LAST_INSERT_ID();

  -- BR-6: copy today's menu price into each order line
  INSERT INTO order_item (order_id, line_no, item_id, quantity, unit_price)
  SELECT p_order_id, jt.line_no, m.item_id, jt.qty, m.price
    FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
           line_no FOR ORDINALITY,
           item_id INT UNSIGNED      PATH '$.item_id',
           qty     SMALLINT UNSIGNED PATH '$.qty')) AS jt
    JOIN menu_item m ON m.item_id = jt.item_id
   WHERE m.restaurant_id = p_restaurant_id
     AND m.is_available = TRUE;
  SET v_inserted = ROW_COUNT();
  SET v_lines = JSON_LENGTH(p_items);

  IF v_lines = 0 OR v_inserted <> v_lines THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Some items are unavailable or belong to another restaurant';
  END IF;

  -- BR-7
  SELECT SUM(quantity * unit_price) INTO v_subtotal FROM order_item WHERE order_id = p_order_id;

  -- BR-8: validate the coupon (the usage count is a correlated subquery)
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT c.coupon_id,
           CASE WHEN c.discount_type = 'PERCENT'
                THEN LEAST(ROUND(v_subtotal * c.discount_value / 100, 2), COALESCE(c.max_discount, v_subtotal))
                ELSE LEAST(c.discount_value, v_subtotal)
           END
      INTO v_coupon_id, v_discount
      FROM coupon c
     WHERE c.code = p_coupon_code
       AND c.status = 'ACTIVE'
       AND NOW() BETWEEN c.valid_from AND c.valid_to
       AND v_subtotal >= c.min_order_value
       AND (c.restaurant_id IS NULL OR c.restaurant_id = p_restaurant_id)
       AND (SELECT COUNT(*) FROM orders o
             WHERE o.coupon_id = c.coupon_id AND o.order_status <> 'CANCELLED') < c.usage_limit;
    IF v_coupon_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Coupon is not valid for this order';
    END IF;
  END IF;

  -- BR-9, BR-10, BR-11
  SET v_tax   = ROUND((v_subtotal - v_discount) * 0.05, 2);
  SET v_fee   = fn_delivery_fee(v_subtotal, v_km);
  SET v_total = v_subtotal - v_discount + v_tax + v_fee;

  UPDATE orders
     SET subtotal = v_subtotal,
         discount_amount = v_discount,
         tax_amount = v_tax,
         delivery_fee = v_fee,
         coupon_id = v_coupon_id,
         commission_amount = ROUND(v_subtotal * v_commission / 100, 2)
   WHERE order_id = p_order_id;

  -- BR-14: one payment row per order
  INSERT INTO payment (order_id, method, amount, payment_status, transaction_ref, paid_at)
  VALUES (p_order_id, p_method, v_total,
          IF(p_method = 'COD', 'PENDING', 'SUCCESS'),
          IF(p_method = 'COD', NULL, CONCAT('TXN', LPAD(p_order_id, 8, '0'), UPPER(LEFT(MD5(RAND()), 6)))),
          IF(p_method = 'COD', NULL, NOW()));

  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- Customer cancels (allowed only while PLACED; the status trigger enforces it)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_cancel_order(IN p_order_id INT UNSIGNED, IN p_customer_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = p_order_id AND customer_id = p_customer_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found';
  END IF;
  UPDATE orders SET order_status = 'CANCELLED' WHERE order_id = p_order_id;
END$$

-- ---------------------------------------------------------------------
-- BR-15 assignment logic, without its own transaction (caller owns it).
-- p_partner_hint is the nearest partner found in Redis (may be NULL).
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_assign_delivery_tx(
  IN  p_order_id     INT UNSIGNED,
  IN  p_partner_hint INT UNSIGNED,
  OUT p_partner_id   INT UNSIGNED)
BEGIN
  DECLARE v_rlat, v_rlong, v_alat, v_along DECIMAL(9,6);
  DECLARE v_km DECIMAL(7,2);
  SET p_partner_id = NULL;

  IF EXISTS (SELECT 1 FROM delivery WHERE order_id = p_order_id AND delivery_status <> 'CANCELLED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order already has a delivery partner';
  END IF;

  SELECT r.latitude, r.longitude, a.latitude, a.longitude
    INTO v_rlat, v_rlong, v_alat, v_along
    FROM orders o
    JOIN restaurant r ON r.restaurant_id = o.restaurant_id
    JOIN address a    ON a.customer_id = o.customer_id AND a.address_no = o.address_no
   WHERE o.order_id = p_order_id;

  -- the Redis hint wins if it is still eligible; otherwise nearest, then best rated
  SELECT p.partner_id INTO p_partner_id
    FROM delivery_partner p
   WHERE p.status = 'ACTIVE'
     AND p.availability = 'ONLINE'
     AND p.cur_lat IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM delivery d
                      WHERE d.partner_id = p.partner_id
                        AND d.delivery_status IN ('ASSIGNED','PICKED_UP'))
     AND fn_distance_km(v_rlat, v_rlong, p.cur_lat, p.cur_long) <= 5
   ORDER BY (p.partner_id = p_partner_hint) DESC,
            fn_distance_km(v_rlat, v_rlong, p.cur_lat, p.cur_long),
            (SELECT AVG(rv.delivery_rating) FROM delivery d2
               JOIN review rv ON rv.order_id = d2.order_id
              WHERE d2.partner_id = p.partner_id) DESC
   LIMIT 1
   FOR UPDATE OF p SKIP LOCKED;

  IF p_partner_id IS NOT NULL THEN
    SET v_km = fn_distance_km(v_rlat, v_rlong, v_alat, v_along);
    INSERT INTO delivery (order_id, partner_id, distance_km, partner_earning)
    VALUES (p_order_id, p_partner_id, v_km, fn_partner_earning(v_km));
    UPDATE delivery_partner SET availability = 'BUSY' WHERE partner_id = p_partner_id;
  END IF;
END$$

-- Stand-alone wrapper (used to retry when nobody was free at confirmation time)
CREATE PROCEDURE sp_assign_delivery(
  IN  p_order_id     INT UNSIGNED,
  IN  p_partner_hint INT UNSIGNED,
  OUT p_partner_id   INT UNSIGNED)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = p_order_id
                  AND order_status IN ('CONFIRMED','PREPARING','READY')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only confirmed orders can be assigned';
  END IF;
  START TRANSACTION;
  CALL sp_assign_delivery_tx(p_order_id, p_partner_hint, p_partner_id);
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- Restaurant owner moves an order forward (or rejects it)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_restaurant_update_order(
  IN  p_order_id     INT UNSIGNED,
  IN  p_owner_id     INT UNSIGNED,
  IN  p_new_status   VARCHAR(12),
  IN  p_partner_hint INT UNSIGNED,
  OUT p_partner_id   INT UNSIGNED)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  SET p_partner_id = NULL;

  IF NOT EXISTS (SELECT 1 FROM orders o JOIN restaurant r ON r.restaurant_id = o.restaurant_id
                  WHERE o.order_id = p_order_id AND r.owner_id = p_owner_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order does not belong to your restaurant';
  END IF;
  IF p_new_status NOT IN ('CONFIRMED','PREPARING','READY','CANCELLED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A restaurant can only confirm, prepare, mark ready or reject';
  END IF;

  START TRANSACTION;
  UPDATE orders SET order_status = p_new_status WHERE order_id = p_order_id;
  IF p_new_status = 'CONFIRMED' THEN
    CALL sp_assign_delivery_tx(p_order_id, p_partner_hint, p_partner_id);
  END IF;
  COMMIT;
END$$

-- ---------------------------------------------------------------------
-- Delivery partner marks pickup / delivery. The AFTER UPDATE trigger on
-- orders keeps DELIVERY, PAYMENT, partner availability and loyalty in sync.
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_partner_update_delivery(
  IN p_order_id   INT UNSIGNED,
  IN p_partner_id INT UNSIGNED,
  IN p_new_status VARCHAR(12))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM delivery WHERE order_id = p_order_id AND partner_id = p_partner_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This delivery is not assigned to you';
  END IF;
  IF p_new_status NOT IN ('PICKED_UP','DELIVERED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A partner can only mark an order picked up or delivered';
  END IF;
  UPDATE orders SET order_status = p_new_status WHERE order_id = p_order_id;
END$$

-- ---------------------------------------------------------------------
-- Customer reviews a delivered order (the review trigger re-checks status)
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_add_review(
  IN p_order_id INT UNSIGNED, IN p_customer_id INT UNSIGNED,
  IN p_food TINYINT UNSIGNED, IN p_delivery TINYINT UNSIGNED, IN p_comment VARCHAR(500))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE order_id = p_order_id AND customer_id = p_customer_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found';
  END IF;
  INSERT INTO review (order_id, food_rating, delivery_rating, comment)
  VALUES (p_order_id, p_food, p_delivery, NULLIF(p_comment, ''));
END$$

-- ---------------------------------------------------------------------
-- Owner dashboard (core query Q3). Returns two result sets:
--  1) one row per day in the range, including days with no orders
--     (recursive CTE generates the calendar)
--  2) top 5 dishes by quantity sold, ranked with a window function
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_restaurant_sales_report(
  IN p_restaurant_id INT UNSIGNED, IN p_from DATE, IN p_to DATE)
BEGIN
  WITH RECURSIVE calendar (day) AS (
      SELECT p_from
      UNION ALL
      SELECT day + INTERVAL 1 DAY FROM calendar WHERE day < p_to
  ),
  daily AS (
      SELECT DATE(o.placed_at) AS day,
             COUNT(*)                                   AS orders,
             SUM(o.subtotal)                            AS gross_sales,
             SUM(o.commission_amount)                   AS commission,
             SUM(o.subtotal - o.commission_amount
                 - CASE WHEN c.restaurant_id IS NOT NULL THEN o.discount_amount ELSE 0 END) AS net_payout
        FROM orders o
        LEFT JOIN coupon c ON c.coupon_id = o.coupon_id
       WHERE o.restaurant_id = p_restaurant_id
         AND o.order_status = 'DELIVERED'
         AND DATE(o.placed_at) BETWEEN p_from AND p_to
       GROUP BY DATE(o.placed_at)
  )
  SELECT cal.day,
         COALESCE(d.orders, 0)      AS orders,
         COALESCE(d.gross_sales, 0) AS gross_sales,
         COALESCE(d.commission, 0)  AS commission,
         COALESCE(d.net_payout, 0)  AS net_payout
    FROM calendar cal
    LEFT JOIN daily d ON d.day = cal.day
   ORDER BY cal.day;

  SELECT ranked.item_id, ranked.name, ranked.qty_sold, ranked.revenue, ranked.sales_rank
    FROM (SELECT m.item_id, m.name,
                 SUM(oi.quantity)   AS qty_sold,
                 SUM(oi.item_total) AS revenue,
                 RANK() OVER (ORDER BY SUM(oi.quantity) DESC) AS sales_rank
            FROM order_item oi
            JOIN orders o    ON o.order_id = oi.order_id
            JOIN menu_item m ON m.item_id = oi.item_id
           WHERE o.restaurant_id = p_restaurant_id
             AND o.order_status = 'DELIVERED'
             AND DATE(o.placed_at) BETWEEN p_from AND p_to
           GROUP BY m.item_id, m.name) AS ranked
   WHERE ranked.sales_rank <= 5
   ORDER BY ranked.sales_rank;
END$$

DELIMITER ;
