"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/client";
import { Logo, ErrorBox } from "@/components/ui";

const ROLES = [
  { id: "customer", label: "Customer", icon: "😋", demo: "aditya.rao@example.com" },
  { id: "owner", label: "Restaurant", icon: "👨‍🍳", demo: "imran.sheikh@example.com" },
  { id: "partner", label: "Delivery", icon: "🛵", demo: "suresh.naik3@example.com" },
  { id: "admin", label: "Admin", icon: "🛡️", demo: "priya.raghavan@biteroute.example" },
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [role, setRole] = useState("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api("/api/auth/login", { body: { role, email, password } });
      const next = sp.get("next");
      router.replace(next && next.startsWith(r.home === "/" ? "/" : r.home) ? next : r.home);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }
  const demo = () => { const r = ROLES.find((x) => x.id === role)!; setEmail(r.demo); setPassword("Password@123"); };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-rose-600 p-12 text-white lg:flex lg:flex-col">
        <Logo light />
        <div className="mt-auto max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Hot food from the best local kitchens, tracked to your door.</h1>
          <p className="mt-4 text-lg text-white/85">One platform for hungry customers, busy restaurants, fast riders and the team that keeps it all running.</p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[["20", "restaurants"], ["3", "cities"], ["24", "riders"]].map(([n, l]) => (
              <div key={l} className="rounded-2xl bg-white/10 p-4 backdrop-blur"><div className="text-3xl font-extrabold">{n}</div><div className="text-sm text-white/80">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 top-24 select-none text-[200px] opacity-20">🍛</div>
        <div className="pointer-events-none absolute right-40 top-72 select-none text-[120px] opacity-20">🍕</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-3xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-ink-500">Log in to continue.</p>

          <div className="mt-8 grid grid-cols-4 gap-2">
            {ROLES.map((r) => (
              <button type="button" key={r.id} onClick={() => setRole(r.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition ${role === r.id ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-100" : "border-ink-100 bg-white text-ink-700 hover:border-ink-300"}`}>
                <span className="text-2xl">{r.icon}</span>{r.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <div><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            <ErrorBox error={error} />
            <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
            <button type="button" onClick={demo} className="btn-ghost w-full">Fill in the demo {ROLES.find((x) => x.id === role)!.label.toLowerCase()} account</button>
          </div>
          <p className="mt-8 text-center text-sm text-ink-500">
            New here? <Link href="/signup" className="font-semibold text-brand-600 hover:underline">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
