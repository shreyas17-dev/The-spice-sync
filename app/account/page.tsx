"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, ErrorBox, toast, Stat } from "@/components/ui";
import { api, dateTime, ago, store } from "@/lib/client";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-ink-100" /> });

const CITY_CENTER: Record<string, [number, number]> = { Bengaluru: [12.9716, 77.5946], Mumbai: [19.076, 72.8777], Hyderabad: [17.385, 78.4867] };

export default function Account() {
  const [p, setP] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [addresses, setAddresses] = useState<any[]>([]);
  const [pins, setPins] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [na, setNa] = useState<any>({ label: "Home", is_default: false });
  const [err, setErr] = useState<string | null>(null);
  const [perr, setPerr] = useState<string | null>(null);

  const loadAddr = () => api("/api/addresses").then(setAddresses).catch(() => {});
  useEffect(() => {
    api("/api/profile").then((x) => { setP(x); setForm({ full_name: x.full_name, phone: x.phone, date_of_birth: x.date_of_birth || "" }); });
    loadAddr();
    api("/api/pincodes").then(setPins).catch(() => {});
    api("/api/notifications").then(setNotes).catch(() => {});
  }, []);

  async function saveProfile() {
    setPerr(null);
    try { await api("/api/profile", { method: "PATCH", body: form }); toast("Profile saved"); }
    catch (e: any) { setPerr(e.message); }
  }
  async function addAddress() {
    setErr(null);
    try {
      await api("/api/addresses", { body: na });
      toast("Address added"); setAdding(false); setNa({ label: "Home", is_default: false }); loadAddr();
    } catch (e: any) { setErr(e.message); }
  }
  async function remove(no: number) {
    try { await api(`/api/addresses?no=${no}`, { method: "DELETE" }); toast("Address removed"); loadAddr(); }
    catch (e: any) { toast(e.message, "err"); }
  }
  async function makeDefault(no: number) {
    await api(`/api/addresses?no=${no}`, { method: "PATCH" }).catch(() => {});
    store("br_addr", String(no)); loadAddr();
  }

  if (!p) return <Shell role="customer"><Spinner /></Shell>;
  const city = pins.find((x) => x.pincode === na.pincode)?.city;
  const center: [number, number] = na.latitude ? [na.latitude, na.longitude] : CITY_CENTER[city || "Bengaluru"];

  return (
    <Shell role="customer">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Account</h1>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Loyalty points" value={p.loyalty_points} sub="1 point for every ₹100 delivered" icon="⭐" tone="amber" />
        <Stat label="Delivered orders" value={p.delivered_orders} icon="🧾" tone="green" />
        <Stat label="Member since" value={p.created_at ? new Date(String(p.created_at).replace(" ", "T")).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : ""} sub={p.age ? `Age ${p.age}` : undefined} icon="🎉" tone="violet" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-section">Saved addresses</div>
              {!adding && <button className="btn-ghost btn-sm" onClick={() => setAdding(true)}>+ Add address</button>}
            </div>
            <div className="space-y-3">
              {addresses.map((a) => (
                <div key={a.address_no} className="flex items-start gap-3 rounded-xl border border-ink-100 p-4">
                  <span className="text-xl">{a.label === "Work" ? "🏢" : "🏠"}</span>
                  <div className="flex-1">
                    <div className="font-bold">{a.label} {Number(a.is_default) === 1 && <span className="ml-1 rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Default</span>}</div>
                    <div className="text-sm text-ink-500">{a.address_line}, {a.city} {a.pincode}</div>
                    <div className="mt-0.5 text-xs text-ink-300">Address #{a.address_no}</div>
                  </div>
                  <div className="flex gap-2">
                    {Number(a.is_default) !== 1 && <button className="btn-ghost btn-sm" onClick={() => makeDefault(a.address_no)}>Make default</button>}
                    <button className="btn-danger btn-sm" onClick={() => remove(a.address_no)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {adding && (
              <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/40 p-5 fade-in">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="label">Label</label>
                    <select className="input" value={na.label} onChange={(e) => setNa({ ...na, label: e.target.value })}><option>Home</option><option>Work</option><option>Other</option></select>
                  </div>
                  <div><label className="label">PIN code</label>
                    <select className="input" value={na.pincode || ""} onChange={(e) => { const pc = pins.find((x) => x.pincode === e.target.value); setNa({ ...na, pincode: e.target.value, latitude: undefined, longitude: undefined, _c: pc?.city }); }}>
                      <option value="">Choose</option>
                      {pins.map((x) => <option key={x.pincode} value={x.pincode}>{x.pincode} · {x.city}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2"><label className="label">House, street, area</label><input className="input" value={na.address_line || ""} onChange={(e) => setNa({ ...na, address_line: e.target.value })} /></div>
                </div>
                <div className="mt-3 text-xs font-semibold text-ink-500">Click on the map to drop the pin at your door.</div>
                <div className="mt-2">
                  <MapView className="h-64" center={center} zoom={13} fitKey={city}
                    pins={na.latitude ? [{ id: "new", lat: na.latitude, lng: na.longitude, emoji: "📍" }] : []}
                    onPick={(lat, lng) => setNa((x: any) => ({ ...x, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) }))} />
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={na.is_default} onChange={(e) => setNa({ ...na, is_default: e.target.checked })} /> Make this my default address</label>
                <div className="mt-3"><ErrorBox error={err} /></div>
                <div className="mt-3 flex gap-2"><button className="btn-primary" onClick={addAddress}>Save address</button><button className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button></div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="h-section mb-4">Profile</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Name</label><input className="input" value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input bg-ink-50" value={p.email} disabled /></div>
              <div><label className="label">Mobile</label><input className="input" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="label">Date of birth</label><input className="input" type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            </div>
            <div className="mt-3"><ErrorBox error={perr} /></div>
            <button className="btn-dark mt-4" onClick={saveProfile}>Save changes</button>
          </div>
        </div>
        <aside className="card self-start p-6">
          <div className="h-section mb-3">Notifications</div>
          {notes.length === 0 && <div className="text-sm text-ink-500">No notifications yet.</div>}
          <div className="space-y-3">
            {notes.map((n, i) => (
              <div key={i} className="rounded-xl bg-ink-50 px-3 py-2.5 text-sm"><div>{n.text}</div>{n.at && <div className="mt-0.5 text-xs text-ink-500">{ago(n.at)}</div>}</div>
            ))}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
