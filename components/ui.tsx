"use client";
import { useEffect, useState } from "react";
import { STATUS_LABEL } from "@/lib/client";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-lg shadow-sm">🛵</span>
      <span className={`text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-ink-900"}`}>
        Bite<span className={light ? "text-brand-200" : "text-brand-500"}>Route</span>
      </span>
    </span>
  );
}

const PILL: Record<string, string> = {
  PLACED: "bg-amber-50 text-amber-700 ring-amber-200",
  CONFIRMED: "bg-sky-50 text-sky-700 ring-sky-200",
  PREPARING: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  READY: "bg-violet-50 text-violet-700 ring-violet-200",
  PICKED_UP: "bg-brand-50 text-brand-700 ring-brand-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  SUSPENDED: "bg-orange-50 text-orange-700 ring-orange-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  BLOCKED: "bg-red-50 text-red-700 ring-red-200",
  ONLINE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  BUSY: "bg-brand-50 text-brand-700 ring-brand-200",
  OFFLINE: "bg-ink-50 text-ink-500 ring-ink-100",
  SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REFUNDED: "bg-sky-50 text-sky-700 ring-sky-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  INACTIVE: "bg-ink-50 text-ink-500 ring-ink-100",
};

export function Pill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${PILL[status] || "bg-ink-50 text-ink-700 ring-ink-100"}`}>
      {label || STATUS_LABEL[status] || status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

export function Rating({ value, count }: { value: any; count?: any }) {
  const v = Number(value || 0);
  if (!v) return <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-xs font-semibold text-ink-500">New</span>;
  const color = v >= 4 ? "bg-emerald-600" : v >= 3.5 ? "bg-emerald-500" : "bg-amber-500";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-0.5 rounded-md ${color} px-1.5 py-0.5 text-xs font-bold text-white`}>{v.toFixed(1)} ★</span>
      {count !== undefined && <span className="text-xs text-ink-500">({count})</span>}
    </span>
  );
}

export function Veg({ veg }: { veg: any }) {
  return <span className={Number(veg) ? "veg-mark" : "nonveg-mark"} title={Number(veg) ? "Veg" : "Non-veg"} />;
}

export function Stat({ label, value, sub, icon, tone = "brand" }: { label: string; value: any; sub?: any; icon?: string; tone?: string }) {
  const bg: Record<string, string> = { brand: "bg-brand-50", green: "bg-emerald-50", blue: "bg-sky-50", violet: "bg-violet-50", amber: "bg-amber-50" };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
        </div>
        {icon && <div className={`grid h-10 w-10 place-items-center rounded-xl text-xl ${bg[tone] || bg.brand}`}>{icon}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-100 border-t-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Empty({ icon = "🍽️", title, text, children }: { icon?: string; title: string; text?: string; children?: any }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="text-5xl">{icon}</div>
      <div className="mt-4 text-lg font-bold">{title}</div>
      {text && <p className="mt-1 max-w-md text-sm text-ink-500">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 fade-in">{error}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: any }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4 fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold">{title}</div>
          <button className="text-ink-500 hover:text-ink-900" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

let toastSetter: ((t: { text: string; tone: string } | null) => void) | null = null;
export function toast(text: string, tone: "ok" | "err" = "ok") {
  if (toastSetter) toastSetter({ text, tone });
}
export function Toaster() {
  const [t, setT] = useState<{ text: string; tone: string } | null>(null);
  useEffect(() => {
    toastSetter = setT;
    return () => { toastSetter = null; };
  }, []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 3200);
    return () => clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[3000] -translate-x-1/2 fade-in">
      <div className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lift ${t.tone === "err" ? "bg-red-600" : "bg-ink-900"}`}>{t.text}</div>
    </div>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 flex-none rounded-full transition disabled:opacity-50 ${on ? "bg-emerald-500" : "bg-ink-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: any; children?: any }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
