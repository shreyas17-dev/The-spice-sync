-- =====================================================================
--  05_triggers.sql : rules that must hold no matter who changes the data
-- =====================================================================
USE food_delivery;
DROP TRIGGER IF EXISTS trg_address_number;
DROP TRIGGER IF EXISTS trg_orders_status_guard;
DROP TRIGGER IF EXISTS trg_orders_status_sync;
DROP TRIGGER IF EXISTS trg_order_item_no_update;
DROP TRIGGER IF EXISTS trg_order_item_no_delete;
DROP TRIGGER IF EXISTS trg_review_only_delivered;
DROP TRIGGER IF EXISTS trg_partner_state;
DROP TRIGGER IF EXISTS trg_restaurant_approval;

DELIMITER $$

-- Weak entity ADDRESS: number a new address 1, 2, 3 ... per customer
CREATE TRIGGER trg_address_number
BEFORE INSERT ON address
FOR EACH ROW
BEGIN
  IF NEW.address_no = 0 THEN
    SET NEW.address_no = (SELECT COALESCE(MAX(address_no), 0) + 1
                            FROM address WHERE customer_id = NEW.customer_id);
  END IF;
END$$

-- BR-12: only legal status moves are accepted
CREATE TRIGGER trg_orders_status_guard
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.order_status <> OLD.order_status THEN
    IF NOT (   (OLD.order_status = 'PLACED'    AND NEW.order_status IN ('CONFIRMED','CANCELLED'))
            OR (OLD.order_status = 'CONFIRMED' AND NEW.order_status = 'PREPARING')
            OR (OLD.order_status = 'PREPARING' AND NEW.order_status = 'READY')
            OR (OLD.order_status = 'READY'     AND NEW.order_status = 'PICKED_UP')
            OR (OLD.order_status = 'PICKED_UP' AND NEW.order_status = 'DELIVERED')) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Illegal order status change';
    END IF;
    IF NEW.order_status = 'PICKED_UP'
       AND NOT EXISTS (SELECT 1 FROM delivery WHERE order_id = NEW.order_id AND delivery_status = 'ASSIGNED') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No delivery partner is assigned to this order';
    END IF;
  END IF;
END$$

-- Keep DELIVERY, PAYMENT, partner availability and loyalty points in step with the order
CREATE TRIGGER trg_orders_status_sync
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.order_status <> OLD.order_status THEN

    IF NEW.order_status = 'PICKED_UP' THEN
      UPDATE delivery
         SET delivery_status = 'PICKED_UP', picked_up_at = NOW()
       WHERE order_id = NEW.order_id;

    ELSEIF NEW.order_status = 'DELIVERED' THEN
      UPDATE delivery
         SET delivery_status = 'DELIVERED', delivered_at = NOW()
       WHERE order_id = NEW.order_id;
      UPDATE delivery_partner p
        JOIN delivery d ON d.partner_id = p.partner_id
         SET p.availability = IF(p.status = 'ACTIVE', 'ONLINE', 'OFFLINE')
       WHERE d.order_id = NEW.order_id;
      UPDATE payment                                   -- BR-14: cash collected on delivery
         SET payment_status = 'SUCCESS', paid_at = NOW()
       WHERE order_id = NEW.order_id AND payment_status = 'PENDING';
      UPDATE customer                                  -- BR-18: 1 point per Rs 100
         SET loyalty_points = loyalty_points
             + FLOOR((NEW.subtotal - NEW.discount_amount + NEW.tax_amount + NEW.delivery_fee) / 100)
       WHERE customer_id = NEW.customer_id;

    ELSEIF NEW.order_status = 'CANCELLED' THEN
      UPDATE payment
         SET payment_status = IF(payment_status = 'SUCCESS', 'REFUNDED', 'FAILED')
       WHERE order_id = NEW.order_id AND payment_status IN ('PENDING','SUCCESS');
    END IF;

  END IF;
END$$

-- BR-13: order lines are frozen once the order is placed
CREATE TRIGGER trg_order_item_no_update
BEFORE UPDATE ON order_item
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order lines cannot be changed after placement';
END$$

CREATE TRIGGER trg_order_item_no_delete
BEFORE DELETE ON order_item
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order lines cannot be deleted after placement';
END$$

-- BR-17: only delivered orders can be reviewed
CREATE TRIGGER trg_review_only_delivered
BEFORE INSERT ON review
FOR EACH ROW
BEGIN
  IF (SELECT order_status FROM orders WHERE order_id = NEW.order_id) <> 'DELIVERED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only delivered orders can be reviewed';
  END IF;
END$$

-- A blocked or unverified partner is forced offline; verification gets a timestamp
CREATE TRIGGER trg_partner_state
BEFORE UPDATE ON delivery_partner
FOR EACH ROW
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    SET NEW.availability = 'OFFLINE';
  END IF;
  IF NEW.verified_by IS NOT NULL AND OLD.verified_by IS NULL AND NEW.verified_at IS NULL THEN
    SET NEW.verified_at = NOW();
  END IF;
END$$

-- Approval of a restaurant gets a timestamp automatically
CREATE TRIGGER trg_restaurant_approval
BEFORE UPDATE ON restaurant
FOR EACH ROW
BEGIN
  IF NEW.approved_by IS NOT NULL AND OLD.approved_by IS NULL AND NEW.approved_at IS NULL THEN
    SET NEW.approved_at = NOW();
  END IF;
END$$

DELIMITER ;
