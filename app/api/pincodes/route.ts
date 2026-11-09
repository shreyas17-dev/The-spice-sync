import { handle, requireRole } from "@/lib/api";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireRole();
  return q(u.role, "SELECT pincode, city, state FROM pincode ORDER BY city, pincode");
});
