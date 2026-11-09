"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Pill, toast, ErrorBox, Toggle } from "@/components/ui";
import { api, inr, dateTime } from "@/lib/client";

export default function AdminCoupons() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [f, setF] = useState<any>({ discount_type: "PERCENT", days: 30, usage_limit: 1000, min_order_value: 199 });
  const [err, setErr] = useState<string | null>(null);
  const load = () => api("/api/admin/coupons").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  async function create() {
    setErr(null);
    try { await api("/api/admin/coupons", { body: f }); toast("Coupon created"); load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function toggle(c: any, on: boolean) {
    await api("/api/admin/coupons", { method: "PATCH", body: { coupon_id: c.coupon_id, status: on ? "ACTIVE" : "INACTIVE" } }).catch((e) => toast(e.message, "err"));
    load();
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Shell role="admin" wide>
      <PageHeader title="Coupons" sub="Platform coupons are paid by BiteRoute; restaurant coupons by the restaurant" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card overflow-x-auto">
          {!rows ? <Spinner /> : (
            <table className="table-clean w-full">
              <thead><tr><th>Code</th><th>Offer</th><th>Min order</th><th>Valid till</th><th>Used</th><th>Paid by</th><th>Active</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.coupon_id}>
                    <td><span className="rounded-md border border-dashed border-brand-300 bg-brand-50 px-2 py-0.5 font-mono text-sm font-bold text-brand-700">{c.code}</span></td>
                    <td className="text-sm">{c.discount_type === "PERCENT" ? `${c.discount_value}% off${c.max_discount ? ` up to ${inr(c.max_discount)}` : ""}` : `${inr(c.discount_value)} off`}<div className="text-xs text-ink-500">{c.description}</div></td>
                    <td>{inr(c.min_order_value)}</td>
                    <td className="text-sm">{dateTime(c.valid_to)}{!Number(c.in_window) && <div><Pill status="INACTIVE" label="Out of dates" /></div>}</td>
                    <td>{c.used} / {c.usage_limit}</td>
                    <td className="text-sm">{c.restaurant || "Platform"}</td>
                    <td><Toggle on={c.status === "ACTIVE"} onChange={(v) => toggle(c, v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card self-start p-6">
          <div className="h-section mb-4">New platform coupon</div>
          <div className="space-y-3">
            <div><label className="label">Code</label><input className="input uppercase" placeholder="WEEKEND15" onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></div>
            <div><label className="label">Description</label><input className="input" onChange={set("description")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Type</label><select className="input" value={f.discount_type} onChange={set("discount_type")}><option value="PERCENT">Percent</option><option value="FLAT">Flat ₹</option></select></div>
              <div><label className="label">Value</label><input className="input" type="number" onChange={set("discount_value")} /></div>
              <div><label className="label">Max discount ₹</label><input className="input" type="number" onChange={set("max_discount")} /></div>
              <div><label className="label">Min order ₹</label><input className="input" type="number" value={f.min_order_value} onChange={set("min_order_value")} /></div>
              <div><label className="label">Valid for (days)</label><input className="input" type="number" value={f.days} onChange={set("days")} /></div>
              <div><label className="label">Usage limit</label><input className="input" type="number" value={f.usage_limit} onChange={set("usage_limit")} /></div>
            </div>
            <ErrorBox error={err} />
            <button className="btn-primary w-full" onClick={create}>Create coupon</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
