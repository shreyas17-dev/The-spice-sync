import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { one, exec } from "@/lib/db";
import { tryRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// The rider app sends its position every few seconds. Redis gets every point
// (GEOADD + XADD + PUBLISH); MySQL gets a copy at most every 30 seconds.
export const POST = handle(async (req) => {
  const u = await requireRole("partner");
  const b = await body(req);
  const lat = num(b.lat, NaN), lng = num(b.lng, NaN);
  if (isNaN(lat) || isNaN(lng)) throw new HttpError(400, "Bad location.");
  const task = await one("partner",
    "SELECT order_id FROM v_delivery_task WHERE partner_id = ? AND delivery_status IN ('ASSIGNED','PICKED_UP') ORDER BY assigned_at DESC LIMIT 1",
    [u.id]);
  const syncDb = await tryRedis(async (r) => {
    await r.geoadd("partners:geo", lng, lat, String(u.id));
    await r.set(`partner:${u.id}:ping`, task ? "BUSY" : "ONLINE", "EX", 60);
    if (task) {
      const oid = task.order_id;
      await r.xadd(`order:${oid}:events`, "*", "type", "location", "lat", lat.toFixed(6), "long", lng.toFixed(6));
      await r.publish(`order:${oid}`, JSON.stringify({ type: "location", lat, long: lng, at: Date.now() }));
    }
    // SET NX EX 30: true only once every 30 s
    return (await r.set(`partner:${u.id}:dbsync`, "1", "EX", 30, "NX")) === "OK";
  }, true);
  if (syncDb) await exec("partner", "UPDATE delivery_partner SET cur_lat = ?, cur_long = ? WHERE partner_id = ?", [lat, lng, u.id]);
  return { ok: true, orderId: task ? task.order_id : null };
});
