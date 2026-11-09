"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import BarChart from "@/components/BarChart";
import { Spinner, Stat, PageHeader } from "@/components/ui";
import { api, inr, inr2, dateTime } from "@/lib/client";

export default function Earnings() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api("/api/partner/earnings").then(setD).catch(() => {}); }, []);
  if (!d) return <Shell role="partner"><Spinner /></Shell>;
  const s = d.summary;
  return (
    <Shell role="partner">
      <PageHeader title="Earnings" sub="₹20 per trip + ₹7 per km, paid on every delivered order" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today" value={inr2(s.today)} icon="☀️" tone="amber" />
        <Stat label="Last 7 days" value={inr2(s.week)} icon="📅" tone="blue" />
        <Stat label="Lifetime" value={inr2(s.lifetime)} sub={`${s.deliveries} deliveries · ${Number(s.km).toFixed(0)} km`} icon="💰" tone="green" />
        <Stat label="Rating" value={d.stats?.rating_avg ? `${Number(d.stats.rating_avg).toFixed(1)} ★` : "New"} icon="⭐" tone="violet" />
      </div>
      <div className="card mt-6 p-6">
        <div className="h-section">This week</div>
        <BarChart data={d.days.map((x: any) => ({ label: new Date(String(x.day) + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }), value: Number(x.earned) }))} format={(v) => inr2(v)} color="#059669" />
      </div>
      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-3 font-bold">Recent deliveries</div>
        <table className="table-clean w-full">
          <thead><tr><th>Order</th><th>From</th><th>To</th><th>Distance</th><th>When</th><th className="text-right">Earned</th></tr></thead>
          <tbody>
            {d.recent.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-ink-500">No deliveries yet</td></tr>}
            {d.recent.map((r: any) => (
              <tr key={r.order_id}><td className="font-semibold">#{r.order_id}</td><td>{r.restaurant_name}</td><td className="max-w-[220px] truncate text-ink-500">{r.drop_address}</td><td>{Number(r.distance_km).toFixed(1)} km</td><td>{dateTime(r.delivered_at)}</td><td className="text-right font-semibold text-emerald-700">{inr2(r.partner_earning)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
