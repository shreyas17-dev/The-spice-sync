"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Spinner, PageHeader, Empty } from "@/components/ui";
import { api, ago } from "@/lib/client";

const ICON: Record<string, string> = { admin: "🛡️", owner: "👨‍🍳", partner: "🛵", customer: "😋" };

export default function Activity() {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => api("/api/admin/activity").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  return (
    <Shell role="admin" wide>
      <PageHeader title="Activity log" sub="Read from the Redis stream activity:log (XREVRANGE), refreshed every 5 seconds">
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </PageHeader>
      {!rows && <Spinner />}
      {rows && rows.length === 0 && <Empty icon="📭" title="No activity yet" text="Actions such as logins, approvals and order updates appear here." />}
      {rows && rows.length > 0 && (
        <div className="card divide-y divide-ink-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-50 text-lg">{ICON[r.actor_role] || "•"}</span>
              <div className="flex-1">
                <div className="text-sm"><span className="font-semibold capitalize">{r.actor_role} #{r.actor_id}</span> <span className="font-mono text-xs text-brand-700">{r.action}</span> on {r.entity} #{r.entity_id}</div>
                <div className="font-mono text-[11px] text-ink-300">{r.id}</div>
              </div>
              <span className="text-xs text-ink-500">{ago(r.at)}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
