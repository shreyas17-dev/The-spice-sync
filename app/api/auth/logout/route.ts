import { handle } from "@/lib/api";
import { getUser, endSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const u = await getUser();
  await endSession(u);
  return { ok: true };
});
