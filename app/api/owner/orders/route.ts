import { handle, requireRole, num } from "@/lib/api";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

// Live order board. Owners read orders only through the view v_restaurant_orders
// (no customer email, phone or password columns).
export const GET = handle(async (req) => {
  const u = await requireRole("owner");
  const rid = num(new URL(req.url).searchParams.get("restaurantId"), 0);
  const params: any[] = [u.id];
  let filter = "";
  if (rid) { filter = "AND v.restaurant_id = ?"; params.push(rid); }
  const orders = await q("owner",
    `SELECT v.*, r.name AS restaurant
       FROM v_restaurant_orders v JOIN restaurant r ON r.restaurant_id = v.restaurant_id
      WHERE v.owner_id = ? ${filter}
        AND (v.order_status IN ('PLACED','CONFIRMED','PREPARING','READY','PICKED_UP') OR v.placed_at >= CURDATE())
      ORDER BY FIELD(v.order_status,'PLACED','CONFIRMED','PREPARING','READY','PICKED_UP','DELIVERED','CANCELLED'), v.placed_at DESC
      LIMIT 120`, params);
  const ids = orders.map((o: any) => o.order_id);
  const lines = ids.length
    ? await q("owner",
        `SELECT oi.order_id, oi.quantity, m.name, m.is_veg FROM order_item oi JOIN menu_item m ON m.item_id = oi.item_id
          WHERE oi.order_id IN (?) ORDER BY oi.order_id, oi.line_no`, [ids])
    : [];
  const byOrder: Record<number, any[]> = {};
  for (const l of lines) (byOrder[l.order_id] = byOrder[l.order_id] || []).push(l);
  return orders.map((o: any) => ({ ...o, items: byOrder[o.order_id] || [] }));
});
