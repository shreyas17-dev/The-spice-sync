"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import Cover from "@/components/Cover";
import { Rating, Spinner, Empty, Veg, Modal, toast } from "@/components/ui";
import { api, inr, hhmm, cartChanged, store } from "@/lib/client";

function RestaurantPage() {
  const { id } = useParams() as { id: string };
  const sp = useSearchParams();
  const addressNo = Number(sp.get("a") || store("br_addr") || 0);
  const [data, setData] = useState<any>(null);
  const [cart, setCart] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [conflict, setConflict] = useState<{ item: number; msg: string } | null>(null);

  useEffect(() => {
    api(`/api/restaurants/${id}?addressNo=${addressNo}`).then(setData).catch((e) => setError(e.message));
    api("/api/cart").then(setCart).catch(() => {});
  }, [id, addressNo]);

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const m of data?.menu || []) if (!vegOnly || Number(m.is_veg)) (g[m.category] = g[m.category] || []).push(m);
    return g;
  }, [data, vegOnly]);

  const qtyOf = (itemId: number) => (cart?.items || []).find((i: any) => i.item_id === itemId)?.qty || 0;

  async function change(itemId: number, delta: number, replace = false) {
    try {
      const c = await api("/api/cart", { body: { item_id: itemId, delta, replace } });
      setCart(c); cartChanged();
      if (delta > 0 && !replace) toast("Added to cart");
    } catch (e: any) {
      if (e.code === "OTHER_RESTAURANT") setConflict({ item: itemId, msg: e.message });
      else toast(e.message, "err");
    }
  }

  if (error) return <Shell role="customer"><Empty icon="🚫" title="Restaurant unavailable" text={error}><Link href="/" className="btn-primary">Back to restaurants</Link></Empty></Shell>;
  if (!data) return <Shell role="customer"><Spinner /></Shell>;
  const r = data.restaurant;
  const open = Number(r.is_open) === 1;
  const sameRest = cart && cart.restaurant_id === r.restaurant_id && cart.count > 0;

  return (
    <Shell role="customer">
      <Link href="/" className="mb-4 inline-block text-sm font-semibold text-ink-500 hover:text-ink-900">← All restaurants</Link>
      <div className="card overflow-hidden">
        <Cover id={r.restaurant_id} name={r.name} cuisines={r.cuisines} className="h-44" />
        <div className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{r.name}</h1>
            <div className="mt-1 text-ink-500">{r.cuisines}</div>
            <div className="mt-1 text-sm text-ink-500">{r.address_line}, {r.city}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-ink-100 px-4 py-2 text-center"><Rating value={r.rating} /><div className="mt-1 text-xs text-ink-500">{r.rating_count} ratings</div></div>
            {r.eta && <div className="rounded-xl border border-ink-100 px-4 py-2 text-center"><div className="font-bold">{r.eta} min</div><div className="text-xs text-ink-500">{Number(r.km).toFixed(1)} km away</div></div>}
            <div className="rounded-xl border border-ink-100 px-4 py-2 text-center"><div className="font-bold">{inr(r.cost_for_two)}</div><div className="text-xs text-ink-500">for two</div></div>
            <div className="rounded-xl border border-ink-100 px-4 py-2 text-center"><div className={`font-bold ${open ? "text-emerald-600" : "text-red-600"}`}>{open ? "Open now" : "Closed"}</div><div className="text-xs text-ink-500">{hhmm(r.opening_time)} – {hhmm(r.closing_time)}</div></div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="h-section">Menu</div>
            <button className={`chip ${vegOnly ? "border-emerald-600 bg-emerald-50 text-emerald-700" : ""}`} onClick={() => setVegOnly(!vegOnly)}><span className="veg-mark" /> Veg only</button>
          </div>
          <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-none">
            {Object.keys(groups).map((c) => <a key={c} href={`#cat-${c}`} className="chip">{c} <span className="text-ink-300">{groups[c].length}</span></a>)}
          </div>
          {Object.entries(groups).map(([cat, items]) => (
            <section key={cat} id={`cat-${cat}`} className="mb-8 scroll-mt-24">
              <h2 className="mb-3 text-lg font-bold">{cat}</h2>
              <div className="card divide-y divide-ink-100">
                {items.map((m) => {
                  const q = qtyOf(m.item_id);
                  const avail = Number(m.is_available) === 1;
                  return (
                    <div key={m.item_id} className={`flex items-start gap-4 p-4 ${avail ? "" : "opacity-55"}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><Veg veg={m.is_veg} /><span className="font-semibold">{m.name}</span></div>
                        <div className="mt-1 font-semibold">{inr(m.price)}</div>
                        {m.description && <div className="mt-1 text-sm text-ink-500">{m.description}</div>}
                      </div>
                      <div className="w-28 flex-none text-right">
                        {!avail ? <span className="text-xs font-semibold text-red-600">Sold out</span>
                          : !open ? <span className="text-xs text-ink-500">Closed</span>
                          : q === 0 ? <button className="btn-ghost btn-sm w-24 border-brand-200 text-brand-600" onClick={() => change(m.item_id, 1)}>ADD</button>
                          : (
                            <div className="inline-flex w-24 items-center justify-between rounded-lg bg-brand-500 text-white shadow-sm">
                              <button className="px-3 py-1.5 font-bold" onClick={() => change(m.item_id, -1)}>−</button>
                              <span className="text-sm font-bold">{q}</span>
                              <button className="px-3 py-1.5 font-bold" onClick={() => change(m.item_id, 1)}>+</button>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <div className="h-section">Your cart</div>
            {!cart || cart.count === 0 ? (
              <div className="py-8 text-center text-sm text-ink-500"><div className="mb-2 text-4xl">🛒</div>Your cart is empty. Add something tasty!</div>
            ) : (
              <>
                <div className="mt-1 text-sm text-ink-500">from {cart.restaurant_name}</div>
                <div className="mt-4 space-y-3">
                  {cart.items.map((i: any) => (
                    <div key={i.item_id} className="flex items-center gap-2 text-sm">
                      <Veg veg={i.is_veg} /><span className="flex-1">{i.name}</span>
                      <span className="text-ink-500">× {i.qty}</span><span className="w-16 text-right font-semibold">{inr(i.price * i.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between border-t border-ink-100 pt-4 font-bold"><span>Subtotal</span><span>{inr(cart.subtotal)}</span></div>
                {!sameRest && <div className="mt-2 text-xs text-amber-700">This cart is from another restaurant.</div>}
                <Link href="/checkout" className="btn-primary mt-4 w-full">Checkout →</Link>
              </>
            )}
          </div>
        </aside>
      </div>

      <Modal open={!!conflict} onClose={() => setConflict(null)} title="Start a new cart?">
        <p className="text-sm text-ink-700">{conflict?.msg}</p>
        <p className="mt-2 text-sm text-ink-500">A cart can only have dishes from one restaurant.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConflict(null)}>Keep old cart</button>
          <button className="btn-primary" onClick={async () => { const it = conflict!.item; setConflict(null); await change(it, 1, true); toast("New cart started"); }}>Start new cart</button>
        </div>
      </Modal>
    </Shell>
  );
}

export default function Page() {
  return <Suspense><RestaurantPage /></Suspense>;
}
