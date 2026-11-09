"use client";
// Leaflet + OpenStreetMap map. Markers are emoji pins (no image files needed).
import { useEffect, useRef } from "react";

export type Pin = { id: string; lat: number; lng: number; emoji: string; label?: string; rider?: boolean };

export default function MapView({ pins, line, className = "h-72", onPick, center, zoom = 13, fitKey }: {
  pins: Pin[]; line?: [number, number][]; className?: string;
  onPick?: (lat: number, lng: number) => void; center?: [number, number]; zoom?: number; fitKey?: any;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const L = useRef<any>(null);
  const layers = useRef<Record<string, any>>({});
  const poly = useRef<any>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // create the map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      L.current = leaflet;
      const start = center || (pins[0] ? [pins[0].lat, pins[0].lng] : [12.97, 77.59]);
      const m = leaflet.map(box.current, { zoomControl: true, attributionControl: true }).setView(start as any, zoom);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
      }).addTo(m);
      m.on("click", (e: any) => pickRef.current && pickRef.current(e.latlng.lat, e.latlng.lng));
      map.current = m;
      draw(true);
    })();
    return () => {
      cancelled = true;
      if (map.current) { map.current.remove(); map.current = null; layers.current = {}; poly.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(fit: boolean) {
    const leaflet = L.current, m = map.current;
    if (!leaflet || !m) return;
    const seen = new Set<string>();
    for (const p of pins) {
      if (p.lat == null || p.lng == null || isNaN(p.lat) || isNaN(p.lng)) continue;
      seen.add(p.id);
      const icon = leaflet.divIcon({ html: `<div class="map-pin ${p.rider ? "map-pin-rider" : ""}">${p.emoji}</div>`, className: "", iconSize: [30, 30], iconAnchor: [15, 26] });
      if (layers.current[p.id]) layers.current[p.id].setLatLng([p.lat, p.lng]);
      else {
        const mk = leaflet.marker([p.lat, p.lng], { icon }).addTo(m);
        if (p.label) mk.bindTooltip(p.label, { direction: "top", offset: [0, -22] });
        layers.current[p.id] = mk;
      }
    }
    for (const id of Object.keys(layers.current)) if (!seen.has(id)) { m.removeLayer(layers.current[id]); delete layers.current[id]; }
    if (poly.current) { m.removeLayer(poly.current); poly.current = null; }
    if (line && line.length > 1) poly.current = leaflet.polyline(line, { color: "#fc5a16", weight: 4, opacity: 0.75, dashArray: "8 8" }).addTo(m);
    if (fit) {
      const pts = pins.filter((p) => p.lat && p.lng).map((p) => [p.lat, p.lng]);
      if (pts.length > 1) m.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
      else if (pts.length === 1) m.setView(pts[0], zoom);
    }
  }

  // redraw when pins move; refit when fitKey changes
  const fitRef = useRef(fitKey);
  useEffect(() => {
    const fit = fitRef.current !== fitKey;
    fitRef.current = fitKey;
    draw(fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pins), JSON.stringify(line), fitKey]);

  useEffect(() => {
    if (map.current && center) map.current.setView(center, map.current.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center && center[0], center && center[1]]);

  return <div ref={box} className={`w-full overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 ${className}`} />;
}
