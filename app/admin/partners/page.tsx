"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Pill, toast } from "@/components/ui";
import { api, inr, dateTime } from "@/lib/client";

export default function AdminPartners() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => api("/api/admin/partners").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  async function act(p: any, action: string, msg: string) {
    try { await api("/api/admin/partners", { method: "PATCH", body: { partner_id: p.partner_id, action } }); toast(msg); load(); }
    catch (e: any) { toast(e.message, "err"); }
  }
  return (
    <Shell role="admin" wide>
      <PageHeader title="Delivery partners" sub="Verify new riders and block riders when needed" />
      {!rows && <Spinner />}
      {rows && (
        <div className="card overflow-x-auto">
          <table className="table-clean w-full">
            <thead><tr><th>Rider</th><th>Vehicle</th><th>Rating</th><th>Deliveries</th><th>Earned</th><th>Now</th><th>Account</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.partner_id}>
                  <td><div className="font-semibold">{p.full_name}</div><div className="text-xs text-ink-500">{p.phone} · #{p.partner_id}</div></td>
                  <td className="text-sm">{p.vehicle_type?.toLowerCase()}<div className="text-xs text-ink-500">{p.vehicle_number || "no plate"}</div></td>
                  <td>{p.rating_avg ? `${Number(p.rating_avg).toFixed(1)} ★` : "–"}</td>
                  <td>{p.deliveries_done || 0}</td>
                  <td>{inr(p.total_earnings)}</td>
                  <td><Pill status={p.availability} /></td>
                  <td><Pill status={p.status} />{p.verified_at && <div className="mt-1 text-[11px] text-ink-500">verified {dateTime(p.verified_at)}{p.verified_by_name ? ` by ${p.verified_by_name}` : ""}</div>}</td>
                  <td className="text-right">
                    {p.status === "PENDING" && <button className="btn-success btn-sm" onClick={() => act(p, "verify", `${p.full_name} verified`)}>Verify</button>}
                    {p.status === "ACTIVE" && <button className="btn-danger btn-sm" onClick={() => act(p, "block", `${p.full_name} blocked`)}>Block</button>}
                    {p.status === "BLOCKED" && <button className="btn-ghost btn-sm" onClick={() => act(p, "unblock", `${p.full_name} unblocked`)}>Unblock</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
