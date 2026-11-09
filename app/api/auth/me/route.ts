import { handle, HttpError } from "@/lib/api";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Not logged in");
  return { id: u.id, role: u.role, name: u.name };
});
