-- =====================================================================
--  03_functions.sql : stored functions used by queries and procedures
-- =====================================================================
USE food_delivery;
DROP FUNCTION IF EXISTS fn_distance_km;
DROP FUNCTION IF EXISTS fn_is_open;
DROP FUNCTION IF EXISTS fn_delivery_fee;
DROP FUNCTION IF EXISTS fn_partner_earning;
DROP FUNCTION IF EXISTS fn_eta_minutes;
DROP FUNCTION IF EXISTS fn_restaurant_revenue;

DELIMITER $$

-- Great-circle distance between two points (haversine formula), in km
CREATE FUNCTION fn_distance_km(lat1 DECIMAL(9,6), lon1 DECIMAL(9,6),
                               lat2 DECIMAL(9,6), lon2 DECIMAL(9,6))
RETURNS DECIMAL(7,2)
DETERMINISTIC NO SQL
BEGIN
  DECLARE a DOUBLE;
  SET a = POWER(SIN(RADIANS(lat2 - lat1) / 2), 2)
        + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * POWER(SIN(RADIANS(lon2 - lon1) / 2), 2);
  RETURN ROUND(6371 * 2 * ASIN(SQRT(a)), 2);
END$$

-- Is a restaurant open at time t? Handles kitchens that close after midnight.
CREATE FUNCTION fn_is_open(p_open TIME, p_close TIME, p_at TIME)
RETURNS BOOLEAN
DETERMINISTIC NO SQL
BEGIN
  IF p_open <= p_close THEN
    RETURN p_at BETWEEN p_open AND p_close;
  END IF;
  RETURN p_at >= p_open OR p_at <= p_close;
END$$

-- BR-10: free above Rs 499, otherwise Rs 25 + Rs 5 per km beyond the first 2 km
CREATE FUNCTION fn_delivery_fee(p_subtotal DECIMAL(10,2), p_km DECIMAL(7,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC NO SQL
BEGIN
  IF p_subtotal >= 499 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(25 + 5 * GREATEST(p_km - 2, 0), 2);
END$$

-- BR-16: Rs 20 per trip + Rs 7 per km
CREATE FUNCTION fn_partner_earning(p_km DECIMAL(7,2))
RETURNS DECIMAL(8,2)
DETERMINISTIC NO SQL
BEGIN
  RETURN ROUND(20 + 7 * p_km, 2);
END$$

-- Estimated delivery time shown on the restaurant card: prep time + 4 min/km + 5 min buffer
CREATE FUNCTION fn_eta_minutes(p_prep SMALLINT UNSIGNED, p_km DECIMAL(7,2))
RETURNS INT
DETERMINISTIC NO SQL
BEGIN
  RETURN p_prep + CEIL(p_km * 4) + 5;
END$$

-- Net revenue of a restaurant between two dates (BR-19)
CREATE FUNCTION fn_restaurant_revenue(p_restaurant_id INT UNSIGNED, p_from DATE, p_to DATE)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  DECLARE v_net DECIMAL(12,2);
  SELECT COALESCE(SUM(o.subtotal - o.commission_amount
                      - CASE WHEN c.restaurant_id IS NOT NULL THEN o.discount_amount ELSE 0 END), 0)
    INTO v_net
    FROM orders o
    LEFT JOIN coupon c ON c.coupon_id = o.coupon_id
   WHERE o.restaurant_id = p_restaurant_id
     AND o.order_status = 'DELIVERED'
     AND DATE(o.placed_at) BETWEEN p_from AND p_to;
  RETURN v_net;
END$$

DELIMITER ;
