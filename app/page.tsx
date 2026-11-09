"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import Cover from "@/components/Cover";
import { Rating, Spinner, Empty, Pill } from "@/components/ui";
import { api, inr, hhmm, store, LIVE } from "@/lib/client";

export default function Home() {
  const [addresses, setAddresses] = useState<any[] | null>(null);
  const [addressNo, setAddressNo] = useState<number>(0);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState("");
  const [veg, setVeg] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [data, setData] = useState<any>(null);
  const [live, setLive] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/addresses").then((a) => {
      setAddresses(a);
      const saved = Number(store("br_addr") || 0);
      const pick = a.find((x: any) => x.address_no === saved) || a[0];
      if (pick) setAddressNo(pick.address_no);
    }).catch((e) => setError(e.message));
    api("/api/cuisines").then(setCuisines).catch(() => {});
    api("/api/orders").then((o) => setLive(o.filter((x: any) => LIVE.includes(x.order_status)))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!addressNo) return;
    setData(null);
    store("br_addr", String(addressNo));
    api(`/api/restaurants?addressNo=${addressNo}&cuisine=${encodeURIComponent(cuisine)}`).then(setData).catch((e) => setError(e.message));
  }, [addressNo, cuisine]);

  const list = useMemo(() => {
    if (!data) return [];
    let l = [...data.restaurants];
    if (veg) l = l.filter((r) => Number(r.pure_veg) === 1);
    if (sort === "rating") l.sort((a, b) => b.rating - a.rating);
    if (sort === "time") l.sort((a, b) => a.eta - b.eta);
    if (sort === "cost") l.sort((a, b) => a.cost_for_two - b.cost_for_two);
    return l;
  }, [data, veg, sort]);

  const addr = addresses?.find((a) => a.address_no === addressNo);

  return (
    <Shell role="customer">
      {live.length > 0 && (
        <Link href={`/orders/${live[0].order_id}`} className="mb-6 flex items-center gap-4 rounded-2xl bg-ink-900 px-5 py-4 text-white shadow-lift fade-in">
          <span className="pulse-dot grid h-3 w-3 place-items-center rounded-full bg-emerald-400 text-emerald-400" />
          <div className="flex-1">
            <div className="text-sm text-white/70">Order #{live[0].order_id} from {live[0].restaurant}</div>
            <div className="font-semibold">Track your order live</div>
          </div>
          <Pill status={live[0].order_status} />
          <span className="text-xl">→</span>
        </Link>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-2.5 shadow-card">
          <span className="text-lg">📍</span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Deliver to</div>
            {addresses && addresses.length > 0 ? (
              <select className="-ml-1 max-w-[260px] bg-transparent text-sm font-bold outline-none" value={addressNo} onChange={(e) => setAddressNo(Number(e.target.value))}>
                {addresses.map((a) => <option key={a.address_no} value={a.address_no}>{a.label}: {a.address_line}</option>)}
              </select>
            ) : <div className="text-sm font-bold">No address yet</div>}
          </div>
        </div>
        {addr && <div className="text-sm text-ink-500">{addr.city} · {addr.pincode}</div>}
        <Link href="/account" className="ml-auto text-sm font-semibold text-brand-600 hover:underline">Manage addresses</Link>
      </div>

      {addresses && addresses.length === 0 && (
        <Empty icon="🏠" title="Add a delivery address" text="We need to know where to deliver before we can show restaurants near you.">
          <Link href="/account" className="btn-primary">Add address</Link>
        </Empty>
      )}

      {addresses && addresses.length > 0 && (<>
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button className={`chip ${cuisine === "" ? "chip-on" : ""}`} onClick={() => setCuisine("")}>All</button>
          {cuisines.map((c) => (
            <button key={c} className={`chip ${cuisine === c ? "chip-on" : ""}`} onClick={() => setCuisine(cuisine === c ? "" : c)}>{c}</button>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button className={`chip ${veg ? "border-emerald-600 bg-emerald-50 text-emerald-700" : ""}`} onClick={() => setVeg(!veg)}><span className="veg-mark" /> Pure veg</button>
          <select className="chip pr-8 outline-none" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevance">Sort: Nearest</option>
            <option value="rating">Sort: Rating</option>
            <option value="time">Sort: Delivery time</option>
            <option value="cost">Sort: Cost for two</option>
          </select>
          {data && <span className="ml-auto text-sm text-ink-500">{list.length} restaurants open near you</span>}
        </div>

        {error && <Empty icon="⚠️" title="Couldn't load restaurants" text={error} />}
        {!data && !error && <Spinner label="Finding restaurants near you..." />}
        {data && list.length === 0 && (
          <Empty icon="😴" title="Nothing open nearby right now" text={data.closedNearby ? `${data.closedNearby} restaurants near you are closed at this hour.` : "Try another cuisine or address."} />
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <Link key={r.restaurant_id} href={`/r/${r.restaurant_id}?a=${addressNo}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift fade-in">
              <Cover id={r.restaurant_id} name={r.name} cuisines={r.cuisines} className="h-40">
                <span className="absolute right-3 top-3 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-ink-900 shadow">{r.eta} min</span>
                {Number(r.pure_veg) === 1 && <span className="absolute left-3 top-3 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Pure veg</span>}
              </Cover>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-lg font-bold leading-tight group-hover:text-brand-600">{r.name}</div>
                  <Rating value={r.rating} />
                </div>
                <div className="mt-1 truncate text-sm text-ink-500">{r.cuisines}</div>
                <div className="mt-3 flex items-center gap-3 text-sm text-ink-700">
                  <span>{inr(r.cost_for_two)} for two</span><span className="text-ink-300">•</span><span>{Number(r.km).toFixed(1)} km</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {data && data.closed && data.closed.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 text-sm font-semibold text-ink-500">Closed right now</div>
            <div className="flex flex-wrap gap-2">
              {data.closed.map((r: any) => (
                <span key={r.restaurant_id} className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm text-ink-500">{r.name} · opens {hhmm(r.opening_time)}</span>
              ))}
            </div>
          </div>
        )}
      </>)}
    </Shell>
  );
}
