import { handle, requireRole } from "@/lib/api";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole();
  const rows = await q(u.role, "SELECT cuisine, COUNT(*) AS n FROM restaurant_cuisine GROUP BY cuisine ORDER BY n DESC, cuisine");
  return rows.map((r: any) => r.cuisine);
});
