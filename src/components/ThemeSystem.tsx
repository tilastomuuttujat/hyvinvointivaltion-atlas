import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Minus, Plus, Scan, X, ChevronRight, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATALOG, buildFlow, themeBridges } from "@/lib/teema.system";
import { STAR_OVERVIEW, zoomStarCamera, spherePositions, rotate, perspective, facingOrbit, type StarCamera, type Orbit } from "@/lib/teema.camera";
import "@/styles/teema-system.css";

const W = 2600, H = 2200, CX = W / 2, CY = H / 2;
const ink = (i: number) => `var(--constellation-${i % 8 + 1})`;
const stars = Array.from({ length: 210 }, (_, i) => ({ x: (i * 619 + 43) % W, y: (i * 421 + 87) % H, r: i % 9 === 0 ? 1.8 : 0.8 }));
const RADIUS = 1000;
const positions = spherePositions(CATALOG.themes.length, RADIUS);
const layouts = CATALOG.themes.map((theme, i) => {
  const base = positions[i]!;
  const flow = buildFlow(theme, 390, 235);
  const ordered = [...flow.nodes].sort((a, b) => a.rank - b.rank || a.y - b.y);
  const spread = ordered.map((n, j) => ({ ...n, x: 70 + (j % 4) * 150, y: 40 + Math.floor(j / 4) * 82 }));
  // Unconnected recorded concepts stay unconnected, rather than inventing edges.
  const nodes = flow.nodes.length ? spread : theme.concepts.map((c, j) => ({ key: c.t, label: c.t, rank: 0, x: 50 + (j % 3) * 145, y: 65 + Math.floor(j / 3) * 65 }));
  return { base, nodes, edges: flow.edges };
});

type Detail = { kind: "mechanism" | "path" | "concept" | "conclusion" | "insight"; index: number; label?: string };
export function ThemeSystem() {
  const bridges = useMemo(() => themeBridges(CATALOG.themes), []);
  const [camera, setCamera] = useState<StarCamera>(STAR_OVERVIEW);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [shared, setShared] = useState<string[] | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [orbit, setOrbit] = useState<Orbit>({ yaw: 0.3, pitch: -0.18 });
  const [spinning, setSpinning] = useState(true);
  const tween = useRef<number | null>(null);
  useEffect(() => {
    if (!spinning) return;
    let raf = 0, last = performance.now();
    const tick = (t: number) => { const dt = Math.min(t - last, 50); last = t; setOrbit(o => ({ ...o, yaw: o.yaw + dt * 0.00006 })); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning]);
  const animateOrbit = (to: Orbit) => {
    if (tween.current) cancelAnimationFrame(tween.current);
    const from = orbit, start = performance.now();
    let dy = (to.yaw - from.yaw) % (Math.PI * 2); if (dy > Math.PI) dy -= Math.PI * 2; if (dy < -Math.PI) dy += Math.PI * 2;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700), e = 1 - Math.pow(1 - k, 3);
      setOrbit({ yaw: from.yaw + dy * e, pitch: from.pitch + (to.pitch - from.pitch) * e });
      if (k < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  };
  const proj = layouts.map(l => { const r = rotate(l.base, orbit), k = perspective(r.z); return { x: CX + r.x * k, y: CY + r.y * k, s: k, z: r.z, front: (1 - r.z / RADIUS) / 2 }; });
  const drawOrder = proj.map((_, i) => i).sort((a, b) => (proj[b]?.z ?? 0) - (proj[a]?.z ?? 0));
  const nearest = drawOrder[drawOrder.length - 1];
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [expanded]);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const theme = selected === null ? null : CATALOG.themes[selected];
  const focus = hovered ?? selected;
  const localPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current, matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: CX, y: CY };
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    return p.matrixTransform(matrix.inverse());
  };
  const selectTheme = (i: number) => {
    if (moved.current) return;
    const location = layouts[i]; if (!location) return;
    setSelected(i); setDetail(null); setShared(null); setSpinning(false);
    animateOrbit(facingOrbit(location.base));
    const k = perspective(-RADIUS);
    setCamera({ zoom: 2.4, x: CX - CX * 2.4, y: CY - (CY + 40 * k) * 2.4 });
  };
  const overview = () => { setCamera(STAR_OVERVIEW); setSpinning(true); setSelected(null); setDetail(null); setShared(null); };
  const pointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const point = localPoint(e.clientX, e.clientY);
    if (!pointers.current.size) { moved.current = false; origin.current = point; }
    pointers.current.set(e.pointerId, point);
    if (e.isTrusted && !(e.target as Element).closest('[role="button"]')) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(e.pointerId); if (!previous) return;
    const next = localPoint(e.clientX, e.clientY);
    if (Math.hypot(next.x - origin.current.x, next.y - origin.current.y) > 12) moved.current = true;
    const before = [...pointers.current.values()];
    pointers.current.set(e.pointerId, next);
    const after = [...pointers.current.values()];
    const b0 = before[0], b1 = before[1], a0 = after[0], a1 = after[1];
    if (b0 && b1 && a0 && a1) {
      const oldMid = { x: (b0.x + b1.x) / 2, y: (b0.y + b1.y) / 2 };
      const mid = { x: (a0.x + a1.x) / 2, y: (a0.y + a1.y) / 2 };
      const distance = Math.hypot(b0.x - b1.x, b0.y - b1.y);
      if (distance > 0) setCamera(c => {
        const z = zoomStarCamera(c, c.zoom * Math.hypot(a0.x - a1.x, a0.y - a1.y) / distance, oldMid);
        return { ...z, x: z.x + mid.x - oldMid.x, y: z.y + mid.y - oldMid.y };
      });
    } else if (e.shiftKey) setCamera(c => ({ ...c, x: c.x + next.x - previous.x, y: c.y + next.y - previous.y }));
    else { setSpinning(false); setOrbit(o => ({ yaw: o.yaw - (next.x - previous.x) * 0.0035 / camera.zoom, pitch: Math.max(-1.3, Math.min(1.3, o.pitch + (next.y - previous.y) * 0.0035 / camera.zoom)) })); }
  };
  const pickDetail = (i: number, d: Detail) => { if (moved.current) return; const changed = selected !== i; setSelected(i); setDetail(d); setShared(null); if (changed) { setSpinning(false); const loc = layouts[i]; if (loc) animateOrbit(facingOrbit(loc.base)); } };
  const mechanism = detail?.kind === "mechanism" ? theme?.mechanisms[detail.index] : null;
  const path = detail?.kind === "path" ? theme?.paths[detail.index] : null;
  const conclusion = detail?.kind === "conclusion" ? theme?.conclusions[detail.index] : null;
  const insight = detail?.kind === "insight" ? theme?.insights[detail.index] : null;
  return <section className="ts">
    <header className="ts-intro"><div><p className="ts-kicker">Teemaluettelo · {CATALOG.date}</p><h2>Hyvinvointivaltion tähtikuvio</h2></div><p className="ts-edition">12 teemaa · 53 päätelmää</p></header>
    <div className={`ts-space${expanded ? " ts-expanded" : ""}`}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ts-universe" aria-label="Hyvinvointivaltion teemojen ja syy-seurausten tähtikuvio" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={e => pointers.current.delete(e.pointerId)} onPointerCancel={e => pointers.current.delete(e.pointerId)}
        onWheel={e => {
          e.preventDefault();
          const p = localPoint(e.clientX, e.clientY);
          const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
          if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) < 1) setCamera(c => zoomStarCamera(c, c.zoom * Math.exp(-delta * 0.0015), p));
          else setCamera(c => ({ ...c, x: c.x - e.deltaX * 2, y: c.y - e.deltaY * 2 }));
        }}>
        <defs><filter id="ts-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" /></filter><marker id="ts-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="context-stroke" strokeWidth="1.5" /></marker></defs>
        <g className="ts-world" transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`} data-zoom={camera.zoom}>
          <g className="ts-dust" aria-hidden="true">{stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={0.15 + i % 5 * 0.1} />)}</g>
          {proj.map((l, i) => <path key={i} className={`ts-spoke${focus === i ? " active" : ""}`} d={`M${CX} ${CY}L${l.x} ${l.y}`} opacity={0.25 + l.front * 0.75} />)}
          {bridges.map((b, k) => {
            const a = proj[b.a], z = proj[b.b]; if (!a || !z) return null;
            const d = `M${a.x} ${a.y}Q${CX} ${CY} ${z.x} ${z.y}`;
            return <g key={k} className={`ts-link${focus === b.a || focus === b.b ? " active" : ""}`}>
              <path d={d} className="ts-link-line" /><path d={d} className="ts-hit" role="button" tabIndex={0} aria-label={`Käsitteet: ${CATALOG.themes[b.a]?.label} ja ${CATALOG.themes[b.b]?.label}`} onClick={() => { if (!moved.current) { setShared(b.shared); setDetail(null); } }} onKeyDown={e => { if (e.key === "Enter") setShared(b.shared); }} />
            </g>;
          })}
          <g className="ts-sun" opacity={selected === null ? 1 : 0.12} role="button" tabIndex={0} aria-label="Koko tähtikuvio" onClick={() => { if (!moved.current) overview(); }} onKeyDown={e => { if (e.key === "Enter") overview(); }}>
            <circle cx={CX} cy={CY} r="19" className="ts-sun-glow" filter="url(#ts-glow)" /><path d={`M${CX - 60} ${CY}H${CX + 60}M${CX} ${CY - 60}V${CY + 60}`} className="ts-sun-rays" /><circle cx={CX} cy={CY} r="9" />
            <text x={CX} y={CY + 94} textAnchor="middle" className="ts-sun-title">Hyvinvointivaltio</text><text x={CX} y={CY + 126} textAnchor="middle" className="ts-sun-sub">1850–2050</text>
          </g>
          {drawOrder.map(i => {
            const l = layouts[i]!, p = proj[i]!;
            const t = CATALOG.themes[i]; if (!t) return null;
            const active = selected === i;
            const at = new Map(l.nodes.map(n => [n.key, n]));
            return <g key={t.id} className={`ts-constellation${active ? " selected" : ""}${camera.zoom > 1.65 || i === nearest || p.front > 0.8 ? " near" : ""}`} color={ink(i)} transform={`translate(${p.x} ${p.y}) scale(${p.s * 0.9}) translate(-195 0)`} opacity={active ? 1 : 0.3 + p.front * 0.7} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <g role="button" tabIndex={0} aria-label={t.label} className="ts-theme" onClick={() => selectTheme(i)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectTheme(i); } }}>
                <rect x="-20" y="-68" width="430" height="74" fill="transparent" />
                <circle cx="195" cy="-45" r="11" filter="url(#ts-glow)" className="ts-theme-glow" /><circle cx="195" cy="-45" r="5" />
                <text x="195" y="-14" textAnchor="middle" className="ts-theme-label">{t.label.split(",")[0]}</text>
              </g>
              {l.edges.map((edge, k) => {
                const a = at.get(edge.from), b = at.get(edge.to); if (!a || !b) return null;
                const isActive = active && detail?.kind === edge.kind && detail.index === edge.ref;
                const d = `M${a.x} ${a.y}Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - (a.rank === b.rank ? 28 : 10)} ${b.x} ${b.y}`;
                return <g key={k} className={`ts-causal ${edge.kind}${isActive ? " lit" : ""}`}>
                  <path d={d} className="ts-causal-line" markerEnd="url(#ts-arrow)" /><path d={d} className="ts-causal-pulse" />
                  <path d={d} className="ts-hit" tabIndex={0} role="button" aria-label={edge.kind === "mechanism" ? t.mechanisms[edge.ref]?.t : t.paths[edge.ref]?.t} onClick={() => pickDetail(i, { kind: edge.kind, index: edge.ref })} onKeyDown={e => { if (e.key === "Enter") pickDetail(i, { kind: edge.kind, index: edge.ref }); }} />
                </g>;
              })}
              {l.nodes.map((n, j) => { const litEdge = active && (detail?.kind === "mechanism" || detail?.kind === "path") ? l.edges.find(e => e.kind === detail.kind && e.ref === detail.index && (e.from === n.key || e.to === n.key)) : undefined; return <g key={n.key} role="button" tabIndex={0} aria-label={n.label} className={`ts-star${litEdge ? " lit" : ""}`} onClick={() => pickDetail(i, { kind: "concept", index: 0, label: n.label })} onKeyDown={e => { if (e.key === "Enter") pickDetail(i, { kind: "concept", index: 0, label: n.label }); }}>
                <circle cx={n.x} cy={n.y} r="13" fill="transparent" /><circle cx={n.x} cy={n.y} r="5" className="ts-star-glow" filter="url(#ts-glow)" /><circle cx={n.x} cy={n.y} r="3.3" className="ts-star-dot" />
                <text x={n.x} y={n.y + (j % 2 ? -14 - (wrapLabel(n.label).length - 1) * 13 : 22)} textAnchor="middle" className="ts-star-label ts-node-name">{wrapLabel(n.label).map((line, k) => <tspan key={k} x={n.x} dy={k ? 13 : 0}>{line}</tspan>)}</text><title>{n.label}</title>
              </g>; })}
              {l.nodes.length === 0 && <text x="195" y="55" textAnchor="middle" className="ts-unrecorded">Mekanismeja ei kirjattu</text>}
              <g className="ts-conclusion-stars" transform={`translate(0 ${Math.max(0, Math.ceil(l.nodes.length / 4) * 82 - 220)})`}>{t.conclusions.map((c, k) => <g key={c.id} role="button" tabIndex={0} aria-label={`P${c.id} ${c.t}`} onClick={() => pickDetail(i, { kind: "conclusion", index: k })} onKeyDown={e => { if (e.key === "Enter") pickDetail(i, { kind: "conclusion", index: k }); }}><circle cx={125 + k * 22} cy="278" r="9" fill="transparent" /><path d={`M${121 + k * 22} 278l4 -4 4 4 -4 4z`} /><text x={125 + k * 22} y="302" textAnchor="middle">P{c.id}</text></g>)}</g>
            </g>;
          })}
        </g>
      </svg>
      <div className="ts-tools">
        <Button variant="outline" size="icon" aria-label="Lähennä tähtikuviota" title="Lähennä" onClick={() => setCamera(c => zoomStarCamera(c, c.zoom * 1.35, { x: CX, y: CY }))}><Plus /></Button>
        <Button variant="outline" size="icon" aria-label="Loitonna tähtikuviota" title="Loitonna" onClick={() => setCamera(c => zoomStarCamera(c, c.zoom / 1.35, { x: CX, y: CY }))}><Minus /></Button>
        <Button variant="outline" size="icon" aria-label="Koko tähtikuvio" title="Koko tähtikuvio" onClick={overview}><Scan /></Button>
        <Button variant="outline" size="icon" aria-label={expanded ? "Poistu koko näytöstä" : "Tähtitaivas koko näytölle"} title={expanded ? "Poistu koko näytöstä" : "Tähtitaivas koko näytölle"} aria-pressed={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? <Minimize /> : <Maximize />}</Button>
      </div>
      <div className="ts-legend"><span className="ts-legend-cause">Mekanismi</span><span className="ts-legend-path">Selityspolku</span><span className="ts-legend-link">Yhteinen käsite</span></div>
      {(theme || shared) && !panelOpen && <button type="button" className="ts-drawer-open" aria-label="Avaa tietolaatikko" onClick={() => setPanelOpen(true)}>◂ Tiedot</button>}
      <aside className={`ts-context ts-drawer${panelOpen && (theme || shared) ? " open" : ""}`} aria-label="Valinnan aineisto" aria-hidden={!(panelOpen && (theme || shared))}>
        <button type="button" className="ts-drawer-close" aria-label="Piilota tietolaatikko" onClick={() => setPanelOpen(false)}>▸</button>
        <Button className="ts-close" variant="ghost" size="icon" aria-label="Tyhjennä valinta" onClick={() => { setSelected(null); setDetail(null); setShared(null); setPanelOpen(false); }}><X /></Button>
        {shared ? <><p className="ts-kicker">Teemojen välillä</p><h3>Yhteiset käsitteet</h3><p>{shared.join(" · ")}</p><p className="ts-muted">Sama kirjattu käsite, ei vahvistettu syy-yhteys.</p></> : theme && <>
          <p className="ts-kicker">Teema {selected === null ? "" : selected + 1}</p><h3>{theme.label}</h3>
          {mechanism ? <><h4>{mechanism.t}</h4><p className="ts-chain">{mechanism.from} → {mechanism.to}</p><p>{mechanism.d}</p><p className="ts-muted">{mechanism.m}</p></> : path ? <><h4>{path.t}</h4><ol className="ts-steps">{path.steps.map((s, i) => <li key={i}>{s}</li>)}</ol><p className="ts-muted">{path.m}</p></> : conclusion ? <><h4>P{conclusion.id} · {conclusion.t}</h4><p>{conclusion.d}</p></> : insight ? <><h4>{insight.t}</h4><p>{insight.d}</p>{insight.q && <blockquote>{insight.q}</blockquote>}<h4>Vastatapaus</h4><p>{insight.v || "Vastatapausta ei kirjattu."}</p></> : detail?.kind === "concept" ? <><h4>{detail.label}</h4><p>{theme.concepts.find(c => c.t === detail.label)?.d || "Kirjattu mekanismin tai selityspolun käsite."}</p></> : <p className="ts-muted">{theme.gap[0]}</p>}
          <div className="ts-context-options">{theme.paths.map((p, i) => <Button key={i} variant="ghost" onClick={() => setDetail({ kind: "path", index: i })} aria-pressed={detail?.kind === "path" && detail.index === i}><ChevronRight />{p.t}</Button>)}{theme.insights.map((p, i) => <Button key={`i${i}`} variant="ghost" onClick={() => setDetail({ kind: "insight", index: i })}>{p.t}</Button>)}</div>
          <p className="ts-status">Päätelmät: draft · Oivallukset: tarkistettavana</p>
        </>}
      </aside>
    </div>
    <p className="ts-note">Syy-seurausviivat perustuvat kirjattuihin mekanismeihin ja selityspolkuihin. Teemojen väliset sillat osoittavat samannimisiä käsitteitä, eivät hyväksyttyjä kytkentöjä.</p>
  </section>;
}

function wrapLabel(label: string, max = 18) {
  const lines: string[] = [];
  for (const word of label.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + word).length <= max) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}
