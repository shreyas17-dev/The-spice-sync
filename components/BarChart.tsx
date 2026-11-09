"use client";
// Small dependency-free bar chart (SVG) with hover tooltips.
import { useState } from "react";

export default function BarChart({ data, height = 200, format = (v: number) => String(v), color = "#fc5a16" }: {
  data: { label: string; value: number }[]; height?: number; format?: (v: number) => string; color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, pad = { l: 8, r: 8, t: 22, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.max(6, Math.min(36, slot * 0.62));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const every = n > 16 ? Math.ceil(n / 8) : n > 8 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#eceef3" strokeWidth={1} />
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#b9bfcc" strokeWidth={1} />
      {data.map((d, i) => {
        const x = pad.l + slot * i + (slot - bw) / 2;
        const top = y(d.value);
        const h = Math.max(0, y(0) - top);
        const r = Math.min(5, bw / 2, h);
        const path = h > 0
          ? `M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z`
          : "";
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
            {path && <path d={path} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />}
            {i % every === 0 && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7385">{d.label}</text>
            )}
            {hover === i && (
              <g>
                <rect x={Math.min(Math.max(x + bw / 2 - 52, 2), W - 106)} y={Math.max(top - 26, 0)} width={104} height={20} rx={6} fill="#151a23" />
                <text x={Math.min(Math.max(x + bw / 2, 54), W - 54)} y={Math.max(top - 12, 14)} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">{format(d.value)}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
