import { handle, requireRole } from "@/lib/api";
import { tryRedis, entry } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Latest platform actions from the Redis stream activity:log
export const GET = handle(async () => {
  await requireRole("admin");
  const rows = await tryRedis((r) => r.xrevrange("activity:log", "+", "-", "COUNT", 60), [] as any[]);
  return rows.map(entry);
});
