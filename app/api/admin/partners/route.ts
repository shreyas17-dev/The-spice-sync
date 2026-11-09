import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, one, exec } from "@/lib/db";
import { logActivity, notify, tryRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireRole("admin");
  return q("admin",
    `SELECT p.partner_id, p.full_name, p.email, p.phone, p.vehicle_type, p.vehicle_number, p.license_no,
            p.status, p.availability, p.verified_at, ad.full_name AS verified_by_name,
            s.rating_avg, s.deliveries_done, s.total_earnings
       FROM delivery_partner p
       LEFT JOIN admin ad ON ad.admin_id = p.verified_by
       LEFT JOIN v_partner_stats s ON s.partner_id = p.partner_id
      ORDER BY FIELD(p.status, 'PENDING', 'ACTIVE', 'BLOCKED'), FIELD(p.availability, 'BUSY', 'ONLINE', 'OFFLINE'), p.full_name`);
});

export const PATCH = handle(async (req) => {
  const u = await requireRole("admin");
  const b = await body(req);
  const id = num(b.partner_id);
  const p = await one("admin", "SELECT partner_id, status, availability, verified_by FROM delivery_partner WHERE partner_id = ?", [id]);
  if (!p) throw new HttpError(404, "Rider not found.");
  if (b.action === "verify") {
    // trigger trg_partner_state fills verified_at
    await exec("admin", "UPDATE delivery_partner SET status = 'ACTIVE', verified_by = ? WHERE partner_id = ?", [p.verified_by || u.id, id]);
    await logActivity("admin", u.id, "VERIFY_PARTNER", "delivery_partner", id);
    await notify("partner", id, null, "Your account is verified. You can go online now.");
  } else if (b.action === "block") {
    if (p.availability === "BUSY") throw new HttpError(400, "This rider is on a delivery right now. Try again after it is done.");
    await exec("admin", "UPDATE delivery_partner SET status = 'BLOCKED' WHERE partner_id = ?", [id]);
    await tryRedis((r) => r.zrem("partners:geo", String(id)), 0);
    await logActivity("admin", u.id, "BLOCK_PARTNER", "delivery_partner", id);
  } else if (b.action === "unblock") {
    await exec("admin", "UPDATE delivery_partner SET status = 'ACTIVE', verified_by = COALESCE(verified_by, ?) WHERE partner_id = ?", [u.id, id]);
    await logActivity("admin", u.id, "UNBLOCK_PARTNER", "delivery_partner", id);
  } else throw new HttpError(400, "Unknown action.");
  return { ok: true };
});
