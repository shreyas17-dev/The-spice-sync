"use client";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Veg, toast, Pill } from "@/components/ui";
import { useRestaurants, RestaurantPicker } from "@/components/OwnerPicker";
import { api, inr2, timeOf, ago } from "@/lib/client";

const COLS = [
  { status: "PLACED", title: "New", tone: "border-t-amber-400" },
  { status: "CONFIRMED", title: "Accepted", tone: "border-t-sky-400" },
  { status: "PREPARING", title: "Preparing", tone: "border-t-indigo-400" },
  { status: "READY", title: "Ready for pickup", tone: "border-t-violet-400" },
  { status: "PICKED_UP", title: "Out for delivery", tone: "border-t-brand-400" },
];

export default function OwnerOrders() {
  const { list, rid, choose } = useRestaurants();
  const [scope, setScope] = useState<number>(0);
  const [orders, setOrders] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [updated, setUpdated] = useState<number>(Date.now());
  const scopeRef = useRef(0);
  scopeRef.current = scope;

  async function load() {
    try { setOrders(await api(`/api/owner/orders?restaurantId=${scopeRef.current}`)); setUpdated(Date.now()); } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope]);

  async function move(o: any, status: string) {
    setBusy(o.order_id);
    try {
      const r = await api(`/api/owner/orders/${o.order_id}`, { method: "PATCH", body: { status } });
      if (status === "CONFIRMED") toast(r.partnerId ? `Accepted. Rider #${r.partnerId} assigned.` : "Accepted. No rider free nearby yet; retry soon.", r.partnerId ? "ok" : "err");
      else toast(status === "CANCELLED" ? "Order rejected" : "Updated");
      await load();
    } catch (e: any) { toast(e.message, "err"); }
    setBusy(null);
  }
  async function retry(o: any) {
    setBusy(o.order_id);
    try {
      const r = await api(`/api/owner/orders/${o.order_id}`, { method: "PATCH", body: { assign: true } });
      toast(r.partnerId ? `Rider #${r.partnerId} assigned` : "Still no rider free within 5 km", r.partnerId ? "ok" : "err");
      await load();
    } catch (e: any) { toast(e.message, "err"); }
    setBusy(null);
  }

  const done = (orders || []).filter((o) => ["DELIVERED", "CANCELLED"].includes(o.order_status));
  return (
    <Shell role="owner" wide>
      <PageHeader title="Live orders" sub={<span className="inline-flex items-center gap-2"><span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />Auto-refreshing · updated {ago(updated)}</span>}>
        {list && list.length > 1 && (
          <select className="input w-auto py-2 font-semibold" value={scope} onChange={(e) => setScope(Number(e.target.value))}>
            <option value={0}>All my restaurants</option>
            {list.map((r) => <option key={r.restaurant_id} value={r.restaurant_id}>{r.name}</option>)}
          </select>
        )}
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </PageHeader>
      {!orders && <Spinner />}
      {orders && (
        <div className="grid gap-4 overflow-x-auto pb-4 lg:grid-cols-5">
          {COLS.map((c) => {
            const col = orders.filter((o) => o.order_status === c.status);
            return (
              <div key={c.status} className={`min-w-[260px] rounded-2xl border-t-4 bg-ink-100/60 p-3 ${c.tone}`}>
                <div className="mb-3 flex items-center justify-between px-1"><span className="font-bold">{c.title}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">{col.length}</span></div>
                <div className="space-y-3">
                  {col.length === 0 && <div className="rounded-xl border border-dashed border-ink-300 px-3 py-6 text-center text-xs text-ink-500">Nothing here</div>}
                  {col.map((o) => (
                    <div key={o.order_id} className="card p-4 fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold">#{o.order_id}</span>
                        <span className="text-xs text-ink-500">{timeOf(o.placed_at)}</span>
                      </div>
                      <div className="text-xs text-ink-500">{o.customer_name}{list && list.length > 1 ? ` · ${o.restaurant}` : ""}</div>
                      <div className="mt-3 space-y-1">
                        {o.items.map((i: any, k: number) => <div key={k} className="flex items-center gap-2 text-sm"><Veg veg={i.is_veg} /><span className="font-semibold">{i.quantity} ×</span><span>{i.name}</span></div>)}
                      </div>
                      {o.special_instructions && <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">📝 {o.special_instructions}</div>}
                      <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2 text-sm"><span className="text-ink-500">Bill</span><span className="font-bold">{inr2(o.total_amount)}</span></div>
                      {o.partner_name && <div className="mt-1 text-xs text-ink-500">🛵 {o.partner_name} {o.delivery_status ? `· ${o.delivery_status.toLowerCase().replace("_", " ")}` : ""}</div>}
                      <div className="mt-3 flex gap-2">
                        {c.status === "PLACED" && (<>
                          <button className="btn-success btn-sm flex-1" disabled={busy === o.order_id} onClick={() => move(o, "CONFIRMED")}>Accept</button>
                          <button className="btn-danger btn-sm" disabled={busy === o.order_id} onClick={() => move(o, "CANCELLED")}>Reject</button>
                        </>)}
                        {c.status === "CONFIRMED" && <button className="btn-dark btn-sm flex-1" disabled={busy === o.order_id} onClick={() => move(o, "PREPARING")}>Start preparing</button>}
                        {c.status === "PREPARING" && <button className="btn-primary btn-sm flex-1" disabled={busy === o.order_id} onClick={() => move(o, "READY")}>Mark ready</button>}
                        {["CONFIRMED", "PREPARING", "READY"].includes(c.status) && !o.partner_id && <button className="btn-ghost btn-sm" disabled={busy === o.order_id} onClick={() => retry(o)}>Find rider</button>}
                        {c.status === "READY" && o.partner_id && <span className="text-xs text-ink-500">Waiting for the rider to pick up</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {done.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-3 font-bold">Finished today</div>
          <table className="table-clean w-full">
            <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Rider</th><th>Status</th><th className="text-right">Bill</th></tr></thead>
            <tbody>{done.map((o) => (
              <tr key={o.order_id}><td className="font-semibold">#{o.order_id}</td><td>{o.customer_name}</td><td>{timeOf(o.placed_at)}</td><td>{o.partner_name || "–"}</td><td><Pill status={o.order_status} /></td><td className="text-right font-semibold">{inr2(o.total_amount)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
