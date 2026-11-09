// Redis (Memurai on Windows) access and the small helpers the API uses.
// The API logs in as ACL user fd_api; the live-tracking stream uses the
// read-only user fd_tracking (redis/01_setup.redis).
import Redis from "ioredis";

const g = globalThis as any;

function options(user?: string, pass?: string) {
  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    username: user || undefined,
    password: pass || undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 4000,
    enableReadyCheck: false, // INFO is not allowed for our ACL users
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
  };
}

export function redis(): Redis {
  if (!g.__br_redis) {
    const r = new Redis(options(process.env.REDIS_USER, process.env.REDIS_PASS));
    r.on("error", (e) => console.warn("[redis]", e.message));
    g.__br_redis = r;
  }
  return g.__br_redis;
}

/** A separate connection for SUBSCRIBE (one per open tracking page). */
export function subscriber(): Redis {
  const user = process.env.REDIS_TRACK_USER || process.env.REDIS_USER;
  const pass = process.env.REDIS_TRACK_USER ? process.env.REDIS_TRACK_PASS : process.env.REDIS_PASS;
  const r = new Redis({ ...options(user, pass), maxRetriesPerRequest: null as any });
  r.on("error", (e) => console.warn("[redis-sub]", e.message));
  return r;
}

/** Run a Redis call but never let a Redis problem break the request. */
export async function tryRedis<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn(redis());
  } catch (e: any) {
    console.warn("[redis]", e?.message || e);
    return fallback;
  }
}

/** Stream entry [id, [k, v, k, v]] -> { id, at, ...fields } */
export function entry(e: [string, string[]]) {
  const o: any = { id: e[0], at: Number(e[0].split("-")[0]) };
  for (let i = 0; i < e[1].length; i += 2) o[e[1][i]] = e[1][i + 1];
  return o;
}

/** Append an event to order:{id}:events and push it to open tracking pages. */
export async function orderEvent(orderId: number, fields: Record<string, string | number>) {
  const flat: string[] = [];
  for (const [k, v] of Object.entries(fields)) flat.push(k, String(v));
  await tryRedis(async (r) => {
    await r.xadd(`order:${orderId}:events`, "*", ...flat);
    await r.publish(`order:${orderId}`, JSON.stringify({ ...fields, at: Date.now() }));
    if (fields.status === "DELIVERED" || fields.status === "CANCELLED") await r.expire(`order:${orderId}:events`, 86400);
    return true;
  }, false);
}

/** Notification list notif:{role}:{id} (latest 50, kept 30 days). */
export async function notify(role: string, id: number, orderId: number | null, text: string) {
  const key = `notif:${role}:${id}`;
  await tryRedis(async (r) => {
    await r.lpush(key, JSON.stringify({ order_id: orderId, text, at: Date.now() }));
    await r.ltrim(key, 0, 49);
    await r.expire(key, 2592000);
    return true;
  }, false);
}

/** Admin activity log (a capped stream). */
export async function logActivity(role: string, id: number, action: string, entity: string, entityId: number | string) {
  await tryRedis(
    (r) => r.xadd("activity:log", "MAXLEN", "~", "10000", "*",
      "actor_role", role, "actor_id", String(id), "action", action, "entity", entity, "entity_id", String(entityId)),
    null,
  );
}

/** Nearest riders around a point: GEOSEARCH, or GEORADIUS on older servers. */
export async function nearbyPartners(lat: number, lon: number, km = 5, count = 5): Promise<{ id: number; km: number }[]> {
  return tryRedis(async (r) => {
    let res: any;
    try {
      res = await r.call("GEOSEARCH", "partners:geo", "FROMLONLAT", String(lon), String(lat), "BYRADIUS", String(km), "km", "ASC", "COUNT", String(count), "WITHDIST");
    } catch {
      res = await r.call("GEORADIUS", "partners:geo", String(lon), String(lat), String(km), "km", "WITHDIST", "ASC", "COUNT", String(count));
    }
    return (res as any[]).map((x: any) => ({ id: Number(x[0]), km: Number(x[1]) }));
  }, []);
}
