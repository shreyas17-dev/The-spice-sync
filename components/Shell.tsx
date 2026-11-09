"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ago, inr } from "@/lib/client";
import { Logo, Toaster } from "./ui";

type Role = "customer" | "owner" | "partner" | "admin";

const NAV: Record<Role, [string, string][]> = {
  customer: [["/", "Restaurants"], ["/orders", "My orders"], ["/account", "Account"]],
  owner: [["/owner", "Dashboard"], ["/owner/orders", "Live orders"], ["/owner/menu", "Menu"], ["/owner/settings", "Restaurant"]],
  partner: [["/partner", "Deliveries"], ["/partner/earnings", "Earnings"]],
  admin: [["/admin", "Overview"], ["/admin/restaurants", "Restaurants"], ["/admin/partners", "Riders"], ["/admin/customers", "Customers"], ["/admin/coupons", "Coupons"], ["/admin/activity", "Activity"]],
};
const ROLE_NAME: Record<Role, string> = { customer: "Customer", owner: "Restaurant partner", partner: "Delivery partner", admin: "Admin" };

export default function Shell({ role, children, wide = false }: { role: Role; children: any; wide?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [cart, setCart] = useState<any>(null);
  const [bell, setBell] = useState(false);
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    api("/api/auth/me").then(setMe).catch(() => {});
    if (role !== "customer") return;
    const load = () => api("/api/cart").then(setCart).catch(() => {});
    load();
    window.addEventListener("cart-updated", load);
    return () => window.removeEventListener("cart-updated", load);
  }, [role]);

  useEffect(() => {
    if (bell) api("/api/notifications").then(setNotes).catch(() => setNotes([]));
  }, [bell]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const active = (href: string) => (href === "/" || href === `/${role}` ? path === href : path.startsWith(href));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-[1000] border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex h-16 items-center gap-6 px-4 sm:px-6 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>
          <Link href={NAV[role][0][0]}><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV[role].map(([href, label]) => (
              <Link key={href} href={href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active(href) ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-50"}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {role === "customer" && (
              <Link href="/checkout" className="relative inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600">
                <span>🛒</span>
                <span className="hidden sm:inline">{cart && cart.count ? inr(cart.subtotal) : "Cart"}</span>
                {cart && cart.count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink-900 px-1 text-[11px] font-bold">{cart.count}</span>
                )}
              </Link>
            )}
            <div className="relative">
              <button onClick={() => setBell(!bell)} className="grid h-10 w-10 place-items-center rounded-xl border border-ink-100 bg-white text-lg hover:bg-ink-50" aria-label="Notifications">🔔</button>
              {bell && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lift fade-in">
                  <div className="border-b border-ink-100 px-4 py-3 text-sm font-bold">Notifications</div>
                  <div className="max-h-80 overflow-y-auto">
                    {notes.length === 0 && <div className="px-4 py-6 text-center text-sm text-ink-500">Nothing new</div>}
                    {notes.map((n, i) => (
                      <div key={i} className="border-b border-ink-50 px-4 py-3 text-sm last:border-0">
                        <div className="text-ink-900">{n.text}</div>
                        {n.at && <div className="mt-0.5 text-xs text-ink-500">{ago(n.at)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold leading-tight">{me ? me.name : " "}</div>
              <div className="text-xs text-ink-500">{ROLE_NAME[role]}</div>
            </div>
            <button onClick={logout} className="btn-ghost btn-sm">Log out</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden scrollbar-none">
          {NAV[role].map(([href, label]) => (
            <Link key={href} href={href} className={`rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${active(href) ? "bg-ink-900 text-white" : "text-ink-700 bg-ink-50"}`}>{label}</Link>
          ))}
        </nav>
      </header>
      <main className={`mx-auto px-4 py-8 sm:px-6 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>{children}</main>
      <Toaster />
    </div>
  );
}
