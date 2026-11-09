"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, ErrorBox, toast, Pill } from "@/components/ui";
import { useRestaurants, RestaurantPicker } from "@/components/OwnerPicker";
import { api } from "@/lib/client";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-56 animate-pulse rounded-2xl bg-ink-100" /> });
const CITY_CENTER: Record<string, [number, number]> = { Bengaluru: [12.9716, 77.5946], Mumbai: [19.076, 72.8777], Hyderabad: [17.385, 78.4867] };

export default function OwnerSettings() {
  const { list, rid, current, choose, reload } = useRestaurants();
  const [f, setF] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pins, setPins] = useState<any[]>([]);
  const [nr, setNr] = useState<any>({ opening_time: "11:00", closing_time: "23:00", avg_prep_time: 20, cost_for_two: 400 });
  const [nerr, setNerr] = useState<string | null>(null);

  useEffect(() => { api("/api/pincodes").then(setPins).catch(() => {}); }, []);
  useEffect(() => {
    if (current) setF({ ...current, opening_time: String(current.opening_time).slice(0, 5), closing_time: String(current.closing_time).slice(0, 5) });
  }, [current]);

  async function save() {
    setErr(null);
    try { await api("/api/owner/restaurants", { method: "PATCH", body: f }); toast("Saved"); reload(); }
    catch (e: any) { setErr(e.message); }
  }
  async function register() {
    setNerr(null);
    try { await api("/api/owner/restaurants", { body: nr }); toast("Submitted for approval"); setNr({ opening_time: "11:00", closing_time: "23:00", avg_prep_time: 20, cost_for_two: 400 }); reload(); }
    catch (e: any) { setNerr(e.message); }
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const city = pins.find((x) => x.pincode === nr.pincode)?.city;

  return (
    <Shell role="owner">
      <PageHeader title="Restaurant details"><RestaurantPicker list={list} rid={rid} choose={choose} /></PageHeader>
      {!list && <Spinner />}
      <div className="grid gap-6 lg:grid-cols-2">
        {f && (
          <div className="card p-6">
            <div className="flex items-center justify-between"><div className="h-section">{f.name}</div><Pill status={f.status} /></div>
            <div className="mt-1 text-sm text-ink-500">{f.address_line}, {f.city} {f.pincode} · commission {f.commission_pct}% (set by admin)</div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label">Name</label><input className="input" value={f.name} onChange={set("name")} /></div>
              <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set("phone")} /></div>
              <div><label className="label">Cost for two (₹)</label><input className="input" type="number" value={f.cost_for_two} onChange={set("cost_for_two")} /></div>
              <div><label className="label">Opens at</label><input className="input" type="time" value={f.opening_time} onChange={set("opening_time")} /></div>
              <div><label className="label">Closes at</label><input className="input" type="time" value={f.closing_time} onChange={set("closing_time")} /></div>
              <div><label className="label">Average preparation (min)</label><input className="input" type="number" value={f.avg_prep_time} onChange={set("avg_prep_time")} /></div>
              <div><label className="label">Cuisines (comma separated)</label><input className="input" value={f.cuisines || ""} onChange={set("cuisines")} /></div>
            </div>
            <div className="mt-4"><ErrorBox error={err} /></div>
            <button className="btn-dark mt-4" onClick={save}>Save changes</button>
            <p className="mt-3 text-xs text-ink-500">Status and commission can only be changed by an admin; MySQL itself blocks owners from editing those columns.</p>
          </div>
        )}
        <div className="card p-6">
          <div className="h-section">Register another restaurant</div>
          <p className="mt-1 text-sm text-ink-500">New restaurants start as pending and go live after an admin approves them.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Name</label><input className="input" value={nr.name || ""} onChange={(e) => setNr({ ...nr, name: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={nr.phone || ""} onChange={(e) => setNr({ ...nr, phone: e.target.value })} /></div>
            <div><label className="label">PIN code</label>
              <select className="input" value={nr.pincode || ""} onChange={(e) => setNr({ ...nr, pincode: e.target.value, latitude: undefined, longitude: undefined })}>
                <option value="">Choose</option>{pins.map((x) => <option key={x.pincode} value={x.pincode}>{x.pincode} · {x.city}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={nr.address_line || ""} onChange={(e) => setNr({ ...nr, address_line: e.target.value })} /></div>
            <div><label className="label">Opens at</label><input className="input" type="time" value={nr.opening_time} onChange={(e) => setNr({ ...nr, opening_time: e.target.value })} /></div>
            <div><label className="label">Closes at</label><input className="input" type="time" value={nr.closing_time} onChange={(e) => setNr({ ...nr, closing_time: e.target.value })} /></div>
            <div><label className="label">Cost for two (₹)</label><input className="input" type="number" value={nr.cost_for_two} onChange={(e) => setNr({ ...nr, cost_for_two: e.target.value })} /></div>
            <div><label className="label">Cuisines</label><input className="input" placeholder="North Indian, Chinese" value={nr.cuisines || ""} onChange={(e) => setNr({ ...nr, cuisines: e.target.value })} /></div>
          </div>
          <div className="mt-3 text-xs font-semibold text-ink-500">Click the map to set the location.</div>
          <div className="mt-2">
            <MapView className="h-56" center={nr.latitude ? [nr.latitude, nr.longitude] : CITY_CENTER[city || "Bengaluru"]} fitKey={city}
              pins={nr.latitude ? [{ id: "n", lat: nr.latitude, lng: nr.longitude, emoji: "🏪" }] : []}
              onPick={(lat, lng) => setNr((x: any) => ({ ...x, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) }))} />
          </div>
          <div className="mt-4"><ErrorBox error={nerr} /></div>
          <button className="btn-primary mt-4" onClick={register} disabled={!nr.latitude}>Submit for approval</button>
        </div>
      </div>
    </Shell>
  );
}
