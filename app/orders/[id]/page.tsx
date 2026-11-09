"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { Pill, Spinner, Empty, Veg, ErrorBox, toast } from "@/components/ui";
import { api, inr2, timeOf, dateTime, toDate, STATUS_LABEL } from "@/lib/client";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-2xl bg-ink-100" /> });

const STEPS = ["PLACED", "CONFIRMED", "PREPARING", "READY", "PICKED_UP", "DELIVERED"];
const STEP_TEXT: Record<string, string> = {
  PLACED: "Waiting for the restaurant to accept", CONFIRMED: "Restaurant accepted your order", PREPARING: "Your food is being cooked",
  READY: "Packed and waiting for the rider", PICKED_UP: "On the way to you", DELIVERED: "Delivered. Enjoy your meal!", CANCELLED: "This order was cancelled",
};

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className={`text-3xl transition ${n <= value ? "text-amber-400" : "text-ink-100 hover:text-amber-200"}`}>★</button>
      ))}
    </div>
  );
}

export default function Track() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [rider, setRider] = useState<any>(null);
  const [live, setLive] = useState(false);
  const [food, setFood] = useState(0);
  const [del, setDel] = useState(0);
  const [comment, setComment] = useState("");
  const [rateErr, setRateErr] = useState<string | null>(null);
  const loadRef = useRef<() => void>(() => {});

  async function load() {
    try {
      const d = await api(`/api/orders/${id}`);
      setData(d);
      if (d.rider) setRider(d.rider);
    } catch (e: any) { setError(e.message); }
  }
  loadRef.current = load;

  useEffect(() => {
    load();
    const es = new EventSource(`/api/orders/${id}/stream`);
    es.addEventListener("ready", (e: any) => { try { setLive(JSON.parse(e.data).live); } catch {} });
    es.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === "location") setRider({ lat: Number(m.lat), lng: Number(m.long) });
        if (m.status) { loadRef.current(); toast(STATUS_LABEL[m.status] ? `Order ${STATUS_LABEL[m.status].toLowerCase()}` : "Order updated"); }
      } catch {}
    };
    es.onerror = () => setLive(false);
    const poll = setInterval(() => loadRef.current(), 30000);
    return () => { es.close(); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function cancel() {
    try { await api(`/api/orders/${id}/cancel`, { method: "POST" }); toast("Order cancelled"); load(); }
    catch (e: any) { toast(e.message, "err"); }
  }
  async function rate() {
    setRateErr(null);
    try { await api(`/api/orders/${id}/review`, { body: { food, delivery: del, comment } }); toast("Thanks for rating!"); load(); }
    catch (e: any) { setRateErr(e.message); }
  }

  if (error) return <Shell role="customer"><Empty icon="🔍" title="Order not found" text={error}><Link href="/orders" className="btn-primary">My orders</Link></Empty></Shell>;
  if (!data) return <Shell role="customer"><Spinner label="Loading your order..." /></Shell>;
  const o = data.order;
  const cancelled = o.order_status === "CANCELLED";
  const stepIndex = STEPS.indexOf(o.order_status);
  const when = (s: string) => {
    const ev = data.events.find((e: any) => e.status === s);
    if (ev) return new Date(ev.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    if (s === "PLACED") return timeOf(o.placed_at);
    if (s === "PICKED_UP" && o.picked_up_at) return timeOf(o.picked_up_at);
    if (s === "DELIVERED" && o.delivered_at) return timeOf(o.delivered_at);
    return "";
  };
  const pins: any[] = [
    { id: "r", lat: Number(o.r_lat), lng: Number(o.r_long), emoji: "🍽️", label: o.restaurant },
    { id: "h", lat: Number(o.a_lat), lng: Number(o.a_long), emoji: "🏠", label: "Your address" },
  ];
  const showRider = rider && o.partner_id && ["CONFIRMED", "PREPARING", "READY", "PICKED_UP"].includes(o.order_status);
  if (showRider) pins.push({ id: "p", lat: rider.lat, lng: rider.lng, emoji: "🛵", label: o.partner_name, rider: true });
  const mins = Math.max(0, Math.round((Date.now() - (toDate(o.placed_at)?.getTime() || Date.now())) / 60000));

  return (
    <Shell role="customer">
      <Link href="/orders" className="mb-4 inline-block text-sm font-semibold text-ink-500 hover:text-ink-900">← My orders</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm text-ink-500">Order #{o.order_id} · {dateTime(o.placed_at)}</div>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{STEP_TEXT[o.order_status]}</h1>
                <div className="mt-1 text-sm text-ink-500">from <span className="font-semibold text-ink-900">{o.restaurant}</span>{!cancelled && o.order_status !== "DELIVERED" && <> · {mins} min since you ordered</>}</div>
              </div>
              <div className="flex items-center gap-2">
                {live && !cancelled && o.order_status !== "DELIVERED" && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><span className="pulse-dot h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />LIVE</span>
                )}
                <Pill status={o.order_status} />
              </div>
            </div>
            {!cancelled && (
              <div className="mt-6 grid grid-cols-6 gap-1">
                {STEPS.map((s, i) => (
                  <div key={s} className="text-center">
                    <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-brand-500" : "bg-ink-100"}`} />
                    <div className={`mt-2 text-[11px] font-semibold leading-tight ${i <= stepIndex ? "text-ink-900" : "text-ink-300"}`}>{STATUS_LABEL[s]}</div>
                    <div className="text-[11px] text-ink-500">{i <= stepIndex ? when(s) : ""}</div>
                  </div>
                ))}
              </div>
            )}
            {o.order_status === "PLACED" && (
              <div className="mt-6 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                <span className="text-sm text-amber-800">Changed your mind? You can cancel until the restaurant accepts.</span>
                <button className="btn-danger btn-sm" onClick={cancel}>Cancel order</button>
              </div>
            )}
          </div>

          <div className="card overflow-hidden p-2">
            <MapView pins={pins} line={showRider ? [[rider.lat, rider.lng], ...(o.order_status === "PICKED_UP" ? [] : [[Number(o.r_lat), Number(o.r_long)]]), [Number(o.a_lat), Number(o.a_long)]] as any : [[Number(o.r_lat), Number(o.r_long)], [Number(o.a_lat), Number(o.a_long)]]} className="h-80" fitKey={o.order_status} />
          </div>

          {o.order_status === "DELIVERED" && !o.food_rating && (
            <div id="rate" className="card p-6">
              <div className="h-section">How was it?</div>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div><div className="mb-1 text-sm font-semibold">Food from {o.restaurant}</div><Stars value={food} onChange={setFood} /></div>
                <div><div className="mb-1 text-sm font-semibold">Delivery by {o.partner_name || "the rider"}</div><Stars value={del} onChange={setDel} /></div>
              </div>
              <textarea className="input mt-4" rows={3} placeholder="Tell us more (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="mt-3"><ErrorBox error={rateErr} /></div>
              <button className="btn-primary mt-3" disabled={!food || !del} onClick={rate}>Submit rating</button>
            </div>
          )}
          {o.food_rating && (
            <div className="card p-6">
              <div className="h-section">Your rating</div>
              <div className="mt-2 text-sm">Food <span className="text-amber-500">{"★".repeat(o.food_rating)}</span> · Delivery <span className="text-amber-500">{"★".repeat(o.delivery_rating)}</span></div>
              {o.review_comment && <div className="mt-1 text-sm text-ink-500">&ldquo;{o.review_comment}&rdquo;</div>}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          {o.partner_id && !cancelled && (
            <div className="card p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-2xl">🛵</div>
                <div className="flex-1">
                  <div className="font-bold">{o.partner_name}</div>
                  <div className="text-xs text-ink-500">{o.vehicle_type?.toLowerCase()} {o.vehicle_number ? `· ${o.vehicle_number}` : ""} {o.partner_rating ? `· ${Number(o.partner_rating).toFixed(1)} ★` : ""}</div>
                </div>
                <a href={`tel:${o.partner_phone}`} className="btn-ghost btn-sm">📞 Call</a>
              </div>
              <div className="mt-3 text-xs text-ink-500">Your delivery partner{o.distance_km ? ` · ${Number(o.distance_km).toFixed(1)} km trip` : ""}</div>
            </div>
          )}
          <div className="card p-5">
            <div className="h-section mb-3">Bill</div>
            <div className="space-y-2 text-sm">
              {data.items.map((i: any) => (
                <div key={i.line_no} className="flex items-center gap-2"><Veg veg={i.is_veg} /><span className="flex-1">{i.name} × {i.quantity}</span><span>{inr2(i.item_total)}</span></div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-3 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Item total</span><span>{inr2(o.subtotal)}</span></div>
              {o.discount_amount > 0 && <div className="flex justify-between text-emerald-700"><span>Coupon {o.coupon_code}</span><span>− {inr2(o.discount_amount)}</span></div>}
              <div className="flex justify-between"><span className="text-ink-500">GST</span><span>{inr2(o.tax_amount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Delivery fee</span><span>{o.delivery_fee > 0 ? inr2(o.delivery_fee) : "FREE"}</span></div>
              <div className="flex justify-between border-t border-ink-100 pt-2 font-extrabold"><span>Total</span><span>{inr2(o.total_amount)}</span></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-xs">
              <span>{o.method === "COD" ? "Cash on delivery" : o.method}</span><Pill status={o.payment_status} />
            </div>
          </div>
          <div className="card p-5 text-sm">
            <div className="font-bold">Delivering to</div>
            <div className="mt-1 text-ink-500">{o.address_label}: {o.address_line}, {o.city} {o.pincode}</div>
            {o.special_instructions && <><div className="mt-3 font-bold">Your note</div><div className="mt-1 text-ink-500">{o.special_instructions}</div></>}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
