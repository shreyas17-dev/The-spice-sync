"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, Toggle, Pill, Stat, toast, Empty } from "@/components/ui";
import { api, inr, inr2, STATUS_LABEL } from "@/lib/client";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-2xl bg-ink-100" /> });

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export default function PartnerHome() {
  const [me, setMe] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [riding, setRiding] = useState(false);
  const [busy, setBusy] = useState(false);
  const posRef = useRef<any>(null);
  const taskRef = useRef<any>(null);
  posRef.current = pos;
  taskRef.current = task;

  async function load() {
    try {
      const [m, t] = await Promise.all([api("/api/partner/me"), api("/api/partner/tasks")]);
      setMe(m);
      setTask(t.current[0] || null);
      if (!posRef.current && m.cur_lat) setPos({ lat: Number(m.cur_lat), lng: Number(m.cur_long) });
    } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  // simulated ride: move ~150 m every 2 s towards the restaurant, then the customer
  useEffect(() => {
    if (!riding) return;
    const id = setInterval(async () => {
      const t = taskRef.current, p = posRef.current;
      if (!t || !p) { setRiding(false); return; }
      const toDrop = t.order_status === "PICKED_UP";
      const target = toDrop ? { lat: Number(t.drop_lat), lng: Number(t.drop_long) } : { lat: Number(t.pickup_lat), lng: Number(t.pickup_long) };
      const d = km(p, target);
      if (d < 0.05) { if (toDrop) { setRiding(false); toast("You have reached the customer"); } return; }
      const f = Math.min(1, 0.15 / d);
      const next = { lat: p.lat + (target.lat - p.lat) * f, lng: p.lng + (target.lng - p.lng) * f };
      setPos(next);
      api("/api/partner/location", { body: next }).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [riding]);

  async function setOnline(v: boolean) {
    setBusy(true);
    try {
      let p = posRef.current;
      if (v && !p) p = { lat: 12.9352, lng: 77.6245 };
      await api("/api/partner/me", { method: "PATCH", body: { availability: v ? "ONLINE" : "OFFLINE", lat: p?.lat, lng: p?.lng } });
      toast(v ? "You're online. Orders near you will be assigned automatically." : "You're offline.");
      await load();
    } catch (e: any) { toast(e.message, "err"); }
    setBusy(false);
  }
  async function update(status: string) {
    setBusy(true);
    try {
      await api("/api/partner/tasks", { method: "PATCH", body: { orderId: task.order_id, status } });
      toast(status === "PICKED_UP" ? "Picked up. Head to the customer." : "Delivered! Nice work.");
      if (status === "DELIVERED") setRiding(false);
      await load();
    } catch (e: any) { toast(e.message, "err"); }
    setBusy(false);
  }

  if (!me) return <Shell role="partner"><Spinner /></Shell>;
  const online = me.availability !== "OFFLINE";
  const pins: any[] = [];
  if (pos) pins.push({ id: "me", lat: pos.lat, lng: pos.lng, emoji: "🛵", label: "You", rider: true });
  let line: any = undefined;
  if (task) {
    pins.push({ id: "r", lat: Number(task.pickup_lat), lng: Number(task.pickup_long), emoji: "🍽️", label: task.restaurant_name });
    pins.push({ id: "h", lat: Number(task.drop_lat), lng: Number(task.drop_long), emoji: "🏠", label: task.customer_name });
    line = pos ? (task.order_status === "PICKED_UP"
      ? [[pos.lat, pos.lng], [Number(task.drop_lat), Number(task.drop_long)]]
      : [[pos.lat, pos.lng], [Number(task.pickup_lat), Number(task.pickup_long)], [Number(task.drop_lat), Number(task.drop_long)]]) : undefined;
  }

  return (
    <Shell role="partner">
      <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-3xl">🛵</div>
        <div className="flex-1">
          <div className="text-lg font-bold">Hi, {me.full_name.split(" ")[0]}</div>
          <div className="text-sm text-ink-500">{me.vehicle_type?.toLowerCase()} {me.vehicle_number ? `· ${me.vehicle_number}` : ""} · {me.rating_avg ? `${Number(me.rating_avg).toFixed(1)} ★` : "no ratings yet"}</div>
        </div>
        <Pill status={me.availability} />
        <div className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-2">
          <span className="text-sm font-semibold">{online ? "Online" : "Offline"}</span>
          <Toggle on={online} disabled={busy || me.status !== "ACTIVE" || me.availability === "BUSY"} onChange={setOnline} />
        </div>
      </div>
      {me.status !== "ACTIVE" && (
        <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {me.status === "PENDING" ? "Your account is waiting for admin verification. You can go online once it is verified." : "Your account is blocked. Please contact support."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-hidden p-2">
          {pos ? <MapView pins={pins} line={line} className="h-[460px]" fitKey={task ? `${task.order_id}-${task.order_status}` : "none"} />
            : <div className="grid h-[460px] place-items-center text-sm text-ink-500">Go online to share your location.</div>}
        </div>
        <div className="space-y-4">
          {!task && (
            <Empty icon={online ? "📡" : "😴"} title={online ? "Waiting for orders" : "You're offline"}
              text={online ? "When a restaurant near you accepts an order, it's assigned to the nearest free rider automatically." : "Switch online to start receiving deliveries."} />
          )}
          {task && (
            <div className="card p-5 fade-in">
              <div className="flex items-center justify-between">
                <div className="font-extrabold">Order #{task.order_id}</div>
                <Pill status={task.order_status} />
              </div>
              <div className="mt-1 text-sm text-ink-500">{Number(task.distance_km).toFixed(1)} km trip · you earn <span className="font-bold text-emerald-700">{inr2(task.partner_earning)}</span></div>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <span className="mt-0.5 text-xl">🍽️</span>
                  <div><div className="text-xs font-semibold uppercase text-ink-500">Pick up</div><div className="font-semibold">{task.restaurant_name}</div><div className="text-sm text-ink-500">{task.pickup_address}</div><a className="text-sm font-semibold text-brand-600" href={`tel:${task.restaurant_phone}`}>📞 {task.restaurant_phone}</a></div>
                </div>
                <div className="flex gap-3">
                  <span className="mt-0.5 text-xl">🏠</span>
                  <div><div className="text-xs font-semibold uppercase text-ink-500">Drop</div><div className="font-semibold">{task.customer_name}</div><div className="text-sm text-ink-500">{task.drop_address} {task.drop_pincode}</div><a className="text-sm font-semibold text-brand-600" href={`tel:${task.customer_phone}`}>📞 {task.customer_phone}</a></div>
                </div>
              </div>
              <div className={`mt-4 rounded-xl px-3 py-2 text-sm ${task.payment_method === "COD" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                {task.payment_method === "COD" ? `💵 Collect ${inr(task.total_amount)} in cash` : "✅ Paid online, nothing to collect"}
              </div>
              <div className="mt-4 grid gap-2">
                <button className={riding ? "btn-ghost" : "btn-dark"} onClick={() => setRiding(!riding)}>{riding ? "⏸ Stop simulated ride" : "▶ Simulate ride (sends live location)"}</button>
                {task.order_status !== "PICKED_UP" && (
                  <button className="btn-primary" disabled={busy || task.order_status !== "READY"} onClick={() => update("PICKED_UP")}>
                    {task.order_status === "READY" ? "Picked up the order" : `Waiting: ${STATUS_LABEL[task.order_status]}`}
                  </button>
                )}
                {task.order_status === "PICKED_UP" && <button className="btn-success" disabled={busy} onClick={() => update("DELIVERED")}>Mark as delivered</button>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Deliveries" value={me.deliveries_done || 0} icon="📦" tone="blue" />
            <Stat label="Earned" value={inr(me.total_earnings)} icon="💰" tone="green" />
          </div>
        </div>
      </div>
    </Shell>
  );
}
