import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { rotate, perspective, spherePositions, type V3 } from "@/lib/teema.camera";
import { anatomy, chainIndex, chainOrder, yearAngle, type ChainBundle, type ChainPhenomenon } from "@/lib/atlas.chain";

const W = 1600, H = 1000, CX = W / 2, CY = H / 2, R = 370;
const HUES = [200, 145, 95, 60, 25, 335, 295, 250, 180, 115, 315, 45];
const hue = (i: number) => `oklch(.83 .12 ${HUES[i % HUES.length]})`;
const CSS = `
.rc{position:fixed;inset:0;z-index:60;background:radial-gradient(ellipse at center,oklch(.17 .04 265),oklch(.08 .02 260) 70%);color:oklch(.93 .015 230);font-family:inherit;overflow:hidden;touch-action:none}
.rc svg{width:100%;height:100%;display:block}
.rc-label{paint-order:stroke;stroke:oklch(.09 .02 260);stroke-width:3px;stroke-linejoin:round;pointer-events:none}
.rc-hit{cursor:pointer}
.rc-path{animation:rc-flow 3s linear infinite}
@keyframes rc-flow{to{stroke-dashoffset:-30}}
.rc-close{position:absolute;top:14px;left:14px;background:transparent;border:1px solid oklch(.45 .03 230 / .5);color:inherit;border-radius:999px;width:38px;height:38px;font-size:18px;cursor:pointer;opacity:.7}
.rc-title{position:absolute;top:20px;left:64px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;pointer-events:none}
.rc-hint{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-size:12px;opacity:.55;pointer-events:none;text-align:center;max-width:90vw}
.rc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,92vw);background:oklch(.12 .03 260 / .94);border-left:1px solid oklch(.45 .03 230 / .4);padding:22px 22px 30px;overflow:auto;transform:translateX(102%);transition:transform .45s cubic-bezier(.2,.8,.2,1);backdrop-filter:blur(6px);font-size:14px;line-height:1.5}
.rc-panel[data-open=true]{transform:none}
.rc-panel h2{font-size:19px;margin:6px 0 4px;line-height:1.25}
.rc-panel h3{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin:16px 0 6px}
.rc-panel p{margin:4px 0}
.rc-panel .rc-x{float:right;background:transparent;border:0;color:inherit;font-size:20px;cursor:pointer;opacity:.7}
.rc-badge{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;border:1px solid currentColor;opacity:.75;margin-right:6px}
.rc-step{position:relative;border-left:2px solid var(--c);padding:2px 0 10px 14px;margin-left:4px}
.rc-step::before{content:"";position:absolute;left:-6px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--c)}
.rc-step b{font-weight:600}
.rc-k{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.08em;margin-top:6px}
.rc-good{color:oklch(.85 .12 150)}.rc-open{color:oklch(.82 .12 50)}
.rc-chip{display:inline-block;margin:3px 4px 0 0;padding:3px 8px;border-radius:999px;border:1px solid oklch(.45 .03 230 / .6);background:transparent;color:inherit;font-size:12px;cursor:pointer}
.rc-rolo{position:absolute;right:3vw;top:50%;transform:translateY(-50%);width:min(430px,92vw);height:min(560px,80vh);perspective:1100px;outline:none;touch-action:none;animation:rc-in .5s cubic-bezier(.2,.8,.2,1)}
@keyframes rc-in{from{opacity:0;transform:translateY(-50%) rotateX(-40deg)}}
.rc-drum{position:absolute;inset:70px 0 80px;transform-style:preserve-3d}
.rc-card{position:absolute;inset:0;box-sizing:border-box;padding:18px 20px;border-radius:14px;background:linear-gradient(160deg,oklch(.19 .04 260),oklch(.11 .03 260));border:1px solid color-mix(in oklch,var(--c) 55%,transparent);box-shadow:0 0 30px color-mix(in oklch,var(--c) 22%,transparent),0 20px 40px oklch(0 0 0 / .5);overflow:auto;font-size:14px;line-height:1.5;transition:transform .6s cubic-bezier(.2,.8,.2,1),opacity .6s,filter .6s;backface-visibility:hidden;cursor:default}
.rc-card h2{font-size:19px;margin:6px 0;line-height:1.25}.rc-card p{margin:4px 0}.rc-q{opacity:.8}
.rc-head{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--c);margin-bottom:6px}
.rc-rolo .rc-x{position:absolute;top:0;right:0;background:transparent;border:0;color:inherit;font-size:22px;cursor:pointer;opacity:.75}
.rc-nav{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:14px;font-size:12px;opacity:.85}
.rc-nav button{background:transparent;border:1px solid color-mix(in oklch,var(--c) 60%,transparent);color:inherit;border-radius:999px;width:34px;height:34px;cursor:pointer}.rc-nav button:disabled{opacity:.3}
@media (max-width:700px){.rc-rolo{right:4vw;left:4vw;width:auto;top:auto;bottom:10px;transform:none;height:62vh}@keyframes rc-in{from{opacity:0;transform:rotateX(-40deg)}}}
@media (prefers-reduced-motion:reduce){.rc-card,.rc-rolo{transition:none;animation:none}}
@media (prefers-reduced-motion:reduce){.rc-path{animation:none}.rc-panel{transition:none}}
`;

function polar(year: number, rot: number, r = R) {
  const a = ((yearAngle(year) + rot) * Math.PI) / 180;
  return { x: CX + Math.sin(a) * r, y: CY - Math.cos(a) * r, a };
}

let cache: Promise<ChainBundle> | null = null;
function load() {
  cache ??= fetch(new URL("data/reasoning-chain.json", document.baseURI).href).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).catch((e) => { cache = null; throw e; });
  return cache;
}

/** Full-screen chain view: main chains orbit in the centre, their recorded members sit on a clock ring by year. */
export function ReasoningChain({ onClose }: { onClose: () => void }) {
  const [bundle, setBundle] = useState<ChainBundle | null>(null);
  const [failed, setFailed] = useState(false);
  const [chain, setChain] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [spin, setSpin] = useState(0);
  const [pitch, setPitch] = useState(-0.25);
  const [card, setCard] = useState(0);
  const roloDrag = useRef<{ y: number; card: number } | null>(null);
  const [rot, setRot] = useState(0);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const f = () => setNarrow(window.innerWidth < window.innerHeight * 0.9); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const idle = useRef(performance.now());
  const drag = useRef<{ x: number; y: number; spin: number; pitch: number; pan?: { x: number; y: number } } | null>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const viewRef = useRef(view); viewRef.current = view;
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; m: { x: number; y: number }; v: { z: number; x: number; y: number } } | null>(null);
  const toSvg = (cx: number, cy: number) => { const m = svgRef.current?.getScreenCTM(); if (!m) return { x: cx, y: cy }; const q = new DOMPoint(cx, cy).matrixTransform(m.inverse()); return { x: q.x, y: q.y }; };
  const zoomAt = (v: { z: number; x: number; y: number }, next: number, at: { x: number; y: number }) => { const z = Math.min(6, Math.max(0.6, next)), k = z / v.z; return { z, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k }; };
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); idle.current = performance.now(); const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1); setView((v) => zoomAt(v, v.z * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), toSvg(e.clientX, e.clientY))); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => { load().then(setBundle, () => setFailed(true)); }, []);
  useEffect(() => { setCard(0); }, [focus]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (focus) setFocus(null); else onClose(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [focus, onClose]);

  const idx = useMemo(() => (bundle ? chainIndex(bundle) : null), [bundle]);
  const ordered = useMemo(() => (bundle && chain ? chainOrder(bundle, chain) : []), [bundle, chain]);
  const lit = useMemo(() => {
    const s = new Set(ordered.map((p) => p.id));
    if (focus) s.add(focus);
    return s;
  }, [ordered, focus]);
  const litParents = useMemo(() => new Set((focus && idx?.parents.get(focus)?.map((m) => m.parent)) || []), [focus, idx]);

  // 3D cloud: chains on a sphere, members clustered around their first chain.
  const cloud = useMemo(() => {
    if (!idx || !bundle) return null;
    const pos = new Map<string, V3>();
    spherePositions(idx.roots.length, 330).forEach((v, i) => pos.set(idx.roots[i].id, v));
    let h = 7;
    const rnd = () => ((h = (h * 16807) % 2147483647) / 2147483647) - 0.5;
    for (const p of bundle.phenomena) {
      if (pos.has(p.id) || !Number.isFinite(p.start)) continue;
      const parent = idx.parents.get(p.id)?.[0]?.parent;
      const base = parent ? pos.get(parent) : undefined;
      const f = base ? 1.05 + rnd() * 0.5 : 0.35 + Math.abs(rnd());
      const b = base ?? { x: rnd() * 600, y: rnd() * 500, z: rnd() * 600 };
      pos.set(p.id, { x: b.x * f + rnd() * 120, y: b.y * f + rnd() * 110, z: b.z * f + rnd() * 120 });
    }
    return pos;
  }, [idx, bundle]);

  // Ring eases the lit era to the top; centre orbit turns on its own while idle.
  const target = useMemo(() => {
    const ys = ordered.length ? ordered.map((p) => p.start).sort((a, z) => a - z) : focus && idx ? [idx.byId.get(focus)!.start] : null;
    return ys ? 90 - yearAngle(ys[Math.floor(ys.length / 2)]) : null;
  }, [ordered, focus, idx]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!drag.current && performance.now() - idle.current > 2500) setSpin((s) => s + 0.0012);
      setRot((r) => r + ((target ?? 0) - r) * 0.04);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (failed) return <div className="rc"><style>{CSS}</style><button className="rc-close" onClick={onClose} aria-label="Sulje">←</button><p className="rc-hint">Päättelyketjun aineistoa ei saatu ladattua.</p></div>;
  if (!bundle || !idx) return <div className="rc"><style>{CSS}</style><button className="rc-close" onClick={onClose} aria-label="Sulje">←</button><p className="rc-hint">Ladataan ketjuja…</p></div>;

  const roots = idx.roots;
  const rootColor = new Map(roots.map((r, i) => [r.id, hue(i)]));
  const colorOf = (id: string) => rootColor.get(chain ?? "") ?? rootColor.get(idx.parents.get(id)?.[0]?.parent ?? "") ?? "oklch(.8 .03 230)";
  const proj = (v: V3) => { const r = rotate(v, { yaw: spin, pitch }); const k = perspective(r.z) ; return { x: CX + r.x * k * (narrow ? 0.95 : 1.5), y: CY + r.y * k, z: r.z, k }; };
  const pts = new Map([...cloud!].map(([id, v]) => [id, proj(v)]));
  const centre = roots.map((r, i) => { const q = pts.get(r.id)!; return { r, i, x: q.x, y: q.y, z: -q.z / 330 }; });
  const centreById = new Map(centre.map((c) => [c.r.id, c]));
  // Members get a lane offset so dense eras stay readable.
  const lane = new Map<string, number>();
  [...bundle.phenomena].sort((a, z) => a.start - z.start).forEach((p, i) => lane.set(p.id, i % 3));
  const onRing = (p: ChainPhenomenon) => polar(p.start, rot, R + (lane.get(p.id) ?? 0) * 16);
  const focused = focus ? idx.byId.get(focus) : null;
  const detail = focus ? anatomy(bundle, focus) : null;
  const pathD = ordered.map((p, i) => { const q = onRing(p); return `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(" ");
  const chainC = chain ? rootColor.get(chain)! : "";
  const selectedCentre = chain ? centreById.get(chain) : null;

  return (
    <div className="rc" role="dialog" aria-label="Päättelyketju"
      onPointerDown={(e) => {
        idle.current = performance.now();
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2), v: viewRef.current };
          drag.current = null;
        } else if (pointers.current.size === 1) {
          drag.current = { x: e.clientX, y: e.clientY, spin, pitch, pan: e.shiftKey || e.button === 1 || e.button === 2 ? { x: view.x, y: view.y } : undefined };
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        idle.current = performance.now();
        if (pinch.current && pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          const P = pinch.current, m = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
          const z = Math.min(6, Math.max(0.6, P.v.z * Math.hypot(a.x - b.x, a.y - b.y) / P.d));
          const cx = (P.m.x - P.v.x) / P.v.z, cy = (P.m.y - P.v.y) / P.v.z;
          setView({ z, x: m.x - cx * z, y: m.y - cy * z });
          return;
        }
        const d = drag.current; if (!d) return;
        if (d.pan) { const p0 = toSvg(d.x, d.y), p1 = toSvg(e.clientX, e.clientY); setView((v) => ({ ...v, x: d.pan!.x + p1.x - p0.x, y: d.pan!.y + p1.y - p0.y })); return; }
        setSpin(d.spin + (e.clientX - d.x) * 0.006 / view.z); setPitch(Math.max(-1.2, Math.min(1.2, d.pitch + (e.clientY - d.y) * 0.005 / view.z)));
      }}
      onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; if (!pointers.current.size) drag.current = null; }}
      onPointerCancel={(e) => { pointers.current.delete(e.pointerId); pinch.current = null; drag.current = null; }}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={() => setView({ z: 1, x: 0, y: 0 })}>
      <style>{CSS}</style>
      <svg ref={svgRef} viewBox={narrow ? `${CX - R - 40} ${CY - R - 60} ${2 * R + 80} ${2 * R + 120}` : `0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="rc-glow"><stop offset="0" stopColor="oklch(.5 .1 250)" stopOpacity=".28" /><stop offset="1" stopColor="oklch(.5 .1 250)" stopOpacity="0" /></radialGradient>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
        <circle cx={CX} cy={CY} r={R + 80} fill="url(#rc-glow)" />
        {/* Clock ring */}
        <g opacity=".55">
          {Array.from({ length: (2050 - 1500) / 10 + 1 }, (_, i) => 1500 + i * 10).map((y) => {
            const major = y % 50 === 0, a = polar(y, rot, R - 14), b = polar(y, rot, R - (major ? 30 : 20));
            return <line key={y} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth={major ? 1.2 : 0.5} strokeDasharray={y > 2026 ? "2 3" : undefined} />;
          })}
          {[1500, 1600, 1700, 1809, 1900, 1950, 2000, 2026, 2050].map((y) => {
            const p = polar(y, rot, R - 48);
            return <text key={y} x={p.x} y={p.y} fontSize={13} textAnchor="middle" dominantBaseline="middle" fill="currentColor" opacity=".8">{y === 2026 ? "nyt" : y}</text>;
          })}
        </g>
        {/* Threads from chosen chain to its members */}
        {selectedCentre && ordered.map((p) => { const q = onRing(p); return <line key={"t" + p.id} x1={selectedCentre.x} y1={selectedCentre.y} x2={q.x} y2={q.y} stroke={chainC} strokeWidth={0.6} opacity={0.18} />; })}
        {/* Chronological light path through the chain */}
        {ordered.length > 1 && <path className="rc-path" d={pathD} fill="none" stroke={chainC} strokeWidth={2} strokeDasharray="10 5" opacity=".75" style={{ filter: `drop-shadow(0 0 4px ${chainC})` }} />}
        {/* Focused member → its chains */}
        {focused && [...litParents].map((pid) => { const c = centreById.get(pid); const q = onRing(focused); return c ? <line key={"f" + pid} x1={q.x} y1={q.y} x2={c.x} y2={c.y} stroke={rootColor.get(pid)} strokeWidth={0.9} opacity={0.4} strokeDasharray="3 4" /> : null; })}
        {/* Members on ring */}
        {bundle.phenomena.filter((p) => Number.isFinite(p.start)).map((p) => {
          const q = onRing(p), on = lit.has(p.id), isF = focus === p.id;
          const deg = (q.a * 180) / Math.PI;
          const ang = ((deg % 360) + 360) % 360, right = ang < 180;
          return (
            <g key={p.id} data-id={p.id} className="rc-hit" onClick={(e) => { e.stopPropagation(); setFocus(p.id); }} opacity={chain && !on ? 0.22 : 1}>
              <circle cx={q.x} cy={q.y} r={12} fill="transparent" />
              <circle cx={q.x} cy={q.y} r={isF ? 6 : on ? 4.2 : 2.2} fill={on ? colorOf(p.id) : "oklch(.75 .03 230)"} opacity={on ? 1 : 0.5} style={on ? { filter: `drop-shadow(0 0 5px ${colorOf(p.id)})` } : undefined} />
              {on && <text className="rc-label" fontSize={isF ? 15 : 12.5} fill={colorOf(p.id)} transform={`translate(${q.x} ${q.y}) rotate(${right ? ang - 90 : ang + 90}) translate(${right ? 12 : -12} 4)`} textAnchor={right ? "start" : "end"}>{p.start} · {p.title.length > 44 ? p.title.slice(0, 42) + "…" : p.title}</text>}
            </g>
          );
        })}
        {/* Member cloud: faint threads to their chain, depth-faded points */}
        {bundle.memberships.map((m, i) => {
          const a = pts.get(m.parent), b = pts.get(m.member);
          if (!a || !b) return null;
          const on = chain === m.parent || focus === m.member;
          return <line key={"m" + i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={rootColor.get(m.parent)} strokeWidth={on ? 0.9 : 0.4} opacity={on ? 0.55 : chain || focus ? 0.03 : 0.09} />;
        })}
        {[...pts].filter(([id]) => !rootColor.has(id)).sort((a, z) => z[1].z - a[1].z).map(([id, q]) => {
          const on = lit.has(id), front = Math.max(0.15, Math.min(1, 0.6 - q.z / 700));
          return <g key={"c" + id} className="rc-hit" onClick={(e) => { e.stopPropagation(); setFocus(id); }} opacity={chain && !on ? front * 0.25 : front}>
            <circle cx={q.x} cy={q.y} r={10} fill="transparent" />
            <circle cx={q.x} cy={q.y} r={(on ? 3.6 : 2) * q.k} fill={colorOf(id)} style={on ? { filter: `drop-shadow(0 0 4px ${colorOf(id)})` } : undefined} />
            {on && q.z < 100 && <text className="rc-label" x={q.x + 6} y={q.y + 4} fontSize={11 * q.k} fill={colorOf(id)}>{idx.byId.get(id)!.title.slice(0, 38)}</text>}
          </g>;
        })}
        {/* Main chains in centre, back to front */}
        {[...centre].sort((a, z) => a.z - z.z).map(({ r, i, x, y, z }) => {
          const sel = chain === r.id, rel = litParents.has(r.id), dim = (chain && !sel) || (focus && !rel && !sel);
          const s = 0.7 + (z + 1) * 0.3;
          return (
            <g key={r.id} className="rc-hit" opacity={dim ? 0.3 : 0.55 + (z + 1) * 0.22} onClick={(e) => { e.stopPropagation(); setChain(sel ? null : r.id); setFocus(null); }}>
              <circle cx={x} cy={y} r={22} fill="transparent" />
              <circle cx={x} cy={y} r={(sel || rel ? 9 : 5.5) * s} fill={hue(i)} style={{ filter: `drop-shadow(0 0 ${sel ? 10 : 4}px ${hue(i)})` }} />
              <text className="rc-label" x={x} y={y - 14 * s} fontSize={(sel ? 17 : 13) * s} textAnchor="middle" fill={hue(i)}>{r.title.replace(/^Pääketju [IVX]+:\s*/, "")}</text>
            </g>
          );
        })}
        </g>
      </svg>
      <button className="rc-close" onClick={onClose} aria-label="Sulje päättelyketju">←</button>
      <div className="rc-title">Päättelyketju</div>
      {(view.z !== 1 || view.x || view.y) ? <button className="rc-close" style={{ left: "auto", right: 14 }} onClick={() => setView({ z: 1, x: 0, y: 0 })} aria-label="Palauta näkymä">⟲</button> : null}
      <p className="rc-hint" hidden={!!focused}>
        {chain ? `${ordered.length} kirjattua ilmiötä aikajärjestyksessä · valopolku kulkee vanhimmasta uusimpaan · napauta ilmiötä nähdäksesi muutoksen anatomian`
          : "Napauta ketjua tai ilmiötä · vedä = kierrä · rulla tai nipistys = zoomaa · vaihto+veto tai kaksi sormea = siirrä · tuplaklikkaus palauttaa · kehä = aika 1500–2050 · yhteydet ovat kirjattua ketjujäsenyyttä, eivät vaikutusarvioita"}
      </p>
      {focused && detail && (() => {
        const c = colorOf(focused.id);
        const cards: { key: string; head: string; body: React.ReactNode }[] = [
          { key: "intro", head: `${focused.start}${focused.end ? `–${focused.end}` : ""} · ${focused.status === "accepted" ? "tarkistettu" : "tarkistusta odottava"}`, body: <><h2>{focused.title}</h2>{focused.question && <p className="rc-q">{focused.question}</p>}{(idx.parents.get(focused.id) ?? []).map((m) => <button key={m.parent} className="rc-chip" style={{ borderColor: rootColor.get(m.parent) }} onClick={() => setChain(m.parent)}>{idx.byId.get(m.parent)!.title.replace(/^Pääketju [IVX]+:\s*/, "")}</button>)}{!detail.transitions.length && <p className="rc-q">Muutoksen vaiheita ei ole vielä kirjattu.{focused.change ? ` ${focused.change}` : ""}</p>}</> },
          ...detail.transitions.map((t, i) => ({ key: t.id, head: `Vaihe ${i + 1}/${detail.transitions.length} · ${t.from ?? "?"} → ${t.to ?? "?"}`, body: <>
            {(t.situation || t.constraints) && <><div className="rc-k">Lähtötilanne</div><p>{t.situation}{t.constraints ? ` Rajoitteet: ${t.constraints}` : ""}</p></>}
            {(t.trigger || t.changed) && <><div className="rc-k">Laukaisija ja muutos</div><p>{t.trigger} {t.changed}</p></>}
            {t.improved && <><div className="rc-k">Vahvistui</div><p className="rc-good">{t.improved}</p></>}
            {(t.unresolved || t.remaining) && <><div className="rc-k">Jäi ratkaisematta</div><p className="rc-open">{t.unresolved} {t.remaining}</p></>}
          </> })),
          ...(focused.learning || detail.traces.length ? [{ key: "trace", head: "Oppi ja nykyajan heijaste", body: <>{focused.learning && <><div className="rc-k">Oppimiskohta</div><p>{focused.learning}</p></>}{detail.traces.map((t, i) => <p key={i}>{t}</p>)}</> }] : []),
        ];
        const cur = Math.min(card, cards.length - 1);
        const go = (d: number) => setCard(Math.max(0, Math.min(cards.length - 1, cur + d)));
        return (
          <div className="rc-rolo" style={{ ["--c" as string]: c }}
            onPointerDown={(e) => { e.stopPropagation(); roloDrag.current = { y: e.clientY, card: cur }; }}
            onPointerMove={(e) => { e.stopPropagation(); if (roloDrag.current) { const d = Math.round((roloDrag.current.y - e.clientY) / 70); setCard(Math.max(0, Math.min(cards.length - 1, roloDrag.current.card + d))); } }}
            onPointerUp={(e) => { e.stopPropagation(); roloDrag.current = null; }}
            onWheel={(e) => { e.stopPropagation(); if (Math.abs(e.deltaY) > 8) go(e.deltaY > 0 ? 1 : -1); }}
            onKeyDown={(e) => { if (e.key === "ArrowDown") go(1); if (e.key === "ArrowUp") go(-1); }} tabIndex={-1}>
            <button className="rc-x" onClick={() => setFocus(null)} aria-label="Sulje kortisto">×</button>
            <div className="rc-drum">
              {cards.map((k, i) => {
                const d = i - cur;
                return <article key={k.key} className="rc-card" aria-hidden={d !== 0} onClick={() => d && setCard(i)}
                  style={{ transform: `translateZ(-420px) rotateX(${-d * 38}deg) translateZ(${d ? 340 : 420}px)`, opacity: Math.abs(d) > 2 ? 0 : d ? 0.32 : 1, filter: d ? "blur(1.5px)" : undefined, zIndex: 10 - Math.abs(d), pointerEvents: Math.abs(d) > 2 ? "none" : "auto" }}>
                  <div className="rc-head">{k.head}</div>{k.body}
                </article>;
              })}
            </div>
            <div className="rc-nav"><button onClick={() => go(-1)} disabled={cur === 0} aria-label="Edellinen kortti">↑</button><span>{cur + 1} / {cards.length}</span><button onClick={() => go(1)} disabled={cur === cards.length - 1} aria-label="Seuraava kortti">↓</button></div>
          </div>
        );
      })()}
    </div>
  );
}
