"use client";
// Browser-side helpers: JSON fetch with error messages, money and time formatting.

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/login")) {
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
  }
  if (!res.ok) {
    const err: any = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.code;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const inr = (n: any, digits = 0) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const inr2 = (n: any) => inr(n, 2);

/** MySQL 'YYYY-MM-DD HH:MM:SS' (local time) -> Date */
export const toDate = (s: any) => (s ? new Date(String(s).replace(" ", "T")) : null);

export function timeOf(s: any) {
  const d = toDate(s);
  return d ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";
}
export function dateTime(s: any) {
  const d = toDate(s);
  return d ? d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
}
export function ago(s: any) {
  const d = typeof s === "number" ? new Date(s) : toDate(s);
  if (!d) return "";
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export const hhmm = (t: any) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

export const STATUS_LABEL: Record<string, string> = {
  PLACED: "Placed", CONFIRMED: "Confirmed", PREPARING: "Preparing", READY: "Ready for pickup",
  PICKED_UP: "Out for delivery", DELIVERED: "Delivered", CANCELLED: "Cancelled",
};
export const LIVE = ["PLACED", "CONFIRMED", "PREPARING", "READY", "PICKED_UP"];

export function cartChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("cart-updated"));
}

export function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
    return value;
  } catch {
    return null;
  }
}
