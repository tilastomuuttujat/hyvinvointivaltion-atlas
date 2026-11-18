import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRoadmap } from "@/lib/atlas.static";
import { lanes, roadY, routeOf, timeScale, type Roadmap as RoadmapData } from "@/lib/atlas.roadmap";

const W = 1600, H = 1000, CY = 520, X0 = 120, X1 = 5000;
const HUE: Record<number, number> = { 1: 55, 2: 200, 3: 150, 4: 300, 5: 25 };
const col = (r: number, l = 0.82, c = 0.13) => `oklch(${l} ${c} ${HUE[r]})`;
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const CSS = `
.rm{position:fixed;inset:0;z-index:60;background:radial-gradient(ellipse at 50% 55%,oklch(.17 .045 265),oklch(.07 .02 260) 75%);color:oklch(.93 .015 230);overflow:hidden;touch-action:none;user-select:none}
.rm svg{width:100%;height:100%;display:block;cursor:grab}.rm svg:active{cursor:grabbing}
.rm-label{paint-order:stroke;stroke:oklch(.08 .02 260);stroke-width:4px;stroke-linejoin:round}
.rm-flow{animation:rm-flow 2.4s linear infinite}@keyframes rm-flow{to{stroke-dashoffset:-40}}
.rm-pulse{animation:rm-pulse 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes rm-pulse{50%{opacity:.35;transform:scale(1.35)}}
.rm-twinkle{animation:rm-tw 4s ease-in-out infinite}@keyframes rm-tw{50%{opacity:.15}}
.rm-hit{cursor:pointer}
.rm-close{position:absolute;top:14px;left:14px;background:transparent;border:1px solid oklch(.45 .03 230 / .5);color:inherit;border-radius:999px;width:38px;height:38px;font-size:18px;cursor:pointer;opacity:.75}
.rm-title{position:absolute;top:20px;left:64px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;pointer-events:none}
.rm-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-size:12px;opacity:.55;pointer-events:none;text-align:center;max-width:92vw}
.rm-mini{position:absolute;bottom:58px;left:50%;transform:translateX(-50%);display:flex;gap:6px}
.rm-mini button{background:transparent;border:1px solid var(--c);color:var(--c);border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer;opacity:.75}
.rm-mini button[data-on=true]{opacity:1;box-shadow:0 0 14px var(--c)}
.rm-panel{position:absolute;top:0;right:0;bottom:0;width:min(420px,92vw);background:oklch(.11 .03 260 / .95);border-left:1px solid color-mix(in oklch,var(--c) 50%,transparent);padding:24px 22px;overflow:auto;transform:translateX(104%);transition:transform .5s cubic-bezier(.2,.8,.2,1);font-size:14px;line-height:1.55;backdrop-filter:blur(6px)}
.rm-panel[data-open=true]{transform:none}
.rm-panel h2{font-size:20px;line-height:1.25;margin:6px 0 10px}.rm-panel p{margin:6px 0}
.rm-k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--c)}
.rm-x{float:right;background:transparent;border:0;color:inherit;font-size:22px;cursor:pointer;opacity:.75}
.rm-note{opacity:.6;font-size:12px;margin-top:14px}
@media (max-width:700px){.rm-hint{font-size:11px;bottom:8px}.rm-mini{bottom:112px}.rm-title{font-size:11px}}
@media (prefers-reduced-motion:reduce){.rm-flow,.rm-pulse,.rm-twinkle{animation:none}.rm-panel{transition:none}}
`;

let cache: Promise<RoadmapData> | null = null;
function load() {
  cache ??= getRoadmap().catch(() => undefined).then((snapshot) => {
    if (snapshot?.routes.length === 5 && snapshot.routes.every((r) => r.start_year != null && r.end_year != null)) {
      return {
        routes: snapshot.routes.map((r) => ({
          order: r.route_order, id: r.phenomenon_id, title: r.title,
          start: r.start_year!, end: r.end_year!, kind: r.phenomenon_kind, status: r.review_status,
        })),
        stages: snapshot.stages.flatMap((s) => s.start_year == null ? [] : [{
          route: s.route_order, seq: s.sequence_no, title: s.title,
          start: s.start_year, end: s.end_year ?? undefined, situation: s.situation,
        }]),
        boundaries: snapshot.boundaries.map((b) => ({
          from: b.from_route_order, to: b.to_route_order, year: b.boundary_year, title: b.title,
        })),
        chains: snapshot.chains.flatMap((c) => c.start_year == null ? [] : [{
          id: c.chain_id, title: c.title, start: c.start_year, end: c.end_year ?? undefined,
          routes: c.route_orders, learning: c.learning_point,
        }]),
        intersections: snapshot.intersections.flatMap((i) => i.start_year == null ? [] : [{
          id: i.phenomenon_id, title: i.title, start: i.start_year,
          end: i.end_year ?? undefined, routes: i.route_orders,
        }]),
      };
    }
    return fetch(new URL("data/roadmap.json", document.baseURI).href).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<RoadmapData>;
    });
  }).catch((e) => { cache = null; throw e; });
  return cache;
}

type Pick = { kind: "stage" | "chain" | "boundary" | "route" | "cross" | "gap"; route: number; title: string; years: string; body?: string; note?: string };
const yrs = (a: number, b?: number) => (b && b !== a ? `${a}–${b}` : String(a));

/** Full-screen roadmap: one luminous road 1500→2050 through five main routes, gates at turning points, theme streams alongside. */
export function Roadmap({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [failed, setFailed] = useState(false);
  const [pan, setPan] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const [pick, setPick] = useState<Pick | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; pan: number; moved: boolean } | null>(null);
  const target = useRef<number | null>(null);

  useEffect(() => { load().then(setData, () => setFailed(true)); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") (pick ? setPick(null) : onClose()); if (e.key === "ArrowRight") setPan((p) => p - 160); if (e.key === "ArrowLeft") setPan((p) => p + 160); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [pick, onClose]);
  // Smooth glide when jumping to a route.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      if (target.current !== null) setPan((p) => { const n = p + (target.current! - p) * 0.12; if (Math.abs(n - target.current!) < 0.5) { const t = target.current!; target.current = null; return t; } return n; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, []);

  const x = useMemo(() => timeScale(X0, X1), []);
  const road = useMemo(() => {
    const pts: string[] = [];
    for (let px = X0 - 200; px <= X1 + 260; px += 12) pts.push(`${px.toFixed(0)},${roadY(px, CY).toFixed(1)}`);
    return "M" + pts.join(" L");
  }, []);
  const segPath = (a: number, b: number, dy = 0) => {
    const pts: string[] = [];
    for (let px = a; px <= b; px += 10) pts.push(`${px.toFixed(0)},${(roadY(px, CY) + dy).toFixed(1)}`);
    pts.push(`${b.toFixed(0)},${(roadY(b, CY) + dy).toFixed(1)}`);
    return "M" + pts.join(" L");
  };
  const stars = useMemo(() => Array.from({ length: 220 }, (_, i) => {
    const s = Math.sin(i * 12.9898) * 43758.5453, r = s - Math.floor(s);
    const s2 = Math.sin(i * 78.233) * 12345.678, r2 = s2 - Math.floor(s2);
    return { x: r * (X1 + 600) - 300, y: r2 * 1400 - 200, r: 0.4 + ((i * 7) % 10) / 9, d: (i % 7) * 0.6 };
  }), []);

  const streams = useMemo(() => {
    if (!data) return [];
    const cs = data.chains.filter((c) => c.start >= 1500 && c.start <= 2050).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).map((c) => ({ ...c, end: Math.max(c.end ?? c.start, c.start + 3) }));
    const up = cs.filter((_, i) => i % 2 === 0), down = cs.filter((_, i) => i % 2 === 1);
    const lu = lanes(up, 2), ld = lanes(down, 2);
    return [...up.map((c, i) => ({ c, side: -1, lane: lu[i] })), ...down.map((c, i) => ({ c, side: 1, lane: ld[i] }))];
  }, [data]);

  const gaps = useMemo(() => {
    const ends = new Map<string, number>();
    return streams.flatMap(({ c, side, lane }) => {
      const id = `${side}:${lane}`;
      const start = ends.get(id);
      ends.set(id, c.end);
      return start != null && x(c.start) - x(start) >= 14 ? [{ start, end: c.start, side, lane }] : [];
    });
  }, [streams, x]);

  if (failed) return <div className="rm"><style>{CSS}</style><button className="rm-close" onClick={onClose} aria-label="Sulje">←</button><p className="rm-hint">Tiekartan aineistoa ei saatu ladattua.</p></div>;

  const toSvgX = (clientDx: number) => { const r = svgRef.current?.getBoundingClientRect(); return r ? clientDx / Math.max(r.width / W, r.height / H) : clientDx; };
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, pan, moved: false }; target.current = null; (e.currentTarget as Element).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const dx = toSvgX(e.clientX - d.x) / zoom; if (Math.abs(dx) > 4) d.moved = true; setPan(d.pan + dx); };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (d && !d.moved) { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pick]") as HTMLElement | null; el?.dispatchEvent(new CustomEvent("rmpick", { bubbles: true })); }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { setPan((p) => p - e.deltaX / zoom); return; }
    setZoom((z) => Math.max(0.35, Math.min(2.4, z * Math.exp(-e.deltaY * 0.0015))));
  };
  const goRoute = (r: number) => { if (!data) return; const rt = data.routes[r - 1]; const mid = (x(rt.start) + x(rt.end)) / 2; target.current = W / 2 / zoom - mid; };
  const clampedPan = Math.max(W / zoom - X1 - 400, Math.min(400, pan));
  const tx = clampedPan * zoom, scale = zoom, ty = (H - H * zoom) / 2 + (CY - CY) * 0;
  const pickable = (p: Pick) => ({ "data-pick": "1", className: "rm-hit", ref: (el: Element | null) => { if (el) (el as any).__rm = p; } });

  return (
    <div className="rm" role="dialog" aria-label="Tiekartta" onPointerDown={(e) => e.stopPropagation()}>
      <style>{CSS}</style>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)} onWheel={onWheel}
      >
        <defs>
          <linearGradient id="rm-road" x1={X0} x2={X1} gradientUnits="userSpaceOnUse">
            {[1, 2, 3, 4, 5].map((r) => data && <stop key={r} offset={(x((data.routes[r - 1].start + data.routes[r - 1].end) / 2) - X0) / (X1 - X0)} stopColor={col(r)} />)}
          </linearGradient>
          <filter id="rm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
          <filter id="rm-soft"><feGaussianBlur stdDeviation="2" /></filter>
          <radialGradient id="rm-gate"><stop offset="0" stopColor="oklch(.95 .05 230)" stopOpacity=".55" /><stop offset="1" stopColor="oklch(.95 .05 230)" stopOpacity="0" /></radialGradient>
          <linearGradient id="rm-fog" x1="0" x2="1"><stop offset="0" stopColor="oklch(.07 .02 260)" stopOpacity="0" /><stop offset="1" stopColor="oklch(.07 .02 260)" stopOpacity=".95" /></linearGradient>
        </defs>
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          <g transform={`translate(${-tx / scale * 0.55} 0)`} opacity=".8">
            {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="oklch(.9 .02 230)" className={i % 5 === 0 ? "rm-twinkle" : undefined} style={{ animationDelay: `${s.d}s` }} opacity={0.25 + (i % 4) * 0.12} />)}
          </g>
          {data && (
            <>
              {/* Era bands */}
              {data.routes.map((r) => (
                <g key={r.id}>
                  <rect x={x(r.start)} y={-300} width={x(r.end) - x(r.start)} height={1600} fill={col(r.order, 0.5, 0.08)} opacity={r.order % 2 ? 0.05 : 0.08} />
                  <text x={(x(r.start) + x(r.end)) / 2} y={150} textAnchor="middle" fontSize={92} fontWeight={700} fill={col(r.order)} opacity={0.12} letterSpacing=".1em">{ROMAN[r.order]}</text>
                  <g {...pickable({ kind: "route", route: r.order, title: r.title, years: yrs(r.start, r.end), body: data.stages.filter((s) => s.route === r.order).map((s) => s.title).join(" · "), note: r.kind === "hypothetical" ? "Hypoteettinen reitti: vaihtoehtoisia kehityspolkuja, ei ennuste." : r.status === "needs_review" ? "Reitti odottaa vielä tarkistusta." : undefined })}>
                    <text x={(x(r.start) + x(r.end)) / 2} y={200} textAnchor="middle" fontSize={22} fill={col(r.order)} className="rm-label" letterSpacing=".06em">{r.title.replace(/^Pää(ketju|reitti) [IVX]+: /, "")}</text>
                    <text x={(x(r.start) + x(r.end)) / 2} y={226} textAnchor="middle" fontSize={14} fill="currentColor" opacity={0.55}>{yrs(r.start, r.end)}</text>
                  </g>
                </g>
              ))}

              {gaps.map(({ start, end, side, lane }) => {
                const dy = side * (70 + lane * 9);
                const path = segPath(x(start), x(end), dy);
                return (
                  <g key={`${side}:${lane}:${start}`} {...pickable({
                    kind: "gap", route: routeOf(start), title: "Väli teemakaistalla",
                    years: yrs(start, end),
                    body: "Tähän väliin ei ole piirretty teemaketjua tällä kaistalla. Viereisillä kaistoilla voi olla saman ajan aineistoa.",
                  })}>
                    <path d={path} fill="none" stroke="transparent" strokeWidth={8} />
                    <path d={path} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.24} />
                  </g>
                );
              })}
              {/* Theme streams flowing alongside the road */}
              {streams.map(({ c, side, lane }) => {
                const a = x(c.start), b = x(c.end!), dy = side * (70 + lane * 9);
                const r = routeOf(c.start), on = hover === c.id;
                return (
                  <g key={c.id} {...pickable({ kind: "chain", route: r, title: c.title, years: yrs(c.start, c.end), body: c.learning, note: `Kulkee pääreittien ${c.routes.map((n) => ROMAN[n]).join(", ")} läpi.` })}
                    onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover(null)}>
                    <path d={segPath(a, b, dy)} fill="none" stroke="transparent" strokeWidth={8} />
                    <path d={segPath(a, b, dy)} fill="none" stroke={col(r, 0.78, 0.11)} strokeWidth={on ? 2.6 : 1.1} opacity={on ? 1 : 0.32} strokeLinecap="round" />
                    <circle cx={b} cy={roadY(b, CY) + dy} r={on ? 2.7 : 1.6} fill={col(r)} opacity={on ? 1 : 0.58} />
                    {on && <text x={a} y={roadY(a, CY) + dy - 8} fontSize={15} fill={col(r)} className="rm-label">{c.title}</text>}
                  </g>
                );
              })}

              {/* The road */}
              <path d={road} fill="none" stroke="url(#rm-road)" strokeWidth={34} opacity={0.35} filter="url(#rm-glow)" />
              <path d={segPath(X0 - 200, x(2026))} fill="none" stroke="url(#rm-road)" strokeWidth={7} strokeLinecap="round" />
              <path d={segPath(X0 - 200, x(2026))} fill="none" stroke="oklch(.98 .02 230)" strokeWidth={1.4} strokeDasharray="2 18" className="rm-flow" opacity={0.8} />

              {/* Future fan: alternative paths after 2026 */}
              {[-2, -1, 0, 1, 2].map((k) => {
                const a = x(2026), b = X1 + 240, ya = roadY(a, CY);
                const d = `M${a},${ya} C${a + 160},${ya} ${b - 220},${ya + k * 120} ${b},${ya + k * 150}`;
                return <g key={k}><path d={d} fill="none" stroke={col(5)} strokeWidth={k === 0 ? 4 : 2} opacity={k === 0 ? 0.7 : 0.4} strokeDasharray="10 9" className="rm-flow" /></g>;
              })}
              <rect x={X1 - 120} y={-300} width={600} height={1600} fill="url(#rm-fog)" pointerEvents="none" />
              <text x={X1 - 40} y={roadY(X1, CY) - 210} fontSize={16} fill={col(5)} textAnchor="end" opacity={0.75} fontStyle="italic">vaihtoehtoiset tulevaisuudet</text>

              {/* Intersections: arches spanning the eras a phenomenon crosses */}
              {data.intersections.map((it, i) => {
                const a = x(it.start), b = x(it.end ?? it.start), ya = roadY(a, CY), yb = roadY(b, CY);
                const h = 150 + (i % 4) * 46;
                const on = hover === it.id;
                return (
                  <g key={it.id} {...pickable({ kind: "cross", route: it.routes[0], title: it.title, years: yrs(it.start, it.end), note: `Leikkaa pääreitit ${it.routes.map((n) => ROMAN[n]).join(" → ")}.` })}
                    onPointerEnter={() => setHover(it.id)} onPointerLeave={() => setHover(null)}>
                    <path d={`M${a},${ya} Q${(a + b) / 2},${Math.min(ya, yb) + h * 2.1} ${b},${yb}`} fill="none" stroke="transparent" strokeWidth={10} />
                    <path d={`M${a},${ya} Q${(a + b) / 2},${Math.min(ya, yb) + h * 2.1} ${b},${yb}`} fill="none" stroke="oklch(.92 .06 90)" strokeWidth={on ? 2.6 : 1.4} opacity={on ? 0.95 : 0.45} strokeDasharray="1 6" strokeLinecap="round" />
                    {on && <text x={(a + b) / 2} y={Math.min(ya, yb) + h * 1.08 + 18} textAnchor="middle" fontSize={15} fill="oklch(.92 .06 90)" className="rm-label">{it.title.split(":")[0]}</text>}
                  </g>
                );
              })}

              {/* Turning-point gates */}
              {data.boundaries.map((b) => {
                const gx = x(b.year), gy = roadY(gx, CY);
                return (
                  <g key={b.year} {...pickable({ kind: "boundary", route: b.to, title: b.title, years: String(b.year), body: `Siirtymä reitiltä ${ROMAN[b.from]} reitille ${ROMAN[b.to]}.` })}>
                    <ellipse cx={gx} cy={gy} rx={70} ry={190} fill="url(#rm-gate)" />
                    <ellipse cx={gx} cy={gy} rx={26} ry={120} fill="none" stroke={col(b.to, 0.9, 0.08)} strokeWidth={2} opacity={0.85} />
                    <ellipse cx={gx} cy={gy} rx={26} ry={120} fill="none" stroke={col(b.to)} strokeWidth={6} opacity={0.35} filter="url(#rm-soft)" className="rm-pulse" />
                    <text x={gx} y={gy - 140} textAnchor="middle" fontSize={34} fontWeight={700} fill="oklch(.97 .02 230)" className="rm-label">{b.year}</text>
                    <text x={gx} y={gy + 158} textAnchor="middle" fontSize={14} fill="currentColor" opacity={0.75} className="rm-label">{b.title.length > 42 ? b.title.slice(0, 40) + "…" : b.title}</text>
                  </g>
                );
              })}

              {/* Stations */}
              {data.stages.filter((s) => !(s.route === 1 && s.start === 1809)).map((s, i) => {
                const sx = x(s.start + (s.route === 2 && s.title.startsWith("Marras") ? 0.6 : 0)) + (s.start === 1809 || s.start === 1917 ? 34 : 0) + (s.title.startsWith("Marras") ? 26 : 0);
                const sy = roadY(sx, CY), up = i % 2 === 0, ly = up ? sy - 40 - (i % 4 === 0 ? 34 : 0) : sy + 50 + (i % 4 === 1 ? 34 : 0);
                const label = s.title.replace(/^[^:]*\d{4}[^:]*:\s*/, "");
                return (
                  <g key={`${s.route}-${s.seq}`} {...pickable({ kind: "stage", route: s.route, title: s.title, years: yrs(s.start, s.end), body: s.situation })}>
                    <line x1={sx} y1={sy} x2={sx} y2={ly + (up ? 6 : -16)} stroke={col(s.route)} strokeWidth={1} opacity={0.5} />
                    <circle cx={sx} cy={sy} r={13} fill={col(s.route)} opacity={0.25} className="rm-pulse" style={{ animationDelay: `${(i % 6) * 0.4}s` }} />
                    <circle cx={sx} cy={sy} r={6} fill="oklch(.98 .02 230)" stroke={col(s.route)} strokeWidth={3} />
                    <text x={sx} y={ly - 16} textAnchor="middle" fontSize={12} fill={col(s.route)} opacity={0.85} className="rm-label">{yrs(s.start, s.end)}</text>
                    <text x={sx} y={ly} textAnchor="middle" fontSize={15} fill="oklch(.95 .015 230)" className="rm-label">{label.length > 34 ? label.slice(0, 32) + "…" : label}</text>
                  </g>
                );
              })}
            </>
          )}
        </g>
      </svg>
      <PickBridge root={svgRef} onPick={setPick} />
      <button className="rm-close" onClick={onClose} aria-label="Sulje tiekartta">←</button>
      <div className="rm-title">Tiekartta 1500–2050</div>
      {data && (
        <div className="rm-mini" aria-label="Siirry pääreitille">
          {data.routes.map((r) => (
            <button key={r.id} type="button" style={{ "--c": col(r.order) } as React.CSSProperties}
              data-on={W / 2 / zoom - clampedPan >= x(r.start) && W / 2 / zoom - clampedPan < x(r.end)}
              onClick={() => goRoute(r.order)}>{ROMAN[r.order]}</button>
          ))}
        </div>
      )}
      <p className="rm-hint">vedä = kulje ajassa · rulla = zoomaa · kosketa asemaa, porttia tai virtaa · himmeät virrat ovat teemaketjuja, himmein viiva yhdistää kaistan osat · kaaret ulottuvat aikakausien yli</p>
      <aside className="rm-panel" data-open={!!pick} style={{ "--c": col(pick?.route ?? 2) } as React.CSSProperties} aria-hidden={!pick}>
        {pick && (
          <>
            <button className="rm-x" onClick={() => setPick(null)} aria-label="Sulje">×</button>
            <div className="rm-k">{{ stage: "Reittivaihe", chain: "Teemaketju", boundary: "Käännekohta", route: "Pääreitti", cross: "Aikakausien yli", gap: "Kaistan väli" }[pick.kind]} · {pick.years}</div>
            <h2>{pick.title}</h2>
            {pick.body && pick.body !== pick.title && <p>{pick.body}</p>}
            {pick.note && <p className="rm-note">{pick.note}</p>}
            <p className="rm-note">Vain tietokantaan kirjatut reitit, vaiheet ja jäsenyydet; viivat eivät väitä syy-yhteyttä.</p>
          </>
        )}
      </aside>
    </div>
  );
}

/** Listens for delegated pick events and reads the payload stored on the picked node. */
function PickBridge({ root, onPick }: { root: React.RefObject<SVGSVGElement | null>; onPick: (p: Pick) => void }) {
  useEffect(() => {
    const el = root.current; if (!el) return;
    const h = (e: Event) => { const t = (e.target as Element).closest("[data-pick]") as any; if (t?.__rm) onPick(t.__rm); };
    el.addEventListener("rmpick", h); return () => el.removeEventListener("rmpick", h);
  });
  return null;
}
