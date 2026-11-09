"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import BarChart from "@/components/BarChart";
import { Spinner, Stat, PageHeader, Pill } from "@/components/ui";
import { api, inr, STATUS_LABEL } from "@/lib/client";

export default function AdminHome() {
  const [d, setD] = useState<any>(null);
  const load = () => api("/api/admin/overview").then(setD).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  if (!d) return <Shell role="admin" wide><Spinner /></Shell>;
  const totalMethods = d.methods.reduce((s: number, m: any) => s + Number(m.n), 0) || 1;
  return (
    <Shell role="admin" wide>
      <PageHeader title="Platform overview" sub="Live numbers from MySQL; activity from Redis" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders today" value={d.today.orders || 0} sub={`${d.today.live || 0} in progress right now`} icon="🧾" />
        <Stat label="Order value today" value={inr(d.today.gmv)} sub="Excluding cancelled orders" icon="💰" tone="green" />
        <Stat label="Commission today" value={inr(d.today.commission)} sub="From delivered orders" icon="🏦" tone="blue" />
        <Stat label="Riders online" value={d.counts.riders_online} sub={`${d.counts.riders_busy} on a delivery`} icon="🛵" tone="violet" />
      </div>
      {(d.counts.pending_restaurants > 0 || d.counts.pending_partners > 0) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {d.counts.pending_restaurants > 0 && <Link href="/admin/restaurants" className="flex items-center justify-between rounded-2xl bg-amber-50 px-5 py-4 font-semibold text-amber-800 ring-1 ring-amber-200"><span>🏪 {d.counts.pending_restaurants} restaurant(s) waiting for approval</span><span>Review →</span></Link>}
          {d.counts.pending_partners > 0 && <Link href="/admin/partners" className="flex items-center justify-between rounded-2xl bg-amber-50 px-5 py-4 font-semibold text-amber-800 ring-1 ring-amber-200"><span>🛵 {d.counts.pending_partners} rider(s) waiting for verification</span><span>Review →</span></Link>}
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-6">
          <div className="h-section">Delivered order value, last 14 days</div>
          <div className="text-sm text-ink-500">{d.daily.reduce((s: number, x: any) => s + Number(x.orders), 0)} orders · {inr(d.daily.reduce((s: number, x: any) => s + Number(x.commission), 0))} commission</div>
          <div className="mt-4"><BarChart data={d.daily.map((x: any) => ({ label: new Date(String(x.day) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: Number(x.gmv) }))} format={(v) => inr(v)} /></div>
        </div>
        <div className="card p-6">
          <div className="h-section mb-4">Orders in progress</div>
          {d.live.length === 0 && <div className="text-sm text-ink-500">No live orders.</div>}
          <div className="space-y-2">
            {d.live.map((l: any) => (
              <div key={l.order_status} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2"><Pill status={l.order_status} /><span className="font-bold">{l.n}</span></div>
            ))}
          </div>
          <div className="h-section mb-3 mt-6">How customers pay</div>
          <div className="space-y-2">
            {d.methods.map((m: any) => (
              <div key={m.method}>
                <div className="flex justify-between text-sm"><span>{m.method}</span><span className="text-ink-500">{Math.round((Number(m.n) * 100) / totalMethods)}%</span></div>
                <div className="mt-1 h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(Number(m.n) * 100) / totalMethods}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-3 font-bold">Top restaurants · last 30 days</div>
          <table className="table-clean w-full">
            <thead><tr><th>Restaurant</th><th>City</th><th>Orders</th><th className="text-right">Gross</th><th className="text-right">Commission</th></tr></thead>
            <tbody>{d.top.map((t: any) => (
              <tr key={t.restaurant_id}><td className="font-semibold">{t.name}</td><td>{t.city}</td><td>{t.orders}</td><td className="text-right">{inr(t.gross)}</td><td className="text-right">{inr(t.commission)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-3 font-bold">By city · all time</div>
          <table className="table-clean w-full">
            <thead><tr><th>City</th><th>Delivered orders</th><th className="text-right">Order value</th></tr></thead>
            <tbody>{d.cities.map((c: any) => (
              <tr key={c.city}><td className="font-semibold">{c.city}</td><td>{c.orders}</td><td className="text-right">{inr(c.gmv)}</td></tr>
            ))}</tbody>
          </table>
          <div className="grid grid-cols-3 gap-3 border-t border-ink-100 p-5 text-center text-sm">
            <div><div className="text-xl font-extrabold">{d.counts.restaurants}</div><div className="text-ink-500">active restaurants</div></div>
            <div><div className="text-xl font-extrabold">{d.counts.customers}</div><div className="text-ink-500">customers</div></div>
            <div><div className="text-xl font-extrabold">{d.counts.riders_online}</div><div className="text-ink-500">riders online</div></div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
