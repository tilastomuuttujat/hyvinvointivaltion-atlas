import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRoadmap } from "@/lib/atlas.static";
import type { RoadmapSnapshot } from "@/lib/atlas.roadmap";
import { STAGE_OBSERVATIONS, type ObservationKind } from "@/lib/roadmap.observations";

/* Komentosilta: the reader stands on a bridge looking down the road of time.
   Upcoming stages rise as light beacons toward the horizon; the next era
   boundary glows as a gate; theme lanes flow alongside. Lanes are recorded
   chain membership only, never inferred causality. */

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const COLORS = ["#a6e6d4", "#e5ae7c", "#7ad7ea", "#9befcd", "#c9b2ff", "#f6ac9f"];
const SHORT = (t: string) => t.replace(/^Pää(?:ketju|reitti) [IVX]+:\s*/i, "").replace(/^\d{4}(?:–\d{4})?:\s*/, "");
const W = 1600, H = 900, CX = 800, HZ = 330;
const AHEAD = 5, CRUISE = 0.22, DWELL = 6, SPEED = 0.12;
// depth 0 = at the bridge, 1..AHEAD toward horizon
const yAt = (d: number) => HZ + (H - 120 - HZ) / (1 + d * 0.5);
const sAt = (d: number) => 1 / (1 + d * 0.5);
const xAt = (d: number) => CX + 70 * Math.sin(d * 1.1) * sAt(d) * 2.2;

const STARS = Array.from({ length: 160 }, (_, i) => {
  const a = Math.sin(i * 127.1) * 43758.5453, b = Math.sin(i * 311.7) * 24634.6345;
  return { x: (a - Math.floor(a)) * W, y: (b - Math.floor(b)) * (HZ - 10), r: ((i * 7) % 10) / 10 * 1.4 + 0.3, o: 0.25 + ((i * 13) % 10) / 14 };
});

const CSS = `
.bv{position:fixed;inset:0;z-index:60;background:#02060c;color:#e8f6f8;font:15px/1.4 ui-sans-serif,system-ui,sans-serif;overflow:hidden}
.bv svg.bv-world{position:absolute;inset:0;width:100%;height:100%}
.bv-world *{pointer-events:none}.bv-beacon,.bv-beacon *{pointer-events:auto}
.bv-grid{animation:bvGrid 2.6s linear infinite}
@keyframes bvGrid{to{transform:translateY(0)}}
.bv-flow{stroke-dasharray:3 16;animation:bvFlow 1.6s linear infinite}
.bv-flow-slow{stroke-dasharray:2 22;animation:bvFlow 3.2s linear infinite}
@keyframes bvFlow{to{stroke-dashoffset:-38}}
.bv-pulse{animation:bvPulse 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes bvPulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.9;transform:scale(1.25)}}
.bv-beacon{cursor:pointer;outline:none}
.bv-beacon:hover .bv-core,.bv-beacon:focus-visible .bv-core{filter:brightness(1.6)}
.bv-beacon:focus-visible .bv-ring{stroke:#fff;stroke-width:2}
.bv-label{paint-order:stroke;stroke:#02060c;stroke-width:5px;stroke-linejoin:round}
.bv-enter{animation:bvEnter 1s cubic-bezier(.2,.8,.2,1)}
@keyframes bvEnter{from{opacity:0;transform:translateY(-14px)}}
.bv-frame{position:absolute;inset:0;pointer-events:none;background:
 radial-gradient(ellipse 75% 70% at 50% 48%,transparent 55%,#02060cd9 100%)}
.bv-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:14px clamp(12px,3vw,32px);gap:12px;pointer-events:none}
.bv-top>*{pointer-events:auto}
.bv-btn{white-space:nowrap;background:#0b1b26b3;border:1px solid #3d5c6c;color:inherit;border-radius:999px;padding:7px 14px;cursor:pointer;backdrop-filter:blur(8px);font:inherit;font-size:13px}
.bv-btn:hover{border-color:#9fe3d6}.bv-btn:focus-visible{outline:2px solid #c0fff0;outline-offset:2px}
.bv-btn:disabled{opacity:.3;cursor:default}
.bv-readout{font:11px/1.35 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8fb3bf;text-align:right}
.bv-readout b{display:block;font:300 clamp(30px,5vw,54px)/1 ui-sans-serif,system-ui;letter-spacing:.02em;color:var(--c);text-shadow:0 0 24px var(--c)}
.bv-console{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:min(960px,94vw);display:grid;gap:8px;padding:12px 16px 12px;border-radius:18px;background:linear-gradient(180deg,#0c1d2acc,#050e16e6);border:1px solid color-mix(in oklab,var(--c) 40%,#20343f);box-shadow:0 0 40px -10px var(--c),inset 0 1px 0 #ffffff14;backdrop-filter:blur(12px)}
.bv-now{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;text-align:center}
.bv-now small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--c)}
.bv-now h2{margin:2px 0 0;font-size:clamp(16px,2.2vw,22px);font-weight:500}
.bv-now p{margin:4px auto 0;font-size:13px;color:#b5cdd5;max-width:62ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bv-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 14px;font-size:12px;color:#c6dce3}
.bv-lane::before{content:"";display:inline-block;width:16px;margin-right:6px;border-top:2px solid var(--l);vertical-align:middle;box-shadow:0 0 6px var(--l)}
.bv-lane[data-context=true]::before{border-top-style:dashed;box-shadow:none}
.bv-obs{border-radius:999px;padding:4px 11px;border:1px solid currentColor;background:transparent;font:inherit;font-size:12px;cursor:pointer}
.bv-obs.s{color:#9ff0c0}.bv-obs.d{color:#ffc58f}
.bv-obs[aria-pressed=true]{background:currentColor}.bv-obs[aria-pressed=true] span{color:#06120d}
.bv-effect a{color:inherit}
.bv-time{position:relative;height:26px}
.bv-time input{position:absolute;inset:0;width:100%;margin:0;opacity:0;cursor:pointer}
.bv-track{position:absolute;left:0;right:0;top:12px;height:2px;background:#1e3440;border-radius:2px}
.bv-tick{position:absolute;top:7px;width:2px;height:12px;border-radius:1px;opacity:.75}
.bv-knob{position:absolute;top:4px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:var(--c);box-shadow:0 0 14px var(--c);transition:left .6s cubic-bezier(.2,.8,.2,1)}
.bv-time input:focus-visible ~ .bv-knob{outline:2px solid #fff;outline-offset:2px}
.bv-ends{display:flex;justify-content:space-between;font:10px ui-monospace,monospace;color:#6f8f9b;margin-top:-4px}
.bv-routes button{width:30px;height:30px;padding:0;border-radius:50%;border:1px solid var(--r);color:var(--r);background:transparent;cursor:pointer;font:600 11px ui-sans-serif}
.bv-routes button[aria-current=true]{background:var(--r);color:#04101a;box-shadow:0 0 14px var(--r)}
.bv-orbwrap{display:flex;justify-content:center;align-items:center;gap:14px}
.bv-orb{width:min(168px,40vw);height:auto;touch-action:none;cursor:grab;filter:drop-shadow(0 0 18px color-mix(in oklab,var(--c) 45%,transparent))}
.bv-orb:active{cursor:grabbing}.bv-orb:focus-visible{outline:2px solid #c0fff0;outline-offset:4px;border-radius:50%}
.bv-orbinfo{font:11px/1.5 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8fb3bf;min-width:8em}
.bv-orbinfo b{display:block;font:500 15px ui-sans-serif,system-ui;letter-spacing:0;text-transform:none;color:var(--c)}
.bv-msg{position:absolute;inset:0;display:grid;place-items:center;color:#9fc0ca}
@media(max-width:700px){.bv-lanes{display:none}.bv-now p{display:none}.bv-console{padding:9px 10px;gap:6px}.bv-readout b{font-size:28px}}
@media(prefers-reduced-motion:reduce){.bv *{animation:none!important;transition:none!important}}
`;

/* Older static exports lack the roadmap inside atlas.json; read the standalone roadmap file instead. */
type Legacy = { routes: { order: number; id: string; title: string; start: number; end: number; kind: string }[];
  stages: { route: number; seq: number; title: string; start: number; end?: number; situation?: string }[];
  boundaries: { from: number; to: number; year: number; title: string }[];
  chains: { id: string; title: string; start: number; end?: number; routes: number[]; learning?: string }[] };
async function fallback(): Promise<RoadmapSnapshot | undefined> {
  if (typeof document === "undefined") return undefined;
  const r = await fetch(new URL("data/roadmap.json", document.baseURI).href);
  if (!r.ok) return undefined;
  const m = (await r.json()) as Legacy;
  return {
    routes: m.routes.map((x) => ({ route_order: x.order, phenomenon_id: x.id, title: x.title, start_year: x.start, end_year: x.end, phenomenon_kind: x.kind, review_status: "" })),
    stages: m.stages.map((x) => ({ route_order: x.route, state_id: `${x.route}-${x.seq}`, sequence_no: x.seq, title: x.title, situation: x.situation ?? "", start_year: x.start, end_year: x.end ?? null })),
    boundaries: m.boundaries.map((x) => ({ from_route_order: x.from, to_route_order: x.to, boundary_year: x.year, title: x.title })),
    chains: m.chains.map((x) => ({ chain_id: x.id, title: x.title, observed_change: "", route_orders: x.routes, learning_point: x.learning ?? "", start_year: x.start, end_year: x.end ?? null })),
    intersections: [],
  };
}

type Stage = RoadmapSnapshot["stages"][number] & { start_year: number };
const keyOf = (s: Stage) => `${s.route_order}:${s.state_id}`;

export function BridgeView({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RoadmapSnapshot>();
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [effect, setEffect] = useState<ObservationKind | null>(null);

  const stages = useMemo(() => (data?.stages ?? []).filter((s): s is Stage => s.start_year != null)
    .sort((a, b) => a.start_year - b.start_year || a.route_order - b.route_order || a.sequence_no - b.sequence_no), [data]);
  /* Real-time voyage: pos is a continuous stage position; the ship glides toward
     target, cruising forward on autopilot and dwelling at each stage (anchor). */
  const [pos, setPos] = useState(0);
  const [cruise, setCruise] = useState(true);
  const [t, setT] = useState(0);
  const [heading, setHeading] = useState(90); const headRef = useRef(90); headRef.current = heading;
  const jumping = useRef(false);
  const target = useRef(0), posRef = useRef(0), dwell = useRef(DWELL), bank = useRef(0), lastRoute = useRef(0);
  const cruiseRef = useRef(cruise); cruiseRef.current = cruise;
  const countRef = useRef(0); countRef.current = stages.length;
  const stage = stages[index];
  const jump = (n: number) => { if (n >= 0 && n < stages.length) { target.current = n; jumping.current = true; dwell.current = DWELL; setEffect(null); } };
  useEffect(() => {
    let raf = 0, prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05); prev = now;
      const p = posRef.current;
      if (!jumping.current) {
        const v0 = cruiseRef.current ? SPEED * Math.sin(headRef.current * Math.PI / 180) : 0;
        target.current = Math.max(0, Math.min(countRef.current - 1, p + v0 * dt));
        posRef.current = target.current; bank.current *= Math.exp(-1.6 * dt);
        setPos(target.current); setT(now / 1000); raf = requestAnimationFrame(step); return;
      }
      if (Math.abs(target.current - p) < 0.002) jumping.current = false;
      const diff = target.current - p;
      const v = Math.sign(diff) * Math.min(Math.abs(diff), Math.max(CRUISE * dt, Math.abs(diff) * (1 - Math.exp(-3 * dt))));
      const np = Math.abs(diff) < 0.002 ? target.current : p + v;
      posRef.current = np;
      bank.current *= Math.exp(-1.6 * dt);
      setPos(np); setT(now / 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const ix = Math.min(Math.floor(pos + 1e-4), Math.max(0, stages.length - 1));
  if (ix !== index) setIndex(ix);
  const frac = Math.max(0, pos - index);
  if (stage && stage.route_order !== lastRoute.current) {
    if (lastRoute.current) bank.current = Math.sign(stage.route_order - lastRoute.current) * 5;
    lastRoute.current = stage.route_order;
  }
  const nextYear = stages[index + 1]?.start_year ?? stage?.start_year ?? 0;
  const year = stage ? stage.start_year + (nextYear - stage.start_year) * frac : 0;
  const roll = bank.current + Math.sin(t * 0.7) * 0.6, bob = Math.sin(t * 0.9) * 5 + Math.sin(t * 2.1) * 1.2;

  useEffect(() => {
    let on = true;
    getRoadmap().catch(() => undefined).then((snap) => snap?.stages?.length ? snap : fallback()).then((snap) => {
      if (!on) return;
      const dated = (snap?.stages ?? []).filter((s) => s.start_year != null)
        .sort((a, b) => a.start_year! - b.start_year! || a.route_order - b.route_order || a.sequence_no - b.sequence_no);
      if (!dated.length) { setFailed(true); return; }
      const start = Math.max(0, dated.findIndex((s) => s.route_order === 3 && s.start_year === 1945));
      setIndex(start); posRef.current = start; target.current = start; setPos(start);
      setData(snap!);
    }).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  const route = data?.routes.find((r) => r.route_order === stage?.route_order);
  const gate = data?.boundaries.filter((b) => b.boundary_year > (stage?.start_year ?? 0))
    .sort((a, b) => a.boundary_year - b.boundary_year)[0];
  const linked = new Set(data?.links?.filter((l) => l.parent_phenomenon_id === route?.phenomenon_id
    && l.parent_state_id === stage?.state_id).map((l) => l.chain_id));
  const obs = stage && STAGE_OBSERVATIONS[`${stage.route_order}:${stage.start_year}`];
  const available = (kind: ObservationKind) => {
    const item = obs?.[kind];
    if (!item) return undefined;
    const url = data?.details?.find((d) => d.chain_id === item.chain && d.detail_id === item.source)?.detail.source_url;
    return typeof url === "string" && /^https?:\/\//i.test(url) ? { ...item, url } : undefined;
  };
  const strength = available("strength"), difficulty = available("difficulty");
  const selected = effect === "strength" ? strength : effect === "difficulty" ? difficulty : undefined;
  const lanes = stage ? (data?.chains ?? []).filter((c) => linked.has(c.chain_id)
      || (c.route_orders.includes(stage.route_order) && c.start_year != null
        && c.start_year <= (stage.end_year ?? stage.start_year) && (c.end_year ?? c.start_year) >= stage.start_year))
    .sort((a, b) => Number(linked.has(b.chain_id)) - Number(linked.has(a.chain_id))
      || Math.abs((a.start_year ?? 1e9) - stage.start_year) - Math.abs((b.start_year ?? 1e9) - stage.start_year))
    .slice(0, 4).map((c) => ({ id: c.chain_id, label: SHORT(c.title).split(":")[0], context: !linked.has(c.chain_id) })) : [];
  const LANE_C = ["#79d8e6", "#d5b9fb", "#f2ba86", "#9befcd"];
  const c = COLORS[stage?.route_order ?? 0];
  const ahead = stages.slice(index + 1, index + 1 + AHEAD);
  const gateDepth = gate ? (() => {
    const k = ahead.findIndex((s) => s.start_year >= gate.boundary_year);
    return (k === -1 ? AHEAD + 0.6 : k + 0.5) - frac;
  })() : undefined;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === " ") { e.preventDefault(); setCruise((x) => !x); return; }
    if (e.key === "Escape") { e.stopPropagation(); effect ? setEffect(null) : onClose(); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); jump(index - 1); }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); jump(index + 1); }
  };

  return (
    <section className="bv" role="dialog" aria-label="Komentosilta" onKeyDown={onKey}
      style={{ "--c": c } as React.CSSProperties}
      onWheel={(e) => { if (Math.abs(e.deltaY) > 30) jump(index + (e.deltaY > 0 ? 1 : -1)); }}>
      <style>{CSS}</style>
      <svg className="bv-world" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden={!stage}>
        <defs>
          <linearGradient id="bv-sky" x2="0" y2="1">
            <stop offset="0" stopColor="#02060c" /><stop offset=".7" stopColor="#071624" />
            <stop offset="1" stopColor={c} stopOpacity=".35" />
          </linearGradient>
          <linearGradient id="bv-floor" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity=".18" /><stop offset=".25" stopColor="#04101a" /><stop offset="1" stopColor="#02060c" />
          </linearGradient>
          <radialGradient id="bv-sun" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor={c} stopOpacity=".55" /><stop offset=".4" stopColor={c} stopOpacity=".12" /><stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bv-pillar" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".7" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id="bv-road" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity=".05" /><stop offset="1" stopColor={c} stopOpacity=".5" />
          </linearGradient>
          <filter id="bv-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
          <filter id="bv-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
        </defs>
        <g transform={`rotate(${roll.toFixed(2)} ${CX} ${H}) translate(0 ${bob.toFixed(1)})`}>
        <rect x={-200} y={-100} width={W + 400} height={HZ + 100} fill="url(#bv-sky)" />
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dff4ff" opacity={s.o * (1 - s.y / HZ * 0.6)} />)}
        <ellipse cx={CX} cy={HZ} rx="620" ry="190" fill="url(#bv-sun)" />
        <rect x={-200} y={HZ} width={W + 400} height={H - HZ + 100} fill="url(#bv-floor)" />
        {/* perspective floor grid */}
        <g stroke={c} strokeOpacity=".16" fill="none">
          {Array.from({ length: 25 }, (_, i) => { const x = (i - 12) * 260; return <line key={i} x1={CX + x * 0.02} y1={HZ} x2={CX + x} y2={H} />; })}
          {Array.from({ length: 14 }, (_, i) => { const d = i * 0.5 + 0.5 - ((pos * 1.2 + t * 0.15) % 0.5); const y = yAt(d * 1.4) ; return <line key={i} x1="0" x2={W} y1={y} y2={y} strokeOpacity={0.05 + 0.18 * sAt(d)} />; })}
        </g>
        <line x1="0" x2={W} y1={HZ} y2={HZ} stroke={c} strokeOpacity=".7" />
        <line x1="0" x2={W} y1={HZ} y2={HZ} stroke={c} strokeWidth="6" opacity=".35" filter="url(#bv-glow)" />

        {stage && <>
          {/* road of time */}
          {(() => {
            const pts = Array.from({ length: 30 }, (_, i) => i / 29 * (AHEAD + 1.5));
            const L = pts.map((d) => `${xAt(d) - 150 * sAt(d)},${yAt(d)}`), R = pts.map((d) => `${xAt(d) + 150 * sAt(d)},${yAt(d)}`).reverse();
            const mid = pts.map((d, i) => `${i ? "L" : "M"}${xAt(d)},${yAt(d)}`).join(" ");
            return <g>
              <path d={`M${L.join(" L")} L${R.join(" L")}Z`} fill="url(#bv-road)" />
              <path d={mid} stroke={c} strokeWidth="3" fill="none" className="bv-flow" opacity=".9" />
              <path d={mid} stroke={c} strokeWidth="10" fill="none" opacity=".25" filter="url(#bv-glow)" />
            </g>;
          })()}

          {/* theme lanes */}
          {!selected && lanes.map((l, i) => {
            const side = i % 2 ? 1 : -1, off = 330 + Math.floor(i / 2) * 260;
            const d = `M${CX + side * off * 1.6},${H} Q${CX + side * off * 0.7},${yAt(1.2)} ${CX + side * off * 0.08},${HZ + 4}`;
            return <g key={l.id} className="bv-enter">
              <path d={d} stroke={LANE_C[i]} strokeWidth="14" fill="none" opacity={l.context ? .06 : .16} filter="url(#bv-glow)" />
              <path id={`bvl-${i}`} d={d} stroke={LANE_C[i]} strokeWidth={l.context ? 1.2 : 2.2} fill="none" opacity=".7" strokeDasharray={l.context ? "6 8" : undefined} />
              <path d={d} stroke="#fff" strokeWidth="2.5" fill="none" className="bv-flow-slow" opacity=".6" />
              <text fontSize="20" fill={LANE_C[i]} className="bv-label" letterSpacing="2">
                <textPath href={`#bvl-${i}`} startOffset="6%">{l.label}</textPath>
              </text>
            </g>;
          })}

          {/* observation arcs */}
          {selected && (() => {
            const col = effect === "difficulty" ? "#ffc58f" : "#9ff0c0", side = effect === "difficulty" ? 1 : -1;
            const x0 = xAt(0), y0 = yAt(0) - 40, x1 = CX + side * 420, y1 = HZ + 120;
            const d = `M${x0},${y0} Q${(x0 + x1) / 2 + side * 120},${y0 - 40} ${x1},${y1}`;
            return <g className="bv-enter" key={effect}>
              <path d={d} stroke={col} strokeWidth="18" fill="none" opacity=".25" filter="url(#bv-glow)" />
              <path d={d} stroke={col} strokeWidth="2.5" fill="none" />
              <path d={d} stroke="#fff" strokeWidth="3" fill="none" className="bv-flow" />
              <circle cx={x1} cy={y1} r="10" fill={col} className="bv-pulse" />
              <text x={x1} y={y1 - 44} textAnchor="middle" fontSize="26" fill={col} className="bv-label">{selected.label}</text>
              <text x={x1} y={y1 - 18} textAnchor="middle" fontSize="17" fill="#d9ece6" className="bv-label">
                {selected.years[0]} {selected.points[0]} → {selected.years[1]} {selected.points[1]}
              </text>
            </g>;
          })()}

          {/* era gate */}
          {gate && gateDepth != null && (() => {
            const s = sAt(gateDepth), x = xAt(gateDepth), y = yAt(gateDepth), w = 420 * s + 60, h = 520 * s + 60;
            return <g className="bv-enter" key={gate.boundary_year}>
              <path d={`M${x - w / 2},${y} V${y - h + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w / 2},${y - h + w / 2} V${y}`}
                fill="none" stroke="#e8fbff" strokeWidth="14" opacity=".2" filter="url(#bv-glow)" />
              <path d={`M${x - w / 2},${y} V${y - h + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w / 2},${y - h + w / 2} V${y}`}
                fill="none" stroke="#e8fbff" strokeWidth="1.6" strokeDasharray="2 6" />
              <text x={x} y={y - h - 14} textAnchor="middle" fontSize={18 + 16 * s} fill="#e8fbff" className="bv-label" letterSpacing="4">{gate.boundary_year}</text>
              <text x={x} y={y - h - 14 - (22 + 14 * s)} textAnchor="middle" fontSize="13" fill="#9fc0ca" className="bv-label" letterSpacing="3">AIKAKAUSIRAJA</text>
            </g>;
          })()}

          {/* upcoming beacons, far first */}
          {[stage, ...ahead].map((s, i) => ({ s, d: i - frac, n: i })).filter(({ d, n }) => n > 0 || (frac > 0.02 && d > -0.9)).reverse().map(({ s, d: dd, n: d }) => {
            const sc = sAt(Math.max(dd, -0.6)) * (dd < 0 ? 1 + dd : 1), x = xAt(dd) + (dd < 0 ? (d % 2 ? 1 : -1) * dd * -900 : 0), y = yAt(Math.max(dd, -0.6)), col = COLORS[s.route_order], side = d % 2 ? 1 : -1;
            const h = 240 * sc + 20, title = SHORT(s.title), short = title.length > 34 ? title.slice(0, 33) + "…" : title;
            return <g key={keyOf(s)} className="bv-beacon bv-moving" role="button" tabIndex={0}
              aria-label={`Siirry: ${s.start_year} ${title}`} opacity={Math.min(1, 0.35 + 0.65 * sc * 1.6) * (dd > AHEAD - 0.5 ? Math.max(0, AHEAD + 0.5 - dd) : 1)}
              onClick={() => jump(index + d)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); jump(index + d); } }}>
              <rect x={x - 3 * sc - 1} y={y - h} width={6 * sc + 2} height={h} fill="url(#bv-pillar)" opacity=".5" />
              <rect x={x - 14 * sc} y={y - h} width={28 * sc} height={h} fill={col} opacity=".14" filter="url(#bv-soft)" />
              <ellipse cx={x} cy={y} rx={60 * sc + 8} ry={12 * sc + 3} fill={col} opacity=".3" filter="url(#bv-soft)" />
              <circle className="bv-ring" cx={x} cy={y - h} r={22 * sc + 6} fill="none" stroke={col} strokeOpacity=".6" />
              <circle className="bv-core" cx={x} cy={y - h} r={9 * sc + 3} fill={col} />
              <circle cx={x} cy={y - h} r={26 * sc + 8} fill={col} opacity=".35" filter="url(#bv-glow)" />
              <line x1={x + side * (26 * sc + 8)} y1={y - h} x2={x + side * (60 * sc + 26)} y2={y - h} stroke={col} strokeOpacity=".6" />
              <text x={x + side * (60 * sc + 32)} y={y - h - 2} textAnchor={side > 0 ? "start" : "end"} fontSize={14 + 18 * sc} fill={col} className="bv-label" fontWeight="600">{s.start_year}</text>
              <text x={x + side * (60 * sc + 32)} y={y - h + 14 + 12 * sc} textAnchor={side > 0 ? "start" : "end"} fontSize={12 + 10 * sc} fill="#e8f6f8" className="bv-label">{dd <= 3 ? short : ""}</text>
            </g>;
          })}

          {!ahead.length && <text x={CX} y={HZ - 30} textAnchor="middle" fontSize="22" fill={c} className="bv-label bv-enter" letterSpacing="4">TIE JATKUU AVOIMEEN TULEVAISUUTEEN</text>}
          {/* current stage: the bridge's bow */}
          <g key={keyOf(stage)} className="bv-enter">
            <ellipse cx={xAt(0)} cy={yAt(0)} rx="200" ry="34" fill={c} opacity=".25" filter="url(#bv-glow)" />
            <circle cx={xAt(0)} cy={yAt(0) - 40} r="38" fill={c} opacity=".3" className="bv-pulse" />
            <circle cx={xAt(0)} cy={yAt(0) - 40} r="14" fill={c} />
            <circle cx={xAt(0)} cy={yAt(0) - 40} r="24" fill="none" stroke={c} strokeOpacity=".8" />
          </g>
        </>}
        </g>
      </svg>
      <div className="bv-frame" />

      <header className="bv-top">
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="bv-btn" autoFocus onClick={onClose} aria-label="Sulje komentosilta">← Atlas</button>
          <button type="button" className="bv-btn" aria-pressed={cruise} onClick={() => setCruise((x) => !x)}
            title="Välilyönti">{cruise ? "⏸ Pysäytä" : "▶ Risteile"}</button>
        </span>
        {stage && <div className="bv-readout" aria-live="polite">
          Komentosilta · Reitti {ROMAN[stage.route_order]}
          <b>{Math.floor(year)}</b>
          {cruise ? (Math.sin(heading * Math.PI / 180) >= 0 ? `▶ Tulevaisuuteen ${Math.round(heading)}° · ` : `◀ Menneisyyteen ${Math.round(heading)}° · `) : "⏸ Pysäytetty · "}
          {gate ? `${Math.max(0, Math.round(gate.boundary_year - year))} v. rajaan ${gate.boundary_year}` : "Horisontti avoin"}
        </div>}
      </header>

      {!stage && <p className="bv-msg" role="status">{failed ? "Komentosillan aineistoa ei saatu ladattua." : "Ladataan väylää…"}</p>}

      {stage && <footer className="bv-console">
        <div className="bv-now">
          <button type="button" className="bv-btn" disabled={index === 0} onClick={() => jump(index - 1)} aria-label="Edellinen etappi">←</button>
          <div>
            <small>{route ? SHORT(route.title) : ""}</small>
            <h2>{SHORT(stage.title)}</h2>
            {stage.situation && stage.situation !== stage.title && <p>{stage.situation}</p>}
          </div>
          <button type="button" className="bv-btn" disabled={index === stages.length - 1} onClick={() => jump(index + 1)} aria-label="Seuraava etappi">→</button>
        </div>
        {(strength || difficulty) && <div className="bv-row">
          {strength && <button type="button" className="bv-obs s" aria-pressed={effect === "strength"}
            onClick={() => setEffect(effect === "strength" ? null : "strength")}><span>▲ Vahvuus · {strength.label}</span></button>}
          {difficulty && <button type="button" className="bv-obs d" aria-pressed={effect === "difficulty"}
            onClick={() => setEffect(effect === "difficulty" ? null : "difficulty")}><span>▼ Vaikeus · {difficulty.label}</span></button>}
          {selected && <a className="bv-effect" href={selected.url} target="_blank" rel="noreferrer">Lähde ↗</a>}
        </div>}
        {!selected && lanes.length > 0 && <div className="bv-row bv-lanes" aria-label="Teemakaistat">
          {lanes.map((l, i) => <span key={l.id} className="bv-lane" data-context={l.context}
            style={{ "--l": LANE_C[i] } as React.CSSProperties}>{l.label}{l.context ? " · samanaikainen" : ""}</span>)}
        </div>}
        <NavOrb stages={stages} index={index} onPick={jump} heading={heading} onHeading={setHeading}
          routes={(data?.routes ?? []).map((r) => ({ order: r.route_order, title: SHORT(r.title) }))} />
      </footer>}
    </section>
  );
}

/* 360° navigation orb: longitude = main route sector (I–V), latitude = time 1500→2050.
   Dragging rotates the orb; on release it snaps to the stage nearest the crosshair. */
const BOUNDS = [1809, 1917, 1986, 2026];
const latOf = (y: number) => -72 + ((y - 1500) / 550) * 144;
const orbLonLat = (s: Stage) => ({ lon: (s.route_order - 1) * 72 + (((s.sequence_no * 37) % 30) - 15), lat: latOf(s.start_year) });
const R2D = Math.PI / 180;
function proj(lon: number, lat: number, v: { lon: number; lat: number }) {
  const l = (lon - v.lon) * R2D, f = lat * R2D, f0 = v.lat * R2D;
  return { x: Math.cos(f) * Math.sin(l), y: -(Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l)),
    z: Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l) };
}
const angDist = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => 1 - proj(a.lon, a.lat, b).z;

function NavOrb({ stages, index, onPick, routes, heading, onHeading }: { stages: Stage[]; index: number; onPick: (i: number) => void; routes: { order: number; title: string }[]; heading: number; onHeading: (h: number) => void }) {
  const target = { lon: heading, lat: stages[index] ? latOf(stages[index].start_year) : 0 };
  const [view, setView] = useState(target);
  const drag = useRef<{ x: number; y: number; v: { lon: number; lat: number }; moved: boolean } | null>(null);
  const viewRef = useRef(view); viewRef.current = view;
  useEffect(() => {
    if (drag.current) return;
    let raf = 0;
    const step = () => {
      const v = viewRef.current;
      let dl = ((target.lon - v.lon + 540) % 360) - 180; const df = target.lat - v.lat;
      if (Math.abs(dl) < 0.1 && Math.abs(df) < 0.1) { setView(target); return; }
      setView({ lon: v.lon + dl * 0.16, lat: v.lat + df * 0.16 });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target.lon, target.lat]);

  const S = 100, Rr = 86;
  const P = (lon: number, lat: number) => { const q = proj(lon, lat, view); return { x: S + q.x * Rr, y: S + q.y * Rr, z: q.z }; };
  const line = (pts: { x: number; y: number; z: number }[]) => {
    let d = "", pen = false;
    for (const q of pts) { if (q.z > 0) { d += `${pen ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`; pen = true; } else pen = false; }
    return d;
  };
  const nearest = (v: { lon: number; lat: number }) => stages.reduce((b, s, i) => angDist(orbLonLat(s), v) < angDist(orbLonLat(stages[b]), v) ? i : b, index);
  const cur = stages[index];
  const hover = cur; void nearest;
  const routeAt = routes.find((r) => r.order === hover?.route_order);

  return <div className="bv-orbwrap">
    <svg className="bv-orb" viewBox="0 0 200 200" role="slider" tabIndex={0} aria-label="Navigointipallo: aika ja reitti"
      aria-valuemin={1500} aria-valuemax={2050} aria-valuenow={cur?.start_year} aria-valuetext={cur ? `${cur.start_year}, reitti ${ROMAN[cur.route_order]}` : ""}
      onKeyDown={(e) => {
        if (!cur) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault(); e.stopPropagation();
          const o = ((cur.route_order - 1 + (e.key === "ArrowRight" ? 1 : routes.length - 1)) % routes.length) + 1;
          const cand = stages.map((s, i) => ({ s, i })).filter((x) => x.s.route_order === o);
          if (cand.length) onPick(cand.reduce((b, x) => Math.abs(x.s.start_year - cur.start_year) < Math.abs(b.s.start_year - cur.start_year) ? x : b).i);
        }
      }}
      onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, v: viewRef.current, moved: false }; }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        const lon = (((d.v.lon - dx * 0.9) % 360) + 360) % 360; setView({ lon, lat: d.v.lat }); onHeading(lon);
      }}
      onPointerUp={(e) => {
        const d = drag.current; drag.current = null; if (!d) return;
        if (d.moved) return;
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-si]");
        if (el) onPick(Number(el.getAttribute("data-si")));
      }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <defs>
        <radialGradient id="bv-orbg" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#1d3b4c" /><stop offset=".6" stopColor="#081722" /><stop offset="1" stopColor="#02060c" />
        </radialGradient>
      </defs>
      <circle cx={S} cy={S} r={Rr + 8} fill="none" stroke="var(--c)" strokeOpacity=".25" strokeDasharray="1 5" />
      <circle cx={S} cy={S} r={Rr} fill="url(#bv-orbg)" stroke="var(--c)" strokeOpacity=".5" />
      {/* time rings */}
      {[1600, 1700, 1800, 1900, 2000].map((y) => <path key={y} d={line(Array.from({ length: 73 }, (_, i) => P(i * 5, latOf(y))))} stroke="#9fc0ca" strokeOpacity=".14" fill="none" />)}
      {BOUNDS.map((y) => <path key={y} d={line(Array.from({ length: 73 }, (_, i) => P(i * 5, latOf(y))))} stroke="#e8fbff" strokeOpacity=".55" strokeWidth="1" strokeDasharray="2 3" fill="none" />)}
      {/* route sectors */}
      {routes.map((r) => <path key={r.order} d={line(Array.from({ length: 37 }, (_, i) => P((r.order - 1) * 72 - 36, -90 + i * 5)))} stroke={COLORS[r.order]} strokeOpacity=".35" fill="none" />)}
      {routes.map((r) => { const q = P((r.order - 1) * 72, -80); return q.z > 0.15 ? <text key={r.order} x={q.x} y={q.y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={COLORS[r.order]} opacity={q.z}>{ROMAN[r.order]}</text> : null; })}
      {/* stages */}
      {stages.map((s, i) => { const o = orbLonLat(s), q = P(o.lon, o.lat); if (q.z <= 0) return null;
        const on = i === index;
        return <circle key={keyOf(s)} data-si={i} cx={q.x} cy={q.y} r={on ? 4.5 : 1.6 + 1.6 * q.z} fill={COLORS[s.route_order]} opacity={0.3 + 0.7 * q.z} style={{ cursor: "pointer" }} />; })}
      {(() => { const a = (heading - 90) * R2D; const fw = Math.sin(heading * R2D) >= 0; return <g pointerEvents="none">
        <circle cx={S} cy={S} r={Rr + 8} fill="none" stroke={fw ? "#7ad7ea" : "#f2ba86"} strokeOpacity=".5" strokeDasharray={`${Math.abs(Math.sin(heading * R2D)) * 60} 600`} transform={`rotate(${heading - 90 - 15} ${S} ${S})`} />
        <text x={S + Math.sin(a) * (Rr + 2)} y={S - Math.cos(a) * (Rr + 2) + 3} textAnchor="middle" fontSize="10" fill={fw ? "#7ad7ea" : "#f2ba86"}>{fw ? "▲" : "▼"}</text>
      </g>; })()}
      {/* specular + crosshair */}
      <ellipse cx={S - 28} cy={S - 34} rx="34" ry="20" fill="#fff" opacity=".06" pointerEvents="none" />
      <g stroke="var(--c)" strokeWidth="1.2" pointerEvents="none">
        <circle cx={S} cy={S} r="11" fill="none" className="bv-pulse" />
        <line x1={S - 20} x2={S - 13} y1={S} y2={S} /><line x1={S + 13} x2={S + 20} y1={S} y2={S} />
        <line y1={S - 20} y2={S - 13} x1={S} x2={S} /><line y1={S + 13} y2={S + 20} x1={S} x2={S} />
      </g>
    </svg>
    <div className="bv-orbinfo" aria-hidden="true">
      Reitti {hover ? ROMAN[hover.route_order] : ""}<b>{hover?.start_year}</b>{routeAt?.title.slice(0, 26)}
      <div style={{ marginTop: 4, color: Math.sin(heading * R2D) >= 0 ? "#7ad7ea" : "#f2ba86" }}>Kurssi {Math.round(heading)}° {Math.sin(heading * R2D) >= 0 ? "▶ eteen" : "◀ taakse"}</div>
      <div style={{ opacity: .7 }}>↔ pyöritä suuntaa</div>
    </div>
  </div>;
}
