"use client";
import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Veg, Toggle, toast, ErrorBox, Modal } from "@/components/ui";
import { useRestaurants, RestaurantPicker } from "@/components/OwnerPicker";
import { api, inr } from "@/lib/client";

export default function OwnerMenu() {
  const { list, rid, choose } = useRestaurants();
  const [menu, setMenu] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState(false);
  const [nd, setNd] = useState<any>({ is_veg: true });
  const [err, setErr] = useState<string | null>(null);

  const load = () => rid && api(`/api/owner/menu?restaurantId=${rid}`).then(setMenu).catch(() => setMenu([]));
  useEffect(() => { setMenu(null); load(); /* eslint-disable-next-line */ }, [rid]);

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const m of menu || []) if (!q || m.name.toLowerCase().includes(q.toLowerCase())) (g[m.category] = g[m.category] || []).push(m);
    return g;
  }, [menu, q]);

  async function patch(item: any, change: any, msg: string) {
    try { await api("/api/owner/menu", { method: "PATCH", body: { item_id: item.item_id, ...change } }); toast(msg); load(); }
    catch (e: any) { toast(e.message, "err"); }
  }
  async function add() {
    setErr(null);
    try { await api("/api/owner/menu", { body: { ...nd, restaurant_id: rid } }); toast("Dish added"); setAdding(false); setNd({ is_veg: true }); load(); }
    catch (e: any) { setErr(e.message); }
  }
  const cats = Object.keys(groups);
  const available = (menu || []).filter((m) => Number(m.is_available) === 1).length;

  return (
    <Shell role="owner">
      <PageHeader title="Menu" sub={menu ? `${menu.length} dishes · ${available} available right now` : ""}>
        <RestaurantPicker list={list} rid={rid} choose={choose} />
        <input className="input w-48 py-2" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add dish</button>
      </PageHeader>
      {!menu && <Spinner />}
      {menu && cats.map((cat) => (
        <div key={cat} className="card mb-6 overflow-hidden">
          <div className="border-b border-ink-100 bg-ink-50 px-5 py-3 font-bold">{cat} <span className="font-normal text-ink-500">· {groups[cat].length}</span></div>
          <table className="table-clean w-full">
            <thead><tr><th>Dish</th><th className="w-28">Sold</th><th className="w-48">Price</th><th className="w-32">Available</th></tr></thead>
            <tbody>
              {groups[cat].map((m) => (
                <tr key={m.item_id} className={Number(m.is_available) ? "" : "bg-ink-50/60"}>
                  <td>
                    <div className="flex items-center gap-2"><Veg veg={m.is_veg} /><span className="font-semibold">{m.name}</span></div>
                    {m.description && <div className="mt-0.5 text-xs text-ink-500">{m.description}</div>}
                  </td>
                  <td className="text-ink-500">{m.sold}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-ink-500">₹</span>
                      <input className="input w-24 py-1.5" type="number" min={1} value={edit[m.item_id] ?? String(m.price)} onChange={(e) => setEdit({ ...edit, [m.item_id]: e.target.value })} />
                      {edit[m.item_id] !== undefined && Number(edit[m.item_id]) !== Number(m.price) && (
                        <button className="btn-dark btn-sm" onClick={() => { patch(m, { price: Number(edit[m.item_id]) }, `Price updated to ${inr(edit[m.item_id])}`); const x = { ...edit }; delete x[m.item_id]; setEdit(x); }}>Save</button>
                      )}
                    </div>
                  </td>
                  <td><Toggle on={Number(m.is_available) === 1} onChange={(v) => patch(m, { is_available: v }, v ? "Back in stock" : "Marked sold out")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-ink-500">Changing a price never changes past bills: every order line keeps the price it was sold at.</p>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a dish">
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" onChange={(e) => setNd({ ...nd, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category</label><input className="input" list="cats" onChange={(e) => setNd({ ...nd, category: e.target.value })} /><datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div><label className="label">Price (₹)</label><input className="input" type="number" min={1} onChange={(e) => setNd({ ...nd, price: e.target.value })} /></div>
          </div>
          <div><label className="label">Description</label><input className="input" onChange={(e) => setNd({ ...nd, description: e.target.value })} /></div>
          <div className="flex gap-2">
            <button type="button" className={`chip ${nd.is_veg ? "border-emerald-600 bg-emerald-50 text-emerald-700" : ""}`} onClick={() => setNd({ ...nd, is_veg: true })}><span className="veg-mark" /> Veg</button>
            <button type="button" className={`chip ${!nd.is_veg ? "border-red-600 bg-red-50 text-red-700" : ""}`} onClick={() => setNd({ ...nd, is_veg: false })}><span className="nonveg-mark" /> Non-veg</button>
          </div>
          <ErrorBox error={err} />
          <button className="btn-primary w-full" onClick={add}>Add dish</button>
        </div>
      </Modal>
    </Shell>
  );
}
