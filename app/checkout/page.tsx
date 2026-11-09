"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, Empty, Veg, ErrorBox, toast } from "@/components/ui";
import { api, inr, inr2, cartChanged, store } from "@/lib/client";

const METHODS = [
  { id: "UPI", label: "UPI", sub: "GPay, PhonePe, Paytm", icon: "📱" },
  { id: "CARD", label: "Card", sub: "Credit or debit card", icon: "💳" },
  { id: "NETBANKING", label: "Net banking", sub: "All major banks", icon: "🏦" },
  { id: "WALLET", label: "Wallet", sub: "Amazon Pay, Mobikwik", icon: "👛" },
  { id: "COD", label: "Cash on delivery", sub: "Pay the rider", icon: "💵" },
];

export default function Checkout() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressNo, setAddressNo] = useState(0);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [method, setMethod] = useState("UPI");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/api/addresses").then((a) => {
      setAddresses(a);
      const saved = Number(store("br_addr") || 0);
      const pick = a.find((x: any) => x.address_no === saved) || a[0];
      if (pick) setAddressNo(pick.address_no);
      else setQuote({ noAddress: true });
    });
  }, []);

  async function load(code = applied) {
    if (!addressNo) return;
    try { setQuote(await api("/api/cart/quote", { body: { addressNo, coupon: code } })); }
    catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [addressNo, applied]);

  async function qty(itemId: number, delta: number) {
    await api("/api/cart", { body: { item_id: itemId, delta } }).catch((e) => toast(e.message, "err"));
    cartChanged(); load();
  }

  async function place() {
    setBusy(true); setError(null);
    try {
      const r = await api("/api/orders", { body: { addressNo, coupon: quote?.coupon ? applied : "", method, note } });
      cartChanged();
      router.push(`/orders/${r.orderId}?new=1`);
    } catch (e: any) {
      setError(e.message); setBusy(false);
    }
  }

  if (!quote) return <Shell role="customer"><Spinner label="Preparing your bill..." /></Shell>;
  if (quote.noAddress) return <Shell role="customer"><Empty icon="🏠" title="Add a delivery address first"><Link href="/account" className="btn-primary">Add address</Link></Empty></Shell>;
  if (quote.empty) return <Shell role="customer"><Empty icon="🛒" title="Your cart is empty" text="Pick a restaurant and add some dishes."><Link href="/" className="btn-primary">Browse restaurants</Link></Empty></Shell>;

  const b = quote.bill;
  return (
    <Shell role="customer">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="h-section mb-4">Delivery address</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <button key={a.address_no} onClick={() => { setAddressNo(a.address_no); store("br_addr", String(a.address_no)); }}
                  className={`rounded-xl border p-4 text-left transition ${addressNo === a.address_no ? "border-brand-500 bg-brand-50 ring-4 ring-brand-100" : "border-ink-100 hover:border-ink-300"}`}>
                  <div className="font-bold">{a.label === "Work" ? "🏢" : "🏠"} {a.label}</div>
                  <div className="mt-1 text-sm text-ink-500">{a.address_line}, {a.city} {a.pincode}</div>
                </button>
              ))}
            </div>
            {quote.km > 8 && <div className="mt-3 text-sm font-medium text-red-600">This address is {Number(quote.km).toFixed(1)} km away, outside the 8 km delivery radius.</div>}
          </div>

          <div className="card p-6">
            <div className="h-section mb-4">Payment</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {METHODS.map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${method === m.id ? "border-brand-500 bg-brand-50 ring-4 ring-brand-100" : "border-ink-100 hover:border-ink-300"}`}>
                  <span className="text-2xl">{m.icon}</span>
                  <span><span className="block font-bold">{m.label}</span><span className="text-xs text-ink-500">{m.sub}</span></span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-500">Payments are simulated for this project: online methods succeed instantly, cash is collected by the rider.</p>
          </div>

          <div className="card p-6">
            <div className="h-section mb-3">Note for the restaurant</div>
            <input className="input" placeholder="e.g. less spicy, no onions" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="text-sm text-ink-500">Ordering from</div>
            <div className="text-lg font-bold">{quote.cart.restaurant_name}</div>
            {!quote.isOpen && <div className="mt-1 text-sm font-medium text-red-600">This restaurant is closed right now.</div>}
            <div className="mt-4 space-y-3">
              {quote.cart.items.map((i: any) => (
                <div key={i.item_id} className={`flex items-center gap-2 text-sm ${i.is_available ? "" : "opacity-50"}`}>
                  <Veg veg={i.is_veg} />
                  <span className="flex-1">{i.name}{!i.is_available && <span className="ml-1 text-xs text-red-600">(sold out)</span>}</span>
                  <span className="inline-flex items-center rounded-lg border border-ink-100">
                    <button className="px-2 py-0.5" onClick={() => qty(i.item_id, -1)}>−</button>
                    <span className="w-5 text-center text-xs font-bold">{i.qty}</span>
                    <button className="px-2 py-0.5" onClick={() => qty(i.item_id, 1)}>+</button>
                  </span>
                  <span className="w-16 text-right font-semibold">{inr(i.price * i.qty)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <input className="input uppercase" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
              {applied ? <button className="btn-ghost" onClick={() => { setApplied(""); setCoupon(""); }}>Remove</button>
                : <button className="btn-dark" onClick={() => setApplied(coupon.trim())} disabled={!coupon.trim()}>Apply</button>}
            </div>
            {quote.couponError && <div className="mt-2 text-sm font-medium text-red-600">{quote.couponError}</div>}
            {quote.coupon && <div className="mt-2 text-sm font-medium text-emerald-700">🎉 {quote.coupon.code} applied: you save {inr2(b.discount)}</div>}
            {!applied && quote.offers?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quote.offers.map((o: any) => (
                  <button key={o.code} className="rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700" title={o.description || ""}
                    onClick={() => { setCoupon(o.code); setApplied(o.code); }}>{o.code}</button>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Item total</span><span>{inr2(b.subtotal)}</span></div>
              {b.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Coupon discount</span><span>− {inr2(b.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-ink-500">GST (5%)</span><span>{inr2(b.tax)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Delivery fee · {Number(quote.km).toFixed(1)} km</span><span>{b.delivery === 0 ? <span className="font-semibold text-emerald-700">FREE</span> : inr2(b.delivery)}</span></div>
              {quote.freeDeliveryGap > 0 && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Add {inr(quote.freeDeliveryGap)} more for free delivery</div>}
              <div className="flex justify-between border-t border-ink-100 pt-3 text-base font-extrabold"><span>To pay</span><span>{inr2(b.total)}</span></div>
            </div>
            <div className="mt-4"><ErrorBox error={error} /></div>
            <button className="btn-primary mt-4 w-full py-3 text-base" onClick={place} disabled={busy || !quote.isOpen || quote.km > 8}>
              {busy ? "Placing order..." : `Place order · ${inr2(b.total)}`}
            </button>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
