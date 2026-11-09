"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Logo, ErrorBox } from "@/components/ui";

const TYPES = [
  { id: "customer", icon: "😋", title: "Order food", text: "Browse restaurants and get food delivered." },
  { id: "owner", icon: "👨‍🍳", title: "List my restaurant", text: "Receive orders and grow your sales." },
  { id: "partner", icon: "🛵", title: "Deliver with us", text: "Earn on every delivery, on your own time." },
];

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState("customer");
  const [f, setF] = useState<any>({ vehicle_type: "SCOOTER" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api("/api/auth/signup", { body: { ...f, role } });
      router.replace(r.home);
      router.refresh();
    } catch (err: any) {
      setError(err.message); setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-ink-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="card p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button type="button" key={t.id} onClick={() => setRole(t.id)}
                className={`rounded-xl border p-4 text-left transition ${role === t.id ? "border-brand-500 bg-brand-50 ring-4 ring-brand-100" : "border-ink-100 hover:border-ink-300"}`}>
                <div className="text-2xl">{t.icon}</div>
                <div className="mt-2 font-bold">{t.title}</div>
                <div className="mt-0.5 text-xs text-ink-500">{t.text}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label">Full name</label><input className="input" required onChange={set("full_name")} /></div>
            <div><label className="label">Email</label><input className="input" type="email" required onChange={set("email")} /></div>
            <div><label className="label">Mobile number</label><input className="input" required placeholder="10-digit number" onChange={set("phone")} /></div>
            <div className="sm:col-span-2"><label className="label">Password</label><input className="input" type="password" required minLength={8} placeholder="At least 8 characters" onChange={set("password")} /></div>
            {role === "customer" && (
              <div><label className="label">Date of birth (optional)</label><input className="input" type="date" onChange={set("date_of_birth")} /></div>
            )}
            {role === "owner" && (<>
              <div><label className="label">PAN</label><input className="input uppercase" required placeholder="ABCDE1234F" onChange={set("pan_number")} /></div>
              <div><label className="label">Bank account number</label><input className="input" required onChange={set("bank_account_no")} /></div>
            </>)}
            {role === "partner" && (<>
              <div><label className="label">Vehicle</label>
                <select className="input" value={f.vehicle_type} onChange={set("vehicle_type")}>
                  <option value="BICYCLE">Bicycle</option><option value="SCOOTER">Scooter</option><option value="MOTORBIKE">Motorbike</option>
                </select>
              </div>
              {f.vehicle_type !== "BICYCLE" && (<>
                <div><label className="label">Vehicle number</label><input className="input uppercase" placeholder="KA01AB1234" onChange={set("vehicle_number")} /></div>
                <div><label className="label">Driving licence number</label><input className="input uppercase" onChange={set("license_no")} /></div>
              </>)}
            </>)}
          </div>
          {role === "owner" && <p className="mt-4 text-sm text-ink-500">After signing up you can add your restaurant. It goes live once an admin approves it.</p>}
          {role === "partner" && <p className="mt-4 text-sm text-ink-500">An admin verifies new riders before they can go online.</p>}
          <div className="mt-6"><ErrorBox error={error} /></div>
          <button className="btn-primary mt-4 w-full py-3 text-base" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
          <p className="mt-6 text-center text-sm text-ink-500">Already have an account? <Link href="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link></p>
        </form>
      </div>
    </div>
  );
}
