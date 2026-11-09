"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Pill, toast } from "@/components/ui";
import { api, inr, dateTime } from "@/lib/client";

export default function AdminCustomers() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const load = () => api("/api/admin/customers").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  async function act(c: any, action: string) {
    try { await api("/api/admin/customers", { method: "PATCH", body: { customer_id: c.customer_id, action } }); toast(action === "block" ? "Customer blocked" : "Customer unblocked"); load(); }
    catch (e: any) { toast(e.message, "err"); }
  }
  const shown = (rows || []).filter((c) => !q || `${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell role="admin" wide>
      <PageHeader title="Customers" sub={rows ? `${rows.length} customers, sorted by money spent` : ""}>
        <input className="input w-64 py-2" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHeader>
      {!rows && <Spinner />}
      {rows && (
        <div className="card overflow-x-auto">
          <table className="table-clean w-full">
            <thead><tr><th>Customer</th><th>Phone</th><th>Age</th><th>Orders</th><th>Spent</th><th>Points</th><th>Joined</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.customer_id}>
                  <td><div className="font-semibold">{c.full_name}</div><div className="text-xs text-ink-500">{c.email}</div></td>
                  <td>{c.phone}</td><td>{c.age ?? "–"}</td><td>{c.orders}</td><td>{inr(c.spent)}</td><td>{c.loyalty_points}</td>
                  <td className="text-sm text-ink-500">{c.created_at ? new Date(String(c.created_at).replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}</td>
                  <td><Pill status={c.status} /></td>
                  <td className="text-right">{c.status === "ACTIVE" ? <button className="btn-danger btn-sm" onClick={() => act(c, "block")}>Block</button> : <button className="btn-ghost btn-sm" onClick={() => act(c, "unblock")}>Unblock</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
