import { handle, requireRole } from "@/lib/api";
import { tryRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole();
  const list = await tryRedis((r) => r.lrange(`notif:${u.role}:${u.id}`, 0, 19), [] as string[]);
  return list.map((s) => { try { return JSON.parse(s); } catch { return { text: s }; } });
});
