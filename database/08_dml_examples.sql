-- =====================================================================
--  08_dml_examples.sql : INSERT / UPDATE / DELETE on the seeded database
--  Run after 07_seed.sql. IDs refer to rows created by the seed script.
-- =====================================================================
USE food_delivery;

-- ---------------------------------------------------------------------
-- INSERT
-- ---------------------------------------------------------------------

-- 1. A new customer signs up (loyalty_points and status take their defaults)
INSERT INTO customer (full_name, email, phone, password_hash, date_of_birth)
VALUES ('Meghna Pai', 'meghna.pai@example.com', '9845012345',
        
        'scrypt$5f1c0e9a2b7d4c3e8f6a1b2c3d4e5f60$7fbd281dcf8fb82e39e0d4b64e058c788e1b90e1e955692f49856a5bcae6400597f947d4a7c0fb8ab5524cf6b8ebcd0eeab564d6c04620c256de4e9617c5d032', '2001-04-17');
SET @cid = LAST_INSERT_ID();

-- 2. Two addresses. address_no is left as 0, so trigger trg_address_number numbers them 1 and 2
INSERT INTO address (customer_id, label, address_line, pincode, latitude, longitude, is_default)
VALUES (@cid, 'Home', '22, 4th Block, 100 Feet Road, Koramangala', '560034', 12.933800, 77.626200, TRUE),
       (@cid, 'Work', 'Prestige Tech Park, Outer Ring Road, Bellandur', '560103', 12.928100, 77.680400, FALSE);
SELECT customer_id, address_no, label, pincode FROM address WHERE customer_id = @cid;

-- 3. Biryani Bhavan (owner 2) adds a new dish
INSERT INTO menu_item (restaurant_id, name, description, category, price, is_veg)
VALUES (2, 'Chicken Kheema Biryani', 'Biryani layered with spiced chicken mince', 'Biryani', 309.00, FALSE);

-- 4. An admin creates a weekend coupon valid for the next 30 days
INSERT INTO coupon (code, description, discount_type, discount_value, max_discount, min_order_value,
                    valid_from, valid_to, usage_limit)
VALUES ('WEEKEND15', '15% off up to Rs 80 on weekend orders', 'PERCENT', 15, 80, 249,
        NOW(), NOW() + INTERVAL 30 DAY, 2000);

-- 5. A new owner registers a restaurant; it starts as PENDING until an admin approves it
INSERT INTO restaurant (owner_id, name, phone, address_line, pincode, latitude, longitude,
                        opening_time, closing_time, avg_prep_time, cost_for_two)
VALUES (6, 'Kulfi Junction', '08041234599', '18, Church Street, MG Road', '560001',
        12.974900, 77.605700, '12:00:00', '23:30:00', 10, 200.00);
INSERT INTO restaurant_cuisine (restaurant_id, cuisine)
VALUES (LAST_INSERT_ID(), 'Desserts'), (LAST_INSERT_ID(), 'Ice Cream');

-- 6. Constraints rejecting bad data (each statement below fails on purpose)
-- CHECK chk_coupon_dates: valid_to must be after valid_from        -> ERROR 3819
INSERT INTO coupon (code, discount_type, discount_value, valid_from, valid_to, usage_limit)
VALUES ('BADDATES', 'FLAT', 50, NOW(), NOW() - INTERVAL 1 DAY, 10);
-- CHECK chk_partner_online: an unverified partner cannot be online  -> ERROR 3819
INSERT INTO delivery_partner (full_name, email, phone, password_hash, vehicle_type, availability)
VALUES ('Test Rider', 'test.rider@example.com', '9000000001', 'x', 'BICYCLE', 'ONLINE');
-- composite FK fk_orders_address: customer 7 has no address number 9 -> ERROR 1452
INSERT INTO orders (customer_id, address_no, restaurant_id) VALUES (7, 9, 2);

-- ---------------------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------------------

-- 7. Owner raises the price of Chicken Dum Biryani (item 12) by Rs 10.
--    Old order lines keep the price that was charged (BR-6).
UPDATE menu_item SET price = price + 10 WHERE item_id = 12;
SELECT unit_price, COUNT(*) AS order_lines FROM order_item WHERE item_id = 12 GROUP BY unit_price;

-- 8. Mark a dish as sold out for the evening
UPDATE menu_item SET is_available = FALSE
 WHERE restaurant_id = 3 AND name = 'Chicken Momos';

-- 9. Admin 1 approves the pending restaurant 20 (trigger fills approved_at)
UPDATE restaurant SET status = 'ACTIVE', approved_by = 1
 WHERE restaurant_id = 20 AND status = 'PENDING';

-- 10. Admin 2 verifies delivery partner 8 (trigger fills verified_at), who then goes online
UPDATE delivery_partner SET status = 'ACTIVE', verified_by = 2 WHERE partner_id = 8;
UPDATE delivery_partner SET availability = 'ONLINE', cur_lat = 12.935200, cur_long = 77.624500
 WHERE partner_id = 8;

-- 11. Admin changes the commission of Chai & Chaat Corner
UPDATE restaurant SET commission_pct = 13.50 WHERE restaurant_id = 7;

-- 12. Housekeeping: switch off coupons whose validity has ended
UPDATE coupon SET status = 'INACTIVE' WHERE valid_to < NOW() AND status = 'ACTIVE';

-- 13. Multi-table UPDATE: suspend all restaurants of an owner whose account is blocked
UPDATE restaurant r
  JOIN restaurant_owner ow ON ow.owner_id = r.owner_id
   SET r.status = 'SUSPENDED'
 WHERE ow.status = 'BLOCKED' AND r.status = 'ACTIVE';

-- ---------------------------------------------------------------------
-- DELETE
-- ---------------------------------------------------------------------

-- 14. Customer 13 removes an address that was never used for an order
DELETE FROM address WHERE customer_id = 13 AND address_no = 2;

-- 15. Removing an address that past orders point to is refused     -> ERROR 1451
DELETE FROM address WHERE customer_id = 7 AND address_no = 1;

-- 16. Green Bowl Cafe drops a dish that nobody ever ordered
DELETE FROM menu_item WHERE item_id = 45
   AND NOT EXISTS (SELECT 1 FROM order_item WHERE item_id = 45);

-- 17. Delete an expired, never-used coupon
DELETE FROM coupon
 WHERE code = 'MONSOON30'
   AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.coupon_id = coupon.coupon_id);

-- 18. Remove a cuisine tag (multivalued attribute row)
DELETE FROM restaurant_cuisine WHERE restaurant_id = 5 AND cuisine = 'Continental';

-- ---------------------------------------------------------------------
-- Transaction control
-- ---------------------------------------------------------------------

-- 19. Try a 10% price rise on all of Pizza Piazza's pizzas, look at it, then undo it
START TRANSACTION;
UPDATE menu_item SET price = ROUND(price * 1.10, 0) WHERE restaurant_id = 4 AND category = 'Pizza';
SELECT name, price FROM menu_item WHERE restaurant_id = 4 AND category = 'Pizza';
ROLLBACK;
