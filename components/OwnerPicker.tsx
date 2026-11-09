"use client";
import { useEffect, useState } from "react";
import { api, store } from "@/lib/client";
import { Pill } from "./ui";

/** The owner's restaurants and the one currently selected (remembered in localStorage). */
export function useRestaurants() {
  const [list, setList] = useState<any[] | null>(null);
  const [rid, setRid] = useState<number>(0);
  const reload = () => api("/api/owner/restaurants").then((l) => {
    setList(l);
    const saved = Number(store("br_rest") || 0);
    const pick = l.find((r: any) => r.restaurant_id === saved) || l[0];
    setRid((cur) => (cur && l.some((r: any) => r.restaurant_id === cur) ? cur : pick ? pick.restaurant_id : 0));
  }).catch(() => setList([]));
  useEffect(() => { reload(); }, []);
  const choose = (id: number) => { setRid(id); store("br_rest", String(id)); };
  const current = list?.find((r) => r.restaurant_id === rid) || null;
  return { list, rid, current, choose, reload };
}

export function RestaurantPicker({ list, rid, choose, all = false }: { list: any[] | null; rid: number; choose: (id: number) => void; all?: boolean }) {
  if (!list || list.length === 0) return null;
  const cur = list.find((r) => r.restaurant_id === rid);
  return (
    <div className="flex items-center gap-2">
      <select className="input w-auto py-2 font-semibold" value={rid} onChange={(e) => choose(Number(e.target.value))}>
        {all && <option value={0}>All my restaurants</option>}
        {list.map((r) => <option key={r.restaurant_id} value={r.restaurant_id}>{r.name}</option>)}
      </select>
      {cur && <Pill status={cur.status} />}
    </div>
  );
}
