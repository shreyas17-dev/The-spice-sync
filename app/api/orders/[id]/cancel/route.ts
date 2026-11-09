import { handle, requireRole, num } from "@/lib/api";
import { exec, one } from "@/lib/db";
import { orderEvent, notify } from "@/lib/redis";

export const dynamic = "force-dynamic";

// The status trigger only allows PLACED -> CANCELLED; it also refunds a prepaid order.
export const POST = handle(async (req, { params }) => {
  const u = await requireRole("customer");
  const id = num(params.id);
  await exec("customer", "CALL sp_cancel_order(?, ?)", [id, u.id]);
  await orderEvent(id, { status: "CANCELLED", note: "Cancelled by you" });
  await notify("customer", u.id, id, `Order #${id} was cancelled.`);
  const r = await one("customer",
    "SELECT r.owner_id FROM orders o JOIN restaurant r ON r.restaurant_id = o.restaurant_id WHERE o.order_id = ?", [id]);
  if (r) await notify("owner", r.owner_id, id, `Order #${id} was cancelled by the customer.`);
  return { ok: true };
});
