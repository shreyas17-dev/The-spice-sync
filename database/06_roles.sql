-- =====================================================================
--  06_roles.sql : role-based access control inside MySQL
--  One database role per kind of user. The Next.js API connects with a
--  different MySQL account depending on who is logged in, so even a bug
--  in the app cannot let a customer touch another role's data.
--  Run as root (or any account with CREATE ROLE / CREATE USER).
-- =====================================================================
USE food_delivery;

DROP ROLE IF EXISTS 'fd_customer', 'fd_owner', 'fd_partner', 'fd_admin';
CREATE ROLE 'fd_customer', 'fd_owner', 'fd_partner', 'fd_admin';

-- ---------- customer ----------
GRANT SELECT ON food_delivery.pincode             TO 'fd_customer';
GRANT SELECT ON food_delivery.restaurant          TO 'fd_customer';
GRANT SELECT ON food_delivery.restaurant_cuisine  TO 'fd_customer';
GRANT SELECT ON food_delivery.menu_item           TO 'fd_customer';
GRANT SELECT ON food_delivery.coupon              TO 'fd_customer';
GRANT SELECT ON food_delivery.v_restaurant_rating TO 'fd_customer';
GRANT SELECT ON food_delivery.customer TO 'fd_customer';                      -- login
-- sign-up may only fill these columns; loyalty_points and status keep their defaults
GRANT INSERT (full_name, email, phone, password_hash, date_of_birth) ON food_delivery.customer TO 'fd_customer';
GRANT UPDATE (full_name, phone, date_of_birth) ON food_delivery.customer TO 'fd_customer';
GRANT SELECT ON food_delivery.v_customer_profile  TO 'fd_customer';
GRANT SELECT, INSERT, UPDATE, DELETE ON food_delivery.address TO 'fd_customer';
GRANT SELECT ON food_delivery.orders              TO 'fd_customer';
GRANT SELECT ON food_delivery.order_item          TO 'fd_customer';
GRANT SELECT ON food_delivery.payment             TO 'fd_customer';
GRANT SELECT ON food_delivery.delivery            TO 'fd_customer';
GRANT SELECT ON food_delivery.review              TO 'fd_customer';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_place_order  TO 'fd_customer';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_cancel_order TO 'fd_customer';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_add_review   TO 'fd_customer';
GRANT EXECUTE ON FUNCTION  food_delivery.fn_distance_km  TO 'fd_customer';
GRANT EXECUTE ON FUNCTION  food_delivery.fn_is_open      TO 'fd_customer';
GRANT EXECUTE ON FUNCTION  food_delivery.fn_eta_minutes  TO 'fd_customer';
GRANT EXECUTE ON FUNCTION  food_delivery.fn_delivery_fee TO 'fd_customer';
-- the tracking page shows the rider's name, phone, vehicle and position, nothing else
GRANT SELECT (partner_id, full_name, phone, vehicle_type, vehicle_number, cur_lat, cur_long)
      ON food_delivery.delivery_partner TO 'fd_customer';
GRANT SELECT ON food_delivery.v_partner_stats     TO 'fd_customer';

-- ---------- restaurant owner ----------
GRANT SELECT, INSERT ON food_delivery.restaurant_owner TO 'fd_owner';
GRANT SELECT ON food_delivery.restaurant TO 'fd_owner';
-- a new restaurant cannot set its own status, commission or approval, so it starts PENDING
GRANT INSERT (owner_id, name, phone, address_line, pincode, latitude, longitude,
              opening_time, closing_time, avg_prep_time, cost_for_two)
      ON food_delivery.restaurant TO 'fd_owner';
-- column privileges: an owner can edit operating details but never status or commission
GRANT UPDATE (name, phone, opening_time, closing_time, avg_prep_time, cost_for_two)
      ON food_delivery.restaurant TO 'fd_owner';
GRANT SELECT, INSERT, DELETE ON food_delivery.restaurant_cuisine TO 'fd_owner';
GRANT SELECT, INSERT, UPDATE, DELETE ON food_delivery.menu_item TO 'fd_owner';
GRANT SELECT, INSERT, UPDATE ON food_delivery.coupon TO 'fd_owner';
GRANT SELECT ON food_delivery.pincode             TO 'fd_owner';
GRANT SELECT ON food_delivery.v_restaurant_orders TO 'fd_owner';
GRANT SELECT ON food_delivery.v_restaurant_rating TO 'fd_owner';
GRANT SELECT ON food_delivery.order_item          TO 'fd_owner';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_restaurant_update_order TO 'fd_owner';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_assign_delivery         TO 'fd_owner';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_restaurant_sales_report TO 'fd_owner';
GRANT EXECUTE ON FUNCTION  food_delivery.fn_restaurant_revenue      TO 'fd_owner';
GRANT EXECUTE ON FUNCTION  food_delivery.fn_is_open                 TO 'fd_owner';

-- ---------- delivery partner ----------
GRANT SELECT ON food_delivery.delivery_partner TO 'fd_partner';
-- sign-up cannot mark itself verified or online
GRANT INSERT (full_name, email, phone, password_hash, vehicle_type, vehicle_number, license_no)
      ON food_delivery.delivery_partner TO 'fd_partner';
GRANT UPDATE (availability, cur_lat, cur_long, phone, vehicle_type, vehicle_number, license_no)
      ON food_delivery.delivery_partner TO 'fd_partner';
GRANT SELECT ON food_delivery.v_delivery_task  TO 'fd_partner';
GRANT SELECT ON food_delivery.v_partner_stats  TO 'fd_partner';
GRANT EXECUTE ON PROCEDURE food_delivery.sp_partner_update_delivery TO 'fd_partner';

-- ---------- admin ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON food_delivery.* TO 'fd_admin';
GRANT EXECUTE ON food_delivery.* TO 'fd_admin';

-- ---------------------------------------------------------------------
-- Application accounts, one per role (change the passwords!)
-- ---------------------------------------------------------------------
DROP USER IF EXISTS 'fd_app_customer'@'localhost', 'fd_app_owner'@'localhost',
                    'fd_app_partner'@'localhost',  'fd_app_admin'@'localhost';
CREATE USER 'fd_app_customer'@'localhost' IDENTIFIED BY 'Cust#2026app';
CREATE USER 'fd_app_owner'@'localhost'    IDENTIFIED BY 'Owner#2026app';
CREATE USER 'fd_app_partner'@'localhost'  IDENTIFIED BY 'Partner#2026app';
CREATE USER 'fd_app_admin'@'localhost'    IDENTIFIED BY 'Admin#2026app';

GRANT 'fd_customer' TO 'fd_app_customer'@'localhost';
GRANT 'fd_owner'    TO 'fd_app_owner'@'localhost';
GRANT 'fd_partner'  TO 'fd_app_partner'@'localhost';
GRANT 'fd_admin'    TO 'fd_app_admin'@'localhost';

SET DEFAULT ROLE 'fd_customer' TO 'fd_app_customer'@'localhost';
SET DEFAULT ROLE 'fd_owner'    TO 'fd_app_owner'@'localhost';
SET DEFAULT ROLE 'fd_partner'  TO 'fd_app_partner'@'localhost';
SET DEFAULT ROLE 'fd_admin'    TO 'fd_app_admin'@'localhost';

-- Quick check
SHOW GRANTS FOR 'fd_owner';
