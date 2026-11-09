-- =====================================================================
--  Smart Multi-Vendor Food Delivery & Logistics Management System
--  01_schema.sql : database, tables, keys, constraints and indexes
--  Target: MySQL 8.0.16 or later (CHECK constraints, roles, JSON_TABLE)
-- =====================================================================

DROP DATABASE IF EXISTS food_delivery;
CREATE DATABASE food_delivery
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
USE food_delivery;

-- ---------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------
CREATE TABLE pincode (
  pincode  CHAR(6)     NOT NULL,
  city     VARCHAR(60) NOT NULL,
  state    VARCHAR(60) NOT NULL,
  CONSTRAINT pk_pincode PRIMARY KEY (pincode),
  CONSTRAINT chk_pincode_format CHECK (pincode REGEXP '^[1-9][0-9]{5}$')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- The four kinds of users
-- ---------------------------------------------------------------------
CREATE TABLE admin (
  admin_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  admin_level   ENUM('SUPER_ADMIN','SUPPORT') NOT NULL DEFAULT 'SUPPORT',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_admin PRIMARY KEY (admin_id),
  CONSTRAINT uq_admin_email UNIQUE (email),
  CONSTRAINT chk_admin_email CHECK (email LIKE '%_@_%._%')
) ENGINE = InnoDB;

CREATE TABLE customer (
  customer_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  phone          VARCHAR(15)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  date_of_birth  DATE NULL,
  loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,
  status         ENUM('ACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_customer PRIMARY KEY (customer_id),
  CONSTRAINT uq_customer_email UNIQUE (email),
  CONSTRAINT uq_customer_phone UNIQUE (phone),
  CONSTRAINT chk_customer_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_customer_phone CHECK (phone REGEXP '^[6-9][0-9]{9}$')
) ENGINE = InnoDB;

CREATE TABLE restaurant_owner (
  owner_id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(120) NOT NULL,
  phone           VARCHAR(15)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  pan_number      CHAR(10)     NOT NULL,
  bank_account_no VARCHAR(20)  NOT NULL,
  status          ENUM('ACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT pk_owner PRIMARY KEY (owner_id),
  CONSTRAINT uq_owner_email UNIQUE (email),
  CONSTRAINT uq_owner_phone UNIQUE (phone),
  CONSTRAINT uq_owner_pan UNIQUE (pan_number),
  CONSTRAINT chk_owner_pan CHECK (pan_number REGEXP '^[A-Z]{5}[0-9]{4}[A-Z]$')
) ENGINE = InnoDB;

CREATE TABLE delivery_partner (
  partner_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  phone          VARCHAR(15)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  vehicle_type   ENUM('BICYCLE','SCOOTER','MOTORBIKE') NOT NULL,
  vehicle_number VARCHAR(15) NULL,
  license_no     VARCHAR(20) NULL,
  availability   ENUM('OFFLINE','ONLINE','BUSY') NOT NULL DEFAULT 'OFFLINE',
  cur_lat        DECIMAL(9,6) NULL,
  cur_long       DECIMAL(9,6) NULL,
  status         ENUM('PENDING','ACTIVE','BLOCKED') NOT NULL DEFAULT 'PENDING',
  verified_by    INT UNSIGNED NULL,
  verified_at    DATETIME NULL,
  CONSTRAINT pk_partner PRIMARY KEY (partner_id),
  CONSTRAINT uq_partner_email UNIQUE (email),
  CONSTRAINT uq_partner_phone UNIQUE (phone),
  CONSTRAINT uq_partner_vehicle UNIQUE (vehicle_number),
  CONSTRAINT uq_partner_license UNIQUE (license_no),
  CONSTRAINT fk_partner_verified_by FOREIGN KEY (verified_by) REFERENCES admin (admin_id),
  -- motor vehicles need a registration number and a driving licence
  CONSTRAINT chk_partner_vehicle CHECK (vehicle_type = 'BICYCLE' OR (vehicle_number IS NOT NULL AND license_no IS NOT NULL)),
  -- BR-3: only verified (ACTIVE) partners may be online or busy
  CONSTRAINT chk_partner_online CHECK (availability = 'OFFLINE' OR status = 'ACTIVE'),
  CONSTRAINT chk_partner_verified CHECK ((verified_by IS NULL) = (verified_at IS NULL))
) ENGINE = InnoDB;

-- Weak entity: identified by (customer_id, address_no)
CREATE TABLE address (
  customer_id  INT UNSIGNED     NOT NULL,
  address_no   TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 0 = let the trigger number it
  label        VARCHAR(30)      NOT NULL DEFAULT 'Home',
  address_line VARCHAR(200)     NOT NULL,
  pincode      CHAR(6)          NOT NULL,
  latitude     DECIMAL(9,6)     NOT NULL,
  longitude    DECIMAL(9,6)     NOT NULL,
  is_default   BOOLEAN          NOT NULL DEFAULT FALSE,
  CONSTRAINT pk_address PRIMARY KEY (customer_id, address_no),
  CONSTRAINT fk_address_customer FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ON DELETE CASCADE,
  CONSTRAINT fk_address_pincode  FOREIGN KEY (pincode) REFERENCES pincode (pincode),
  CONSTRAINT chk_address_lat  CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_address_long CHECK (longitude BETWEEN -180 AND 180)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Restaurant side
-- ---------------------------------------------------------------------
CREATE TABLE restaurant (
  restaurant_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id       INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  phone          VARCHAR(15)  NOT NULL,
  address_line   VARCHAR(200) NOT NULL,
  pincode        CHAR(6)      NOT NULL,
  latitude       DECIMAL(9,6) NOT NULL,
  longitude      DECIMAL(9,6) NOT NULL,
  opening_time   TIME NOT NULL,
  closing_time   TIME NOT NULL,
  avg_prep_time  SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  cost_for_two   DECIMAL(8,2) NOT NULL,
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  status         ENUM('PENDING','ACTIVE','SUSPENDED','REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by    INT UNSIGNED NULL,
  approved_at    DATETIME NULL,
  CONSTRAINT pk_restaurant PRIMARY KEY (restaurant_id),
  CONSTRAINT fk_restaurant_owner   FOREIGN KEY (owner_id)    REFERENCES restaurant_owner (owner_id),
  CONSTRAINT fk_restaurant_pincode FOREIGN KEY (pincode)     REFERENCES pincode (pincode),
  CONSTRAINT fk_restaurant_admin   FOREIGN KEY (approved_by) REFERENCES admin (admin_id),
  CONSTRAINT chk_restaurant_commission CHECK (commission_pct BETWEEN 0 AND 50),
  CONSTRAINT chk_restaurant_cost       CHECK (cost_for_two > 0),
  CONSTRAINT chk_restaurant_prep       CHECK (avg_prep_time BETWEEN 5 AND 120),
  -- BR-2: a restaurant can be ACTIVE or SUSPENDED only after an admin approved it
  CONSTRAINT chk_restaurant_approval   CHECK (status IN ('PENDING','REJECTED') OR approved_by IS NOT NULL),
  INDEX idx_restaurant_area (pincode, status)
) ENGINE = InnoDB;

-- Multivalued attribute RESTAURANT.cuisine
CREATE TABLE restaurant_cuisine (
  restaurant_id INT UNSIGNED NOT NULL,
  cuisine       VARCHAR(40)  NOT NULL,
  CONSTRAINT pk_restaurant_cuisine PRIMARY KEY (restaurant_id, cuisine),
  CONSTRAINT fk_cuisine_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant (restaurant_id) ON DELETE CASCADE,
  INDEX idx_cuisine (cuisine)
) ENGINE = InnoDB;

CREATE TABLE menu_item (
  item_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id INT UNSIGNED NOT NULL,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(300) NULL,
  category      VARCHAR(40)  NOT NULL,
  price         DECIMAL(8,2) NOT NULL,
  is_veg        BOOLEAN NOT NULL,
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  image_url     VARCHAR(255) NULL,
  CONSTRAINT pk_menu_item PRIMARY KEY (item_id),
  CONSTRAINT fk_menu_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant (restaurant_id),
  CONSTRAINT uq_menu_name UNIQUE (restaurant_id, name),
  CONSTRAINT chk_menu_price CHECK (price > 0),
  INDEX idx_menu_available (restaurant_id, is_available)
) ENGINE = InnoDB;

CREATE TABLE coupon (
  coupon_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(20)  NOT NULL,
  description     VARCHAR(200) NULL,
  discount_type   ENUM('PERCENT','FLAT') NOT NULL,
  discount_value  DECIMAL(8,2) NOT NULL,
  max_discount    DECIMAL(8,2) NULL,
  min_order_value DECIMAL(8,2) NOT NULL DEFAULT 0,
  valid_from      DATETIME NOT NULL,
  valid_to        DATETIME NOT NULL,
  usage_limit     INT UNSIGNED NOT NULL,
  status          ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  restaurant_id   INT UNSIGNED NULL,          -- NULL = platform-wide coupon
  CONSTRAINT pk_coupon PRIMARY KEY (coupon_id),
  CONSTRAINT uq_coupon_code UNIQUE (code),
  CONSTRAINT fk_coupon_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant (restaurant_id),
  CONSTRAINT chk_coupon_value CHECK (discount_value > 0 AND (discount_type = 'FLAT' OR discount_value <= 100)),
  CONSTRAINT chk_coupon_dates CHECK (valid_to > valid_from)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Orders and everything that hangs off an order
-- ---------------------------------------------------------------------
CREATE TABLE orders (
  order_id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id          INT UNSIGNED NOT NULL,
  address_no           TINYINT UNSIGNED NOT NULL,
  restaurant_id        INT UNSIGNED NOT NULL,
  coupon_id            INT UNSIGNED NULL,
  order_status         ENUM('PLACED','CONFIRMED','PREPARING','READY','PICKED_UP','DELIVERED','CANCELLED')
                       NOT NULL DEFAULT 'PLACED',
  placed_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal             DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee         DECIMAL(10,2) NOT NULL DEFAULT 0,
  commission_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  special_instructions VARCHAR(255) NULL,
  -- derived attribute: computed on read, never stored
  total_amount DECIMAL(10,2) AS (subtotal - discount_amount + tax_amount + delivery_fee) VIRTUAL,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT fk_orders_customer   FOREIGN KEY (customer_id) REFERENCES customer (customer_id),
  -- BR-13: the delivery address must be one of this customer's addresses
  CONSTRAINT fk_orders_address    FOREIGN KEY (customer_id, address_no) REFERENCES address (customer_id, address_no),
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurant (restaurant_id),
  CONSTRAINT fk_orders_coupon     FOREIGN KEY (coupon_id) REFERENCES coupon (coupon_id),
  CONSTRAINT chk_orders_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND discount_amount <= subtotal
                                       AND tax_amount >= 0 AND delivery_fee >= 0 AND commission_amount >= 0),
  INDEX idx_orders_customer (customer_id, placed_at),
  INDEX idx_orders_restaurant (restaurant_id, order_status, placed_at)
) ENGINE = InnoDB;

-- Weak entity: identified by (order_id, line_no)
CREATE TABLE order_item (
  order_id   INT UNSIGNED      NOT NULL,
  line_no    TINYINT UNSIGNED  NOT NULL,
  item_id    INT UNSIGNED      NOT NULL,
  quantity   SMALLINT UNSIGNED NOT NULL,
  unit_price DECIMAL(8,2)      NOT NULL,              -- price at the time of ordering
  item_total DECIMAL(10,2) AS (quantity * unit_price) VIRTUAL,
  CONSTRAINT pk_order_item PRIMARY KEY (order_id, line_no),
  CONSTRAINT uq_order_item UNIQUE (order_id, item_id),
  CONSTRAINT fk_order_item_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_item_menu  FOREIGN KEY (item_id)  REFERENCES menu_item (item_id),
  CONSTRAINT chk_order_item_qty   CHECK (quantity BETWEEN 1 AND 50),
  CONSTRAINT chk_order_item_price CHECK (unit_price > 0),
  INDEX idx_order_item_menu (item_id)
) ENGINE = InnoDB;

CREATE TABLE payment (
  payment_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  method          ENUM('UPI','CARD','NETBANKING','WALLET','COD') NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  payment_status  ENUM('PENDING','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  transaction_ref VARCHAR(40) NULL,
  paid_at         DATETIME NULL,
  CONSTRAINT pk_payment PRIMARY KEY (payment_id),
  CONSTRAINT uq_payment_order UNIQUE (order_id),          -- 1:1 with orders
  CONSTRAINT uq_payment_txn UNIQUE (transaction_ref),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders (order_id),
  CONSTRAINT chk_payment_amount CHECK (amount >= 0),
  CONSTRAINT chk_payment_paid   CHECK (payment_status NOT IN ('SUCCESS','REFUNDED') OR paid_at IS NOT NULL)
) ENGINE = InnoDB;

CREATE TABLE delivery (
  delivery_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  partner_id      INT UNSIGNED NOT NULL,
  delivery_status ENUM('ASSIGNED','PICKED_UP','DELIVERED','CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
  assigned_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  picked_up_at    DATETIME NULL,
  delivered_at    DATETIME NULL,
  distance_km     DECIMAL(5,2) NOT NULL,
  partner_earning DECIMAL(8,2) NOT NULL,
  CONSTRAINT pk_delivery PRIMARY KEY (delivery_id),
  CONSTRAINT uq_delivery_order UNIQUE (order_id),         -- 1:1 with orders
  CONSTRAINT fk_delivery_order   FOREIGN KEY (order_id)   REFERENCES orders (order_id),
  CONSTRAINT fk_delivery_partner FOREIGN KEY (partner_id) REFERENCES delivery_partner (partner_id),
  CONSTRAINT chk_delivery_distance CHECK (distance_km >= 0 AND partner_earning >= 0),
  CONSTRAINT chk_delivery_pickup   CHECK (picked_up_at IS NULL OR picked_up_at >= assigned_at),
  CONSTRAINT chk_delivery_drop     CHECK (delivered_at IS NULL OR (picked_up_at IS NOT NULL AND delivered_at >= picked_up_at)),
  INDEX idx_delivery_partner (partner_id, delivery_status)
) ENGINE = InnoDB;

CREATE TABLE review (
  review_id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        INT UNSIGNED NOT NULL,
  food_rating     TINYINT UNSIGNED NOT NULL,
  delivery_rating TINYINT UNSIGNED NOT NULL,
  comment         VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_review PRIMARY KEY (review_id),
  CONSTRAINT uq_review_order UNIQUE (order_id),           -- 1:1 with orders
  CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders (order_id),
  CONSTRAINT chk_review_food     CHECK (food_rating BETWEEN 1 AND 5),
  CONSTRAINT chk_review_delivery CHECK (delivery_rating BETWEEN 1 AND 5)
) ENGINE = InnoDB;

-- extra index used by the partner search (Q4)
CREATE INDEX idx_partner_state ON delivery_partner (status, availability);
