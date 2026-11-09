"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Pill, Rating, toast } from "@/components/ui";
import { api } from "@/lib/client";

export default function AdminRestaurants() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [comm, setComm] = useState<Record<number, string>>({});
  const load = () => api("/api/admin/restaurants").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  async function act(r: any, body: any, msg: string) {
    try { await api("/api/admin/restaurants", { method: "PATCH", body: { restaurant_id: r.restaurant_id, ...body } }); toast(msg); load(); }
    catch (e: any) { toast(e.message, "err"); }
  }
  const shown = (rows || []).filter((r) => filter === "ALL" || r.status === filter);
  const count = (s: string) => (rows || []).filter((r) => r.status === s).length;

  return (
    <Shell role="admin" wide>
      <PageHeader title="Restaurants" sub="Approve new restaurants, suspend or reactivate them, and set commission">
        {["ALL", "PENDING", "ACTIVE", "SUSPENDED", "REJECTED"].map((s) => (
          <button key={s} className={`chip ${filter === s ? "chip-on" : ""}`} onClick={() => setFilter(s)}>{s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} {s !== "ALL" && <span className="opacity-60">{count(s)}</span>}</button>
        ))}
      </PageHeader>
      {!rows && <Spinner />}
      {rows && (
        <div className="card overflow-x-auto">
          <table className="table-clean w-full">
            <thead><tr><th>Restaurant</th><th>Owner</th><th>City</th><th>Rating</th><th>Delivered</th><th>Commission %</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.restaurant_id}>
                  <td><div className="font-semibold">{r.name}</div><div className="text-xs text-ink-500">{r.cuisines}</div></td>
                  <td>{r.owner_name}</td>
                  <td>{r.city}</td>
                  <td><Rating value={r.rating} /></td>
                  <td>{r.delivered}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <input className="input w-20 py-1.5" type="number" min={0} max={50} step={0.5} value={comm[r.restaurant_id] ?? String(r.commission_pct)} onChange={(e) => setComm({ ...comm, [r.restaurant_id]: e.target.value })} />
                      {comm[r.restaurant_id] !== undefined && Number(comm[r.restaurant_id]) !== Number(r.commission_pct) && (
                        <button className="btn-dark btn-sm" onClick={() => { act(r, { commission_pct: Number(comm[r.restaurant_id]) }, "Commission updated"); const c = { ...comm }; delete c[r.restaurant_id]; setComm(c); }}>Save</button>
                      )}
                    </div>
                  </td>
                  <td><Pill status={r.status} />{r.approved_by_name && <div className="mt-1 text-[11px] text-ink-500">by {r.approved_by_name}</div>}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {r.status === "PENDING" && (<>
                        <button className="btn-success btn-sm" onClick={() => act(r, { action: "approve" }, `${r.name} approved`)}>Approve</button>
                        <button className="btn-danger btn-sm" onClick={() => act(r, { action: "reject" }, `${r.name} rejected`)}>Reject</button>
                      </>)}
                      {r.status === "ACTIVE" && <button className="btn-danger btn-sm" onClick={() => act(r, { action: "suspend" }, `${r.name} suspended`)}>Suspend</button>}
                      {(r.status === "SUSPENDED" || r.status === "REJECTED") && <button className="btn-ghost btn-sm" onClick={() => act(r, { action: "reactivate" }, `${r.name} is active again`)}>Reactivate</button>}
                    </div>
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
