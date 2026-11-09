-- =====================================================================
--  setup_all.sql : builds the whole database in one go (run as root)
--  Used by setup-database.bat. Run from the project folder:
--     mysql -u root -p -e "source database/setup_all.sql"
-- =====================================================================
-- binary logging is on by default in MySQL 8; allow our functions and triggers
SET GLOBAL log_bin_trust_function_creators = 1;
SELECT 'Creating tables ...' AS step;
source database/01_schema.sql
SELECT 'Creating views ...' AS step;
source database/02_views.sql
SELECT 'Creating functions ...' AS step;
source database/03_functions.sql
SELECT 'Creating procedures ...' AS step;
source database/04_procedures.sql
SELECT 'Creating triggers ...' AS step;
source database/05_triggers.sql
SELECT 'Creating roles and app accounts ...' AS step;
source database/06_roles.sql
SELECT 'Loading sample data ...' AS step;
source database/07_seed.sql
USE food_delivery;
SELECT 'Row counts' AS step;
SELECT (SELECT COUNT(*) FROM restaurant) AS restaurants, (SELECT COUNT(*) FROM menu_item) AS dishes,
       (SELECT COUNT(*) FROM customer) AS customers, (SELECT COUNT(*) FROM orders) AS orders,
       (SELECT COUNT(*) FROM delivery_partner) AS partners;
SELECT 'DONE' AS step;
