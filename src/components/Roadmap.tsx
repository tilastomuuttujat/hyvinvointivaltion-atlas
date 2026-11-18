import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRoadmap } from "@/lib/atlas.static";
import { labelSlots, lanes, stageContext, roadY, routeOf, timeScale, wrapLabel, type Roadmap as RoadmapData, type RoadmapSnapshot, type Stage } from "@/lib/atlas.roadmap";

const W = 1600, H = 1000, CY = 520, X0 = 120, X1 = 5000;
const HUE: Record<number, number> = { 1: 55, 2: 200, 3: 150, 4: 300, 5: 25 };
const col = (r: number, l = 0.82, c = 0.13) => `oklch(${l} ${c} ${HUE[r]})`;
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const CSS = `
.rm-hud{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);max-width:min(92vw,980px);display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px;border-radius:999px;background:oklch(.1 .02 260/.55);backdrop-filter:blur(8px);border:1px solid color-mix(in oklch,var(--c) 45%,transparent);font-size:13px;color:oklch(.92 .02 230);white-space:nowrap;animation:rmHud .35s ease}
.rm-hud-now{overflow:hidden;text-overflow:ellipsis;min-width:0}.rm-hud-now b{color:var(--c);margin-right:6px}.rm-hud-now i{opacity:.65;font-style:normal}
.rm-hud button{background:none;border:0;color:var(--c);font:inherit;cursor:pointer;padding:2px 6px;max-width:22ch;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}.rm-hud .rm-hud-x{color:oklch(.8 .02 230);font-size:16px}
@media (max-width:700px){.rm-hud{flex-wrap:wrap;justify-content:space-between;border-radius:16px;white-space:normal;bottom:8px;width:94vw}.rm-hud-now{order:-1;flex-basis:calc(100% - 30px);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}.rm-hud-x{order:-1}}
@keyframes rmHud{from{opacity:0;transform:translate(-50%,8px)}}

.rm{position:fixed;inset:0;z-index:60;background:radial-gradient(ellipse at 50% 55%,oklch(.17 .045 265),oklch(.07 .02 260) 75%);color:oklch(.93 .015 230);overflow:hidden;touch-action:none;user-select:none}
.rm svg{width:100%;height:100%;display:block;cursor:grab}.rm svg:active{cursor:grabbing}
.rm-label{paint-order:stroke;stroke:oklch(.08 .02 260 / .92);stroke-width:5px;stroke-linejoin:round}
.rm-flow{animation:rm-flow 2.4s linear infinite}@keyframes rm-flow{to{stroke-dashoffset:-40}}
.rm-pulse{animation:rm-pulse 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}@keyframes rm-pulse{50%{opacity:.35;transform:scale(1.35)}}
.rm-twinkle{animation:rm-tw 4s ease-in-out infinite}@keyframes rm-tw{50%{opacity:.15}}
.rm-hit{cursor:pointer}
.rm-cap{position:absolute;width:min(330px,calc(100vw - 24px));max-height:min(62vh,520px);overflow:auto;touch-action:pan-y;background:oklch(.13 .035 260 / .9);backdrop-filter:blur(8px);border:1px solid color-mix(in oklch,var(--c) 55%,transparent);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.45;box-shadow:0 12px 34px oklch(0 0 0 / .55),0 0 24px color-mix(in oklch,var(--c) 22%,transparent);animation:rm-cap .28s cubic-bezier(.2,.8,.2,1);user-select:text}
@keyframes rm-cap{from{opacity:0;transform:scale(.94)}}
.rm-cap h2{font-size:15px;line-height:1.25;margin:3px 22px 6px 0}.rm-cap p{margin:3px 0}
.rm-cap dl{margin:6px 0 0;display:grid;gap:7px}.rm-cap dt{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--c);opacity:.9}.rm-cap dd{margin:1px 0 0}
.rm-cap dd b{font-weight:600}.rm-cap-yr{opacity:.6;font-size:11.5px}
.rm-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}.rm-chips span{border:1px solid var(--lc);color:var(--lc);border-radius:999px;padding:1px 7px;font-size:11px;box-shadow:0 0 8px color-mix(in oklch,var(--lc) 35%,transparent)}
.rm-cap .rm-x{position:absolute;top:6px;right:8px}
.rm svg.rm-lead{position:absolute;inset:0;pointer-events:none;cursor:default}
.rm-lead line{stroke:var(--c);stroke-width:1.2;opacity:.85}.rm-lead circle{fill:var(--c)}
@media (prefers-reduced-motion:reduce){.rm-cap{animation:none}}
@media (max-width:620px){.rm-cap{max-height:calc(45vh - 50px);font-size:12.5px;padding:10px 12px}.rm-cap h2{font-size:14px}}
.rm-story{position:absolute;inset:0;pointer-events:none}
.rm svg.rm-leaders{position:absolute;inset:0;pointer-events:none;cursor:default}
.rm-leaders line{stroke:oklch(.82 .12 150);stroke-width:1.4;stroke-dasharray:4 4;opacity:.8}
.rm-leaders circle{fill:oklch(.9 .12 150)}
.rm-story-content{position:absolute;inset:60px 4% auto;max-width:1060px;margin:auto;pointer-events:none;font-size:14px}
.rm-story-content header{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-bottom:8px}
.rm-story-content header h2{font-size:18px;text-shadow:0 1px 5px black}
.rm-story-content ol{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:start;gap:12px;margin:0;padding:0;list-style:none}
.rm-story-content li{background:oklch(.15 .035 260 / .97);box-shadow:0 10px 30px oklch(0 0 0 / .5);line-height:1.45;border:1px solid oklch(.62 .10 150);border-radius:8px;padding:10px;pointer-events:auto}
.rm-story-content h3{font-size:15px;font-weight:650;margin:3px 0}
.rm-story-content p{margin:5px 0}
.rm-story-year{color:oklch(.84 .12 150);font-size:12px}
.rm-story-content button{pointer-events:auto;cursor:pointer;border:1px solid oklch(.56 .09 150);border-radius:6px;background:oklch(.15 .035 260);padding:5px 8px;color:inherit}
.rm-story-basis{max-height:24vh;overflow:auto;touch-action:pan-y;border-top:1px solid oklch(.5 .07 150);margin-top:6px}
.rm-story-basis a{text-decoration:underline}
@media(max-width:620px){.rm-story-content{inset:55px 0 auto;font-size:13px}.rm-story-content header{padding:0 12px}.rm-story-content header h2{font-size:15px}.rm-story-content ol{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:10px;padding:0 12px 6px;pointer-events:auto;touch-action:pan-x}.rm-story-content li{flex:0 0 82%;scroll-snap-align:center;padding:10px}.rm-story-content h3{font-size:14px}.rm-story-content button{padding:6px 9px;font-size:12px}.rm-story-content li p{max-height:30vh;overflow:auto}}

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
          id: s.state_id, route: s.route_order, seq: s.sequence_no, title: s.title,
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

type Pick = { cx?: number; cy?: number; kind: "stage" | "chain" | "boundary" | "route" | "cross" | "gap"; route: number; title: string; years: string; body?: string; note?: string; stage?: Stage };
const yrs = (a: number, b?: number) => (b && b !== a ? `${a}–${b}` : String(a));

/** Full-screen roadmap: one luminous road 1500→2050 through five main routes, gates at turning points, theme streams alongside. */
export function Roadmap({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [failed, setFailed] = useState(false);
  const [pan, setPan] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const [pick, setPick] = useState<Pick | null>(null);
  const [snapshot, setSnapshot] = useState<RoadmapSnapshot>();
  const [hover, setHover] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; pan: number; moved: boolean } | null>(null);
  const target = useRef<number | null>(null);
  const lastClick = useRef<{ x: number; y: number } | null>(null);
  const activeStage = pick?.stage ?? null;

  useEffect(() => { load().then(setData, () => setFailed(true)); }, []);
  useEffect(() => {
    if (!activeStage) return;
    let active = true;
    getRoadmap().then((value) => { if (active) setSnapshot(value); }).catch(() => {});
    return () => { active = false; };
  }, [activeStage]);
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
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const dx = toSvgX(e.clientX - d.x) / zoom; if (Math.abs(dx) > 4 && !d.moved) { d.moved = true; setPick(null); } setPan(d.pan + dx); };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (d && !d.moved) { lastClick.current = { x: e.clientX, y: e.clientY }; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-pick]") as HTMLElement | null; el?.dispatchEvent(new CustomEvent("rmpick", { bubbles: true })); }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (pick) setPick(null);
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { setPan((p) => p - e.deltaX / zoom); return; }
    setZoom((z) => Math.max(0.35, Math.min(2.4, z * Math.exp(-e.deltaY * 0.0015))));
  };
  const goRoute = (r: number) => { if (!data) return; const rt = data.routes[r - 1]; const mid = (x(rt.start) + x(rt.end)) / 2; target.current = W / 2 / zoom - mid; };
  const clampedPan = Math.max(W / zoom - X1 - 400, Math.min(400, pan));
  const tx = clampedPan * zoom, scale = zoom, ty = (H - H * zoom) / 2 + (CY - CY) * 0;
  const stationX = (s: Stage) => x(s.start + (s.route === 2 && s.title.startsWith("Marras") ? 0.6 : 0))
    + (s.start === 1809 || s.start === 1917 ? 34 : 0) + (s.title.startsWith("Marras") ? 26 : 0);
  const stageRoute = data?.routes.find((r) => r.order === activeStage?.route);
  const chainIds = new Set(snapshot?.links?.filter((link) =>
    link.parent_phenomenon_id === stageRoute?.id && link.parent_state_id === activeStage?.id
  ).map((link) => link.chain_id));
  const ctx = activeStage && data ? stageContext(data, activeStage, chainIds) : null;
  const lit = new Set<string>(ctx ? ctx.lanes.slice(0, 6).map((c) => c.id) : []);
  const selectPick = (p: Pick) => {
    const c = lastClick.current; lastClick.current = null;
    setPick({ ...p, cx: p.cx ?? c?.x, cy: p.cy ?? c?.y });
    if (p.kind === "chain") { const hit = streams.find(({ c: s }) => s.title === p.title); if (hit) setHover(null); }
  };
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
              {(() => {
                const shown: { side: number; lane: number; a: number }[] = [];
                const named = new Set(streams.filter(({ c, side, lane }) => {
                  const a = x(c.start);
                  if (shown.some((o) => o.side === side && Math.abs(o.lane - lane) <= 1 && Math.abs(o.a - a) < 220)) return false;
                  shown.push({ side, lane, a }); return true;
                }).map(({ c }) => c.id));
                return streams.map(({ c, side, lane }) => {
                const a = x(c.start), b = x(c.end!), dy = side * (70 + lane * 9);
                const r = routeOf(c.start), on = hover === c.id || (!activeStage && lit.has(c.id)) || (pick?.kind === "chain" && pick.title === c.title);
                return (
                  <g key={c.id} {...pickable({ kind: "chain", route: r, title: c.title, years: yrs(c.start, c.end), body: c.learning, note: `Kulkee pääreittien ${c.routes.map((n) => ROMAN[n]).join(", ")} läpi.` })}
                    onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover(null)}>
                    <path d={segPath(a, b, dy)} fill="none" stroke="transparent" strokeWidth={8} />
                    <path d={segPath(a, b, dy)} fill="none" stroke={col(r, 0.78, 0.11)} strokeWidth={on ? 2.6 : 1.1} opacity={on ? 1 : 0.32} strokeLinecap="round" />
                    <circle cx={b} cy={roadY(b, CY) + dy} r={on ? 2.7 : 1.6} fill={col(r)} opacity={on ? 1 : 0.58} />
                    {on && <text x={a} y={roadY(a, CY) + dy + (side < 0 ? -10 : 20)} fontSize={16} fontWeight={600} fill={col(r, 0.86, 0.12)} className="rm-label">{c.title}</text>}
                    {!on && zoom >= 1.4 && named.has(c.id) && <text x={a + 4} y={roadY(a, CY) + dy - 3} fontSize={9} fill={col(r, 0.8, 0.08)} opacity={0.55} className="rm-label">{c.title.split(":")[0]}</text>}
                  </g>
                );
                });
              })()}

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
              {(() => {
                const st = data.stages.filter((s) => !(s.route === 1 && s.start === 1809)).sort((a, b) => stationX(a) - stationX(b));
                const lines = st.map((s) => wrapLabel(s.title.replace(/^[^:]*\d{4}[^:]*:\s*/, "")));
                const slots = labelSlots(st.map((s, i) => ({ x: stationX(s), w: Math.max(...lines[i].map((l) => l.length)) * 7.6 + 8 })));
                return st.map((s, i) => {
                const sx = stationX(s);
                const { side, tier } = slots[i], up = side < 0;
                const sy = roadY(sx, CY), ly = up ? sy - 44 - tier * 58 - (lines[i].length - 1) * 17 : sy + 56 + tier * 58;
                return (
                  <g key={`${s.route}-${s.seq}`} {...pickable({ kind: "stage", route: s.route, title: s.title, stage: s, years: yrs(s.start, s.end), body: s.situation })}
                    role="button" tabIndex={0} aria-label={s.title}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      const rc = (event.currentTarget as Element).getBoundingClientRect();
                      selectPick({ cx: rc.left + rc.width / 2, cy: rc.top + rc.height / 2, kind: "stage", route: s.route, title: s.title, years: yrs(s.start, s.end), stage: s });
                    }}>
                    <line x1={sx} y1={sy} x2={sx} y2={up ? ly + 6 + (lines[i].length - 1) * 17 : ly - 30} stroke={col(s.route)} strokeWidth={1} opacity={0.5} />
                    <circle cx={sx} cy={sy} r={13} fill={col(s.route)} opacity={0.25} className="rm-pulse" style={{ animationDelay: `${(i % 6) * 0.4}s` }} />
                    <circle cx={sx} cy={sy} r={6} fill="oklch(.98 .02 230)" stroke={col(s.route)} strokeWidth={3} />
                    <text x={sx} y={ly - 16} textAnchor="middle" fontSize={12} fill={col(s.route)} opacity={0.85} className="rm-label">{yrs(s.start, s.end)}</text>
                    <text x={sx} y={ly} textAnchor="middle" fontSize={15} fill="oklch(.95 .015 230)" className="rm-label">
                      {lines[i].map((l, k) => <tspan key={k} x={sx} dy={k ? 17 : 0}>{l}</tspan>)}
                    </text>
                  </g>
                );
                });
              })()}
            </>
          )}
          {data && activeStage && ctx && (() => {
            const sx = stationX(activeStage), sy = roadY(sx, CY), c = col(activeStage.route);
            const arc = (a: number, b: number, up: number) => { const ya = roadY(a, CY), yb = roadY(b, CY); return `M${a},${ya} Q${(a + b) / 2},${Math.min(ya, yb) - up} ${b},${yb}`; };
            const bx = ctx.before ? stationX(ctx.before) : null, ax = ctx.after ? stationX(ctx.after) : null;
            const lanes = streams.filter(({ c: l }) => lit.has(l.id));
            return (
              <g className="rm-focus" pointerEvents="none">
                <rect x={-4000} y={-1000} width={X1 + 8000} height={3000} fill="oklch(.07 .02 260)" opacity={0.62} />
                {lanes.map(({ c: l, side, lane }, li) => {
                  const a = x(l.start), b = x(l.end!), dy = side * (70 + lane * 9), id = `rmf-${l.id}`;
                  const lasting = ctx.lasting.some((t) => t.id === l.id);
                  return (
                    <g key={l.id}>
                      <path id={id} d={segPath(a, b, dy)} fill="none" stroke={col(routeOf(l.start), 0.8, 0.12)} strokeWidth={2.8} strokeLinecap="round" />
                      <path d={segPath(a, b, dy)} fill="none" stroke="oklch(.98 .02 230)" strokeWidth={1.2} strokeDasharray="2 14" className="rm-flow" />
                      <text fontSize={13} fill={col(routeOf(l.start), 0.9, 0.1)} className="rm-label" dy={side < 0 ? -6 : 14}>
                        <textPath href={`#${id}`} startOffset={`${4 + (li % 4) * 18}%`}>{l.title.split(":")[0]}{lasting ? ` — kantaa vuoteen ${l.end}` : ""}</textPath>
                      </text>
                    </g>
                  );
                })}
                {bx != null && <g>
                  <path id="rmf-before" d={arc(bx, sx, 160)} fill="none" stroke={c} strokeWidth={2} strokeDasharray="3 7" className="rm-flow" opacity={0.9} />
                  <text fontSize={14} fill="oklch(.92 .03 230)" className="rm-label" dy={-8}><textPath href="#rmf-before" startOffset="50%" textAnchor="middle">synnytti ›</textPath></text>
                </g>}
                {ax != null && <g>
                  <path id="rmf-after" d={arc(sx, ax, 160)} fill="none" stroke={c} strokeWidth={2.4} className="rm-flow" strokeDasharray="10 6" />
                  <text fontSize={14} fill="oklch(.95 .03 230)" className="rm-label" dy={-8}><textPath href="#rmf-after" startOffset="50%" textAnchor="middle">johti ›</textPath></text>
                </g>}
                {[ctx.before, ctx.after].map((t) => t && (
                  <g key={t.seq + "-" + t.start}>
                    <circle cx={stationX(t)} cy={roadY(stationX(t), CY)} r={7} fill="oklch(.98 .02 230)" stroke={col(t.route)} strokeWidth={3} />
                    <text x={stationX(t)} y={roadY(stationX(t), CY) + 30} textAnchor="middle" fontSize={14} fill="oklch(.9 .02 230)" className="rm-label">{wrapLabel(tail(t.title))[0]}</text>
                  </g>
                ))}
                <circle cx={sx} cy={sy} r={34} fill={c} opacity={0.3} filter="url(#rm-glow)" className="rm-pulse" />
                <circle cx={sx} cy={sy} r={8} fill="oklch(.99 .02 230)" stroke={c} strokeWidth={3} />
                {ctx.era && <text x={sx} y={sy - 70} textAnchor="middle" fontSize={12} letterSpacing=".18em" fill={c} opacity={0.85} className="rm-label">{ROMAN[ctx.era.order]} · {ctx.era.title.replace(/^Pää(ketju|reitti) [IVX]+: /, "").toUpperCase()}</text>}
                <text x={sx} y={sy - 46} textAnchor="middle" fontSize={20} fontWeight={600} fill="oklch(.98 .02 230)" className="rm-label">{wrapLabel(tail(activeStage.title), 34)[0]}</text>
                {ctx.gate && <text x={x(ctx.gate.year)} y={roadY(x(ctx.gate.year), CY) + 200} textAnchor="middle" fontSize={12} fill="oklch(.9 .04 230)" opacity={0.8} className="rm-label" fontStyle="italic">avasi tien</text>}
              </g>
            );
          })()}
        </g>
      </svg>
      <PickBridge root={svgRef} onPick={selectPick} />
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
      {!pick && <p className="rm-hint">vedä = kulje ajassa · rulla = zoomaa · kosketa asemaa, porttia tai virtaa · himmeät virrat ovat teemaketjuja, himmein viiva yhdistää kaistan osat · kaaret ulottuvat aikakausien yli</p>}
      {pick && (
        <div className="rm-hud" role="status" style={{ "--c": col(pick.route) } as React.CSSProperties}
          onPointerDown={(e) => e.stopPropagation()}>
          {activeStage && ctx ? <>
            {ctx.before && <button type="button" onClick={() => { target.current = W / 2 / zoom - stationX(ctx.before!); selectPick({ kind: "stage", route: ctx.before!.route, title: ctx.before!.title, stage: ctx.before!, years: yrs(ctx.before!.start, ctx.before!.end) }); }}>‹ {tail(ctx.before.title)}</button>}
            <span className="rm-hud-now"><b>{pick.years}</b> {tail(activeStage.title)}{activeStage.situation && activeStage.situation !== activeStage.title ? <i> — {activeStage.situation}</i> : null}</span>
            {ctx.after && <button type="button" onClick={() => { target.current = W / 2 / zoom - stationX(ctx.after!); selectPick({ kind: "stage", route: ctx.after!.route, title: ctx.after!.title, stage: ctx.after!, years: yrs(ctx.after!.start, ctx.after!.end) }); }}>{tail(ctx.after.title)} ›</button>}
          </> : <span className="rm-hud-now"><b>{pick.years}</b> {pick.title}{pick.body && pick.body !== pick.title ? <i> — {pick.body}</i> : null}</span>}
          <button type="button" className="rm-hud-x" onClick={() => setPick(null)} aria-label="Sulje">×</button>
        </div>
      )}
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

const KIND = { stage: "Etappi", chain: "Teemakaista", boundary: "Käännekohta", route: "Pääreitti", cross: "Aikakausien yli", gap: "Kaistan väli" } as const;
const tail = (t: string) => t.replace(/^[^:]*\d{4}[^:]*:\s*/, "");

