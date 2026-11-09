"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import BarChart from "@/components/BarChart";
import { Stat, Spinner, Empty, PageHeader, Rating } from "@/components/ui";
import { useRestaurants, RestaurantPicker } from "@/components/OwnerPicker";
import { api, inr, inr2 } from "@/lib/client";

export default function OwnerDashboard() {
  const { list, rid, current, choose } = useRestaurants();
  const [days, setDays] = useState(14);
  const [rep, setRep] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rid) return;
    setRep(null); setError(null);
    api(`/api/owner/reports?restaurantId=${rid}&days=${days}`).then(setRep).catch((e) => setError(e.message));
  }, [rid, days]);

  if (list && list.length === 0) return (
    <Shell role="owner"><Empty icon="🏪" title="Add your first restaurant" text="Register your restaurant; it goes live after an admin approves it."><Link href="/owner/settings" className="btn-primary">Add restaurant</Link></Empty></Shell>
  );

  return (
    <Shell role="owner">
      <PageHeader title={current ? current.name : "Dashboard"} sub={current ? `${current.cuisines || ""} · ${current.city}` : ""}>
        <RestaurantPicker list={list} rid={rid} choose={choose} />
        <select className="input w-auto py-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
        </select>
      </PageHeader>
      {current && current.status === "PENDING" && <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This restaurant is waiting for admin approval. Customers can't see it yet.</div>}
      {error && <Empty icon="⚠️" title="Couldn't load the report" text={error} />}
      {!rep && !error && <Spinner />}
      {rep && (<>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Today's orders" value={rep.today?.orders || 0} sub={`${rep.today?.waiting || 0} waiting · ${rep.today?.in_kitchen || 0} in the kitchen`} icon="🧾" />
          <Stat label="Today's sales" value={inr(rep.today?.sales)} sub="Item total, excluding cancelled" icon="💰" tone="green" />
          <Stat label={`Net payout · ${days} days`} value={inr(rep.totals.net)} sub={`after ${inr(rep.totals.commission)} commission`} icon="🏦" tone="blue" />
          <Stat label="Rating" value={rep.rating?.rating_avg ? `${Number(rep.rating.rating_avg).toFixed(1)} ★` : "New"} sub={`${rep.rating?.rating_count || 0} reviews`} icon="⭐" tone="amber" />
        </div>
        {Number(rep.today?.waiting) > 0 && (
          <Link href="/owner/orders" className="mt-6 flex items-center justify-between rounded-2xl bg-brand-500 px-5 py-4 font-semibold text-white shadow-lift">
            <span>🔔 {rep.today.waiting} new order{rep.today.waiting > 1 ? "s" : ""} waiting for you to accept</span><span>Open live orders →</span>
          </Link>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div><div className="h-section">Daily sales</div><div className="text-sm text-ink-500">{rep.totals.orders} delivered orders · {inr(rep.totals.gross)} gross</div></div>
              <span className="text-xs text-ink-500">sp_restaurant_sales_report</span>
            </div>
            <div className="mt-4">
              <BarChart data={rep.daily.map((d: any) => ({ label: new Date(String(d.day) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: Number(d.gross_sales) }))} format={(v) => inr(v)} />
            </div>
          </div>
          <div className="card p-6">
            <div className="h-section mb-4">Best sellers</div>
            {rep.top.length === 0 && <div className="text-sm text-ink-500">No sales in this period yet.</div>}
            <div className="space-y-3">
              {rep.top.map((t: any) => (
                <div key={t.item_id} className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold ${t.sales_rank === 1 ? "bg-amber-100 text-amber-700" : "bg-ink-50 text-ink-700"}`}>#{t.sales_rank}</span>
                  <div className="flex-1"><div className="text-sm font-semibold">{t.name}</div><div className="text-xs text-ink-500">{t.qty_sold} sold</div></div>
                  <div className="text-sm font-semibold">{inr(t.revenue)}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-ink-50 p-4 text-sm">
              <div className="text-ink-500">Net revenue, last 30 days</div>
              <div className="text-xl font-extrabold">{inr2(rep.net30)}</div>
              <div className="text-xs text-ink-500">fn_restaurant_revenue · commission {current?.commission_pct}%</div>
            </div>
          </div>
        </div>
      </>)}
    </Shell>
  );
}
