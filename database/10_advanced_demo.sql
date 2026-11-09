-- =====================================================================
--  10_advanced_demo.sql : walk one order through its whole life using the
--  stored procedures, functions and triggers. Run during restaurant hours
--  (Biryani Bhavan is open 11:00 - 23:30).
-- =====================================================================
USE food_delivery;

-- Functions on their own
SELECT fn_distance_km(12.927642, 77.584314, 12.935200, 77.624500) AS km_jayanagar_to_koramangala,
       fn_delivery_fee(350.00, 4.82)  AS fee_small_order,
       fn_delivery_fee(650.00, 4.82)  AS fee_big_order,
       fn_partner_earning(4.82)       AS rider_pay,
       fn_eta_minutes(25, 4.82)       AS eta_minutes,
       fn_is_open('11:00', '01:00', '00:30') AS pizza_open_at_half_past_midnight;

-- 1. Customer 7 checks out from Biryani Bhavan with coupon BIRYANI15, paying by UPI
CALL sp_place_order(7, 1, 2,
     '[{"item_id": 12, "qty": 2}, {"item_id": 17, "qty": 1}, {"item_id": 20, "qty": 2}]',
     'BIRYANI15', 'UPI', 'Less spicy please', @oid);
SELECT @oid AS new_order;
SELECT order_id, order_status, subtotal, discount_amount, tax_amount, delivery_fee,
       commission_amount, total_amount
  FROM orders WHERE order_id = @oid;
SELECT line_no, item_id, quantity, unit_price, item_total FROM order_item WHERE order_id = @oid;
SELECT method, amount, payment_status, transaction_ref FROM payment WHERE order_id = @oid;

-- 2. Owner 2 confirms. Redis suggested partner 3 as nearest; the procedure re-checks
--    eligibility in SQL, inserts the DELIVERY row and marks the partner BUSY.
CALL sp_restaurant_update_order(@oid, 2, 'CONFIRMED', 3, @pid);
SELECT @pid AS assigned_partner;
SELECT partner_id, availability FROM delivery_partner WHERE partner_id = @pid;

CALL sp_restaurant_update_order(@oid, 2, 'PREPARING', NULL, @ignore);
CALL sp_restaurant_update_order(@oid, 2, 'READY', NULL, @ignore);

-- 3. The partner picks up and delivers. The AFTER UPDATE trigger on orders updates
--    DELIVERY timestamps, frees the partner and adds loyalty points.
CALL sp_partner_update_delivery(@oid, @pid, 'PICKED_UP');
CALL sp_partner_update_delivery(@oid, @pid, 'DELIVERED');
SELECT delivery_status, assigned_at, picked_up_at, delivered_at, distance_km, partner_earning
  FROM delivery WHERE order_id = @oid;
SELECT availability FROM delivery_partner WHERE partner_id = @pid;      -- back to ONLINE
SELECT loyalty_points FROM customer WHERE customer_id = 7;

-- 4. Review after delivery
CALL sp_add_review(@oid, 7, 5, 4, 'Biryani was perfect, rider was quick.');

-- 5. Rules enforced by triggers and procedures (each call below fails on purpose)
UPDATE orders SET order_status = 'PREPARING' WHERE order_id = @oid;   -- Illegal order status change
CALL sp_cancel_order(@oid, 7);                                        -- cannot cancel a delivered order
CALL sp_add_review(753, 59, 4, 4, 'too early');                        -- Only delivered orders can be reviewed
UPDATE order_item SET quantity = 5 WHERE order_id = @oid AND line_no = 1; -- lines are frozen
CALL sp_partner_update_delivery(@oid, 99, 'DELIVERED');               -- not assigned to you

-- 6. Owner dashboard: daily calendar (recursive CTE) and top dishes (window function)
CALL sp_restaurant_sales_report(2, CURDATE() - INTERVAL 13 DAY, CURDATE());
SELECT fn_restaurant_revenue(2, CURDATE() - INTERVAL 30 DAY, CURDATE()) AS net_revenue_30_days;
