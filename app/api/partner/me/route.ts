import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { one, exec } from "@/lib/db";
import { tryRedis, logActivity } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole("partner");
  const p = await one("partner",
    `SELECT p.partner_id, p.full_name, p.email, p.phone, p.vehicle_type, p.vehicle_number, p.status, p.availability,
            p.cur_lat, p.cur_long, s.rating_avg, s.deliveries_done, s.total_earnings
       FROM delivery_partner p LEFT JOIN v_partner_stats s ON s.partner_id = p.partner_id
      WHERE p.partner_id = ?`, [u.id]);
  if (!p) throw new HttpError(404, "Profile not found.");
  return p;
});

// Go online / offline. CHECK chk_partner_online stops an unverified partner from going online.
export const PATCH = handle(async (req) => {
  const u = await requireRole("partner");
  const b = await body(req);
  const p = await one("partner", "SELECT status, availability, cur_lat, cur_long FROM delivery_partner WHERE partner_id = ?", [u.id]);
  if (!p) throw new HttpError(404, "Profile not found.");
  if (b.availability === "OFFLINE") {
    if (p.availability === "BUSY") throw new HttpError(400, "Finish your current delivery before going offline.");
    await exec("partner", "UPDATE delivery_partner SET availability = 'OFFLINE' WHERE partner_id = ?", [u.id]);
    await tryRedis(async (r) => { await r.zrem("partners:geo", String(u.id)); await r.del(`partner:${u.id}:ping`); return true; }, false);
    await logActivity("partner", u.id, "GO_OFFLINE", "delivery_partner", u.id);
    return { ok: true, availability: "OFFLINE" };
  }
  if (p.status !== "ACTIVE") throw new HttpError(400, p.status === "BLOCKED"
    ? "Your account is blocked. Please contact support."
    : "You can go online only after an admin verifies your account.");
  const lat = num(b.lat, p.cur_lat ?? NaN), lng = num(b.lng, p.cur_long ?? NaN);
  if (isNaN(lat) || isNaN(lng)) throw new HttpError(400, "Share your location to go online.");
  if (p.availability !== "BUSY") {
    await exec("partner", "UPDATE delivery_partner SET availability = 'ONLINE', cur_lat = ?, cur_long = ? WHERE partner_id = ?", [lat, lng, u.id]);
  }
  await tryRedis(async (r) => {
    await r.geoadd("partners:geo", lng, lat, String(u.id));
    await r.set(`partner:${u.id}:ping`, p.availability === "BUSY" ? "BUSY" : "ONLINE", "EX", 900);
    return true;
  }, false);
  await logActivity("partner", u.id, "GO_ONLINE", "delivery_partner", u.id);
  return { ok: true, availability: p.availability === "BUSY" ? "BUSY" : "ONLINE" };
});
