import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { exec } from "@/lib/db";

export const dynamic = "force-dynamic";

// sp_add_review checks ownership; trigger trg_review_only_delivered checks the status.
export const POST = handle(async (req, { params }) => {
  const u = await requireRole("customer");
  const b = await body(req);
  const food = num(b.food), del = num(b.delivery);
  if (food < 1 || food > 5 || del < 1 || del > 5) throw new HttpError(400, "Give both ratings from 1 to 5 stars.");
  await exec("customer", "CALL sp_add_review(?, ?, ?, ?, ?)", [num(params.id), u.id, food, del, String(b.comment || "").slice(0, 500)]);
  return { ok: true };
});
