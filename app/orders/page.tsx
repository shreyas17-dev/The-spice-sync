"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Pill, Spinner, Empty, toast } from "@/components/ui";
import { api, inr2, dateTime, cartChanged, LIVE } from "@/lib/client";

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[] | null>(null);
  useEffect(() => { api("/api/orders").then(setOrders).catch(() => setOrders([])); }, []);

  async function reorder(id: number) {
    try {
      await api("/api/cart", { body: { reorder: id } });
      cartChanged();
      router.push("/checkout");
    } catch (e: any) { toast(e.message, "err"); }
  }

  return (
    <Shell role="customer">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">My orders</h1>
      {!orders && <Spinner />}
      {orders && orders.length === 0 && <Empty icon="🧾" title="No orders yet" text="Your orders will show up here."><Link href="/" className="btn-primary">Order now</Link></Empty>}
      <div className="space-y-4">
        {orders?.map((o) => (
          <div key={o.order_id} className="card flex flex-wrap items-center gap-4 p-5 fade-in">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-2xl">{LIVE.includes(o.order_status) ? "🛵" : o.order_status === "CANCELLED" ? "✖️" : "✅"}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{o.restaurant}</span><Pill status={o.order_status} />
              </div>
              <div className="mt-1 truncate text-sm text-ink-500">{o.items}</div>
              <div className="mt-1 text-xs text-ink-500">Order #{o.order_id} · {dateTime(o.placed_at)} · {inr2(o.total_amount)}</div>
            </div>
            <div className="flex gap-2">
              <Link href={`/orders/${o.order_id}`} className={LIVE.includes(o.order_status) ? "btn-primary btn-sm" : "btn-ghost btn-sm"}>{LIVE.includes(o.order_status) ? "Track live" : "Details"}</Link>
              {o.order_status === "DELIVERED" && !Number(o.reviewed) && <Link href={`/orders/${o.order_id}#rate`} className="btn-ghost btn-sm">Rate</Link>}
              {!LIVE.includes(o.order_status) && <button className="btn-ghost btn-sm" onClick={() => reorder(o.order_id)}>Reorder</button>}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
