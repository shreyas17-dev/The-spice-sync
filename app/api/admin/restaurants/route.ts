import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one, exec } from "@/lib/db";
import { logActivity, notify } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole("admin");
  return q("admin",
    `SELECT r.restaurant_id, r.name, r.status, r.commission_pct, r.cost_for_two, r.approved_at, pc.city,
            ow.full_name AS owner_name, ow.owner_id, ad.full_name AS approved_by_name,
            COALESCE(v.rating_avg, 0) AS rating,
            (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.restaurant_id AND o.order_status = 'DELIVERED') AS delivered,
            (SELECT GROUP_CONCAT(rc.cuisine ORDER BY rc.cuisine SEPARATOR ', ') FROM restaurant_cuisine rc WHERE rc.restaurant_id = r.restaurant_id) AS cuisines
       FROM restaurant r
       JOIN pincode pc ON pc.pincode = r.pincode
       JOIN restaurant_owner ow ON ow.owner_id = r.owner_id
       LEFT JOIN admin ad ON ad.admin_id = r.approved_by
       LEFT JOIN v_restaurant_rating v ON v.restaurant_id = r.restaurant_id
      ORDER BY FIELD(r.status, 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'), r.name`);
});

const ACTION: Record<string, [string, string]> = {
  approve: ["ACTIVE", "APPROVE_RESTAURANT"], reject: ["REJECTED", "REJECT_RESTAURANT"],
  suspend: ["SUSPENDED", "SUSPEND_RESTAURANT"], reactivate: ["ACTIVE", "REACTIVATE_RESTAURANT"],
};

export const PATCH = handle(async (req) => {
  const u = await requireRole("admin");
  const b = await body(req);
  const id = num(b.restaurant_id);
  const r = await one("admin", "SELECT restaurant_id, owner_id, name, approved_by FROM restaurant WHERE restaurant_id = ?", [id]);
  if (!r) throw new HttpError(404, "Restaurant not found.");
  if (b.commission_pct !== undefined) {
    await exec("admin", "UPDATE restaurant SET commission_pct = ? WHERE restaurant_id = ?", [num(b.commission_pct), id]);
    await logActivity("admin", u.id, "SET_COMMISSION", "restaurant", id);
  }
  if (b.action) {
    const a = ACTION[b.action];
    if (!a) throw new HttpError(400, "Unknown action.");
    // approved_by is set by the admin; trigger trg_restaurant_approval fills approved_at
    if (a[0] === "ACTIVE" && !r.approved_by)
      await exec("admin", "UPDATE restaurant SET status = 'ACTIVE', approved_by = ? WHERE restaurant_id = ?", [u.id, id]);
    else
      await exec("admin", "UPDATE restaurant SET status = ? WHERE restaurant_id = ?", [a[0], id]);
    await logActivity("admin", u.id, a[1], "restaurant", id);
    await notify("owner", r.owner_id, null, `${r.name}: status changed to ${a[0]}.`);
  }
  return { ok: true };
});
