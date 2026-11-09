import { handle, requireRole, body, HttpError, num } from "@/lib/api";
import { q, exec } from "@/lib/db";

export const dynamic = "force-dynamic";

// ADDRESS is a weak entity of CUSTOMER: key (customer_id, address_no).
export const GET = handle(async () => {
  const u = await requireRole("customer");
  return q("customer",
    `SELECT a.address_no, a.label, a.address_line, a.pincode, p.city, p.state, a.latitude, a.longitude, a.is_default
       FROM address a JOIN pincode p ON p.pincode = a.pincode
      WHERE a.customer_id = ? ORDER BY a.is_default DESC, a.address_no`, [u.id]);
});

export const POST = handle(async (req) => {
  const u = await requireRole("customer");
  const b = await body(req);
  if (!b.address_line || !b.pincode) throw new HttpError(400, "Address and PIN code are required.");
  const lat = num(b.latitude, NaN), lon = num(b.longitude, NaN);
  if (isNaN(lat) || isNaN(lon)) throw new HttpError(400, "Pick the location on the map.");
  if (b.is_default) await exec("customer", "UPDATE address SET is_default = FALSE WHERE customer_id = ?", [u.id]);
  // address_no = 0 -> trigger trg_address_number gives the next number for this customer
  await exec("customer",
    `INSERT INTO address (customer_id, address_no, label, address_line, pincode, latitude, longitude, is_default)
     VALUES (?, 0, ?, ?, ?, ?, ?, ?)`,
    [u.id, b.label || "Home", String(b.address_line).trim(), String(b.pincode).trim(), lat, lon, b.is_default ? 1 : 0]);
  return { ok: true };
});

export const PATCH = handle(async (req) => {
  const u = await requireRole("customer");
  const no = num(new URL(req.url).searchParams.get("no"));
  await exec("customer", "UPDATE address SET is_default = (address_no = ?) WHERE customer_id = ?", [no, u.id]);
  return { ok: true };
});

export const DELETE = handle(async (req) => {
  const u = await requireRole("customer");
  const no = num(new URL(req.url).searchParams.get("no"));
  // a foreign key from orders blocks this if past orders used the address (ERROR 1451)
  const r = await exec("customer", "DELETE FROM address WHERE customer_id = ? AND address_no = ?", [u.id, no]);
  if (!r.affectedRows) throw new HttpError(404, "Address not found.");
  return { ok: true };
});
