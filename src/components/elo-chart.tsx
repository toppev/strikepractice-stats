"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type EloSeries = {
  kit: string;
  label: string;
  points: { at: number; elo: number; change: number; fightId: number; won: boolean }[];
};

const fmtDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Elo after each ranked fight in one kit (one series, so the title names it and there is no
 * legend). Fights are spaced evenly rather than by date: a month-long break shouldn't flatten
 * the rest. Hover or arrow keys move a crosshair; click opens that fight.
 */
export function EloChart({ series, startingElo }: { series: EloSeries[]; startingElo: number }) {
  const router = useRouter();
  const [kit, setKit] = useState(series[0]?.kit);
  const [hover, setHover] = useState<number | null>(null);
  // Starts narrow so the server render never pushes the layout wider than a phone screen
  const [width, setWidth] = useState(320);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const current = series.find((s) => s.kit === kit) ?? series[0];
  const height = 220;
  const pad = { top: 16, right: 64, bottom: 28, left: 44 };

  const geo = useMemo(() => {
    const pts = current?.points ?? [];
    const values = [...pts.map((p) => p.elo), startingElo];
    // the elo before the first fight, so the line starts where the player started
    const first = pts[0] ? pts[0].elo - pts[0].change : startingElo;
    values.push(first);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const span = Math.max(20, hi - lo);
    lo = Math.floor((lo - span * 0.12) / 10) * 10;
    hi = Math.ceil((hi + span * 0.12) / 10) * 10;
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const n = pts.length;
    const x = (i: number) => pad.left + (n === 0 ? 0 : (i / n) * innerW);
    const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * innerH;
    const coords = [{ x: x(0), y: y(first) }, ...pts.map((p, i) => ({ x: x(i + 1), y: y(p.elo) }))];
    const step = (hi - lo) / 4;
    const ticks = [0, 1, 2, 3, 4].map((i) => Math.round(lo + step * i));
    return { pts, coords, x, y, ticks, innerH };
  }, [current, width, startingElo, pad.left, pad.right, pad.top, pad.bottom]);

  if (!current || current.points.length === 0) {
    return <p className="text-muted">No ranked fights yet, so there is no elo history to draw.</p>;
  }

  const line = geo.coords.map((c, i) => `${i ? "L" : "M"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join("");
  const baseY = height - pad.bottom;
  const area = `${line}L${geo.coords[geo.coords.length - 1].x.toFixed(1)},${baseY}L${geo.coords[0].x.toFixed(1)},${baseY}Z`;
  const last = geo.coords[geo.coords.length - 1];
  const lastPoint = geo.pts[geo.pts.length - 1];
  const h = hover !== null ? geo.pts[hover] : null;
  const hc = hover !== null ? geo.coords[hover + 1] : null;

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const rel = clientX - rect.left - pad.left;
    const innerW = width - pad.left - pad.right;
    const i = Math.round((rel / innerW) * geo.pts.length) - 1;
    setHover(Math.max(0, Math.min(geo.pts.length - 1, i)));
  };

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Kit">
          {series.map((s) => (
            <button
              key={s.kit}
              type="button"
              onClick={() => {
                setKit(s.kit);
                setHover(null);
              }}
              aria-pressed={s.kit === current.kit}
              className={`rounded-full border px-3 py-1 text-sm ${
                s.kit === current.kit ? "border-accent bg-accent/10 text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={box}
        className="relative w-full min-w-0 cursor-crosshair overflow-hidden"
        tabIndex={0}
        role="img"
        aria-label={`${current.label} elo over the last ${geo.pts.length} ranked fights, now ${lastPoint.elo}`}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onClick={() => h && router.push(`/fight/${h.fightId}`)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((v) => Math.min(geo.pts.length - 1, (v ?? -1) + 1));
          else if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? geo.pts.length) - 1));
          else if (e.key === "Enter" && h) router.push(`/fight/${h.fightId}`);
          else if (e.key === "Escape") setHover(null);
        }}
      >
        <svg width={width} height={height} className="block overflow-visible">
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" className="num fill-[var(--faint)] text-[11px]">
                {t}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--accent)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hc && (
            <line x1={hc.x} x2={hc.x} y1={pad.top} y2={baseY} stroke="var(--muted)" strokeWidth={1} />
          )}
          {hc && <circle cx={hc.x} cy={hc.y} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />}
          <circle cx={last.x} cy={last.y} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
          <text x={last.x + 10} y={last.y} dy="0.32em" className="num fill-[var(--text)] text-[13px] font-semibold">
            {lastPoint.elo}
          </text>
          <text x={pad.left} y={height - 6} className="fill-[var(--faint)] text-[11px]">
            {fmtDate.format(geo.pts[0].at)}
          </text>
          <text x={width - pad.right} y={height - 6} textAnchor="end" className="fill-[var(--faint)] text-[11px]">
            {fmtDate.format(lastPoint.at)}
          </text>
        </svg>
        {h && hc && (
          <div
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-sm shadow-lg"
            style={{ left: Math.min(Math.max(hc.x, 80), width - 80), top: Math.max(0, hc.y - 74) }}
          >
            <div className="font-semibold">
              <span className={h.won ? "text-win" : "text-loss"}>{h.won ? "Win" : "Loss"}</span>{" "}
              <span className="num">
                {h.change >= 0 ? "+" : "−"}
                {Math.abs(h.change)}
              </span>
              <span className="text-muted"> to </span>
              <span className="num">{h.elo}</span>
            </div>
            <div className="text-muted">{fmtDate.format(h.at)}</div>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{current.label} elo after each ranked fight</caption>
        <tbody>
          {geo.pts.map((p) => (
            <tr key={p.fightId}>
              <th>{fmtDate.format(p.at)}</th>
              <td>{p.won ? "Win" : "Loss"}</td>
              <td>{p.elo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
