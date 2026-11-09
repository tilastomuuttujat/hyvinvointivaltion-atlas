import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AtlasData } from "@/lib/atlas.functions";
import { AXES, axisPoints, articleClusters, conceptUses, distinctiveConcepts, type AxisKey } from "@/lib/atlas.axes";

const W = 900, H = 560, L = 64, B = 48, T = 20, RT = 20;
const kindColor = (k: string) => (k.startsWith("hyp") ? "var(--kind-hypo)" : k.startsWith("prin") ? "var(--kind-principle)" : "var(--kind-synth)");
type View = { x0: number; x1: number; y0: number; y1: number };

function ticks(a: number, b: number) {
  const span = b - a || 1, raw = span / 6, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const out: number[] = []; for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(+v.toFixed(6)); return out;
}

/** Zoomable scatter field where the reader picks both axes. */
export function AxisField({ data }: { data: AtlasData }) {
  const [xk, setXk] = useState<AxisKey>("year"), [yk, setYk] = useState<AxisKey>("articles");
  const [sel, setSel] = useState<number | null>(null);
  const [cluster, setCluster] = useState("all");
  const [concept, setConcept] = useState<string | null>(null);
  const uses = useMemo(() => conceptUses(data), [data]);
  const allPts = useMemo(() => axisPoints(data), [data]);
  const clusters = useMemo(() => articleClusters(data, allPts.map(p => p.id)), [data, allPts]);
  const pts = useMemo(() => {
    const keep = cluster === "all" ? null : new Set(clusters.find(c => c.id === cluster)?.members);
    return allPts.filter(p => (!keep || keep.has(p.id)) && Number.isFinite(p[xk]) && Number.isFinite(p[yk]));
  }, [allPts, clusters, cluster, xk, yk]);
  const titleOf = (id: number) => data.conclusions.find(c => c.id === id)?.title ?? `#${id}`;
  const periodOf = (id: string) => data.periods.find(p => p.id === id)?.label ?? id;
  const cUse = concept ? uses.get(concept) : undefined;
  const base = useMemo<View>(() => {
    const xs = pts.map(p => p[xk]), ys = pts.map(p => p[yk]);
    const pad = (a: number, b: number) => { const d = (b - a) * 0.08 || 1; return [a - d, b + d]; };
    const [x0, x1] = pad(Math.min(...xs), Math.max(...xs)), [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
    return { x0: x0!, x1: x1!, y0: y0!, y1: y1! };
  }, [pts, xk, yk]);
  const [view, setView] = useState<View>(base);
  useEffect(() => setView(base), [base]);
  const svg = useRef<SVGSVGElement>(null);
  const sx = (v: number) => L + ((v - view.x0) / (view.x1 - view.x0)) * (W - L - RT);
  const sy = (v: number) => H - B - ((v - view.y0) / (view.y1 - view.y0)) * (H - B - T);
  const zoomAt = (f: number, ax: number, ay: number) => setView(v => {
    const cx = v.x0 + ((ax - L) / (W - L - RT)) * (v.x1 - v.x0), cy = v.y0 + ((H - B - ay) / (H - B - T)) * (v.y1 - v.y0);
    const minW = (base.x1 - base.x0) / 40, maxW = (base.x1 - base.x0) * 2;
    const k = Math.min(maxW / (v.x1 - v.x0), Math.max(minW / (v.x1 - v.x0), 1 / f));
    return { x0: cx - (cx - v.x0) * k, x1: cx + (v.x1 - cx) * k, y0: cy - (cy - v.y0) * k, y1: cy + (v.y1 - cy) * k };
  });
  const toSvg = (e: { clientX: number; clientY: number }) => { const r = svg.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const; };
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const [x, y] = toSvg(e); zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0015), x, y); };
    el.addEventListener("wheel", wheel, { passive: false }); return () => el.removeEventListener("wheel", wheel);
  });
  const ptrs = useRef(new Map<number, { x: number; y: number }>()), pinch = useRef(0);
  const onDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); const [x, y] = toSvg(e); ptrs.current.set(e.pointerId, { x, y }); pinch.current = 0; };
  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    const [x, y] = toSvg(e); ptrs.current.set(e.pointerId, { x, y });
    const all = [...ptrs.current.values()];
    if (all.length >= 2) {
      const [a, b] = all as [{ x: number; y: number }, { x: number; y: number }], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) zoomAt(d / pinch.current, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.current = d; return;
    }
    const dx = ((x - prev.x) / (W - L - RT)), dy = ((y - prev.y) / (H - B - T));
    setView(v => { const w = v.x1 - v.x0, h = v.y1 - v.y0; return { x0: v.x0 - dx * w, x1: v.x1 - dx * w, y0: v.y0 + dy * h, y1: v.y1 + dy * h }; });
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); pinch.current = 0; };
  const zoomLevel = (base.x1 - base.x0) / (view.x1 - view.x0);
  const maxA = Math.max(1, ...pts.map(p => p.articles));
  const chosen = pts.find(p => p.id === sel);
  const label = (k: AxisKey) => AXES.find(a => a.key === k)!.label;

  return (
    <div className="axis-field">
      <div className="axis-controls">
        <label>Vaaka-akseli<select value={xk} onChange={e => setXk(e.target.value as AxisKey)}>{AXES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
        <label>Pystyakseli<select value={yk} onChange={e => setYk(e.target.value as AxisKey)}>{AXES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
        <label>Klusteri<select value={cluster} onChange={e => { setCluster(e.target.value); setSel(null); }}>
          <option value="all">Kaikki päätelmät ({allPts.length})</option>
          {clusters.map(c => <option key={c.id} value={c.id}>{c.label} · {c.members.length}</option>)}
        </select></label>
        <div className="axis-zoom">
          <Button variant="outline" size="icon" aria-label="Lähennä" onClick={() => zoomAt(1.4, (L + W - RT) / 2, (T + H - B) / 2)}><Plus /></Button>
          <Button variant="outline" size="icon" aria-label="Loitonna" onClick={() => zoomAt(1 / 1.4, (L + W - RT) / 2, (T + H - B) / 2)}><Minus /></Button>
          <Button variant="outline" size="icon" aria-label="Palauta näkymä" onClick={() => setView(base)}><RotateCcw /></Button>
          <span>{zoomLevel.toFixed(1)}×</span>
        </div>
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="axis-svg" data-zoom={zoomLevel.toFixed(2)} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role="img" aria-label={`Hajontakenttä: ${label(xk)} ja ${label(yk)}`}>
        <defs><clipPath id="axis-clip"><rect x={L} y={T} width={W - L - RT} height={H - B - T} /></clipPath></defs>
        {ticks(view.x0, view.x1).map(v => <g key={"x" + v}><line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} className="axis-grid" /><text x={sx(v)} y={H - B + 18} textAnchor="middle" className="axis-tick">{v}</text></g>)}
        {ticks(view.y0, view.y1).map(v => <g key={"y" + v}><line x1={L} x2={W - RT} y1={sy(v)} y2={sy(v)} className="axis-grid" /><text x={L - 8} y={sy(v) + 4} textAnchor="end" className="axis-tick">{v}</text></g>)}
        <text x={(L + W - RT) / 2} y={H - 8} textAnchor="middle" className="axis-title">{label(xk)}</text>
        <text transform={`translate(16 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">{label(yk)}</text>
        <g clipPath="url(#axis-clip)">
          {pts.map(p => {
            const x = sx(p[xk]), y = sy(p[yk]), r = 4 + Math.sqrt(p.articles / maxA) * 10;
            return <g key={p.id} className="axis-point" onPointerDown={e => e.stopPropagation()} onClick={() => setSel(p.id)} tabIndex={0} role="button" aria-label={p.title}>
              <circle cx={x} cy={y} r={r} fill={kindColor(p.kind)} opacity={sel && sel !== p.id ? 0.35 : 0.85} />
              {sel === p.id && <circle cx={x} cy={y} r={r + 4} className="axis-ring" />}
              {(zoomLevel > 1.8 || sel === p.id) && <text x={x + r + 4} y={y + 4} className="axis-label">{p.title.length > 48 ? p.title.slice(0, 46) + "…" : p.title}</text>}
              {zoomLevel > 2.6 && distinctiveConcepts(uses, p.id).slice(0, zoomLevel > 5 ? 4 : zoomLevel > 3.8 ? 2 : 1).map((u, i) => (
                <text key={u.key} x={x + r + 10} y={y + 18 + i * 13} className={"axis-concept" + (concept === u.key ? " is-on" : "")}
                  onClick={e => { e.stopPropagation(); setConcept(u.key); }}>◇ {u.label.length > 40 ? u.label.slice(0, 38) + "…" : u.label}</text>
              ))}
            </g>;
          })}
        </g>
      </svg>
      <p className="axis-hint">Vieritä tai nipistä kahdella sormella lähentääksesi, vedä siirtääksesi. Lähempänä näkyvät nimet, sitten päätelmän yksilöivät käsitteet (◇) — napauta käsitettä nähdäksesi sen kytkennät. Klusteri ryhmittää päätelmät sen artikkelin mukaan, johon niillä on eniten kirjattuja kytkentöjä.</p>
      {cUse && <aside className="map-selection axis-concept-card">
        <button type="button" className="axis-close" aria-label="Sulje kortti" onClick={() => setConcept(null)}>×</button>
        <p className="axis-kicker">Käsitteen kytkennät</p>
        <h3>{cUse.label}</h3>
        <p>{cUse.conclusions.length === 1 ? "Yksilöivä: kirjattu vain yhdelle päätelmälle" : `Kirjattu ${cUse.conclusions.length} päätelmälle`}</p>
        <ul>{cUse.conclusions.map(id => <li key={id}><button type="button" onClick={() => setSel(id)}>{titleOf(id)}</button></li>)}</ul>
        <p>Aikakaudet: {cUse.periods.map(periodOf).join(", ")}</p>
        <p>Artikkelit: {cUse.articles.map(n => "#" + n).join(", ")}</p>
        <p className="axis-note">Artikkeliaineiston käsitemerkintä · ei osoitettu syy-yhteys</p>
      </aside>}
      {chosen && <aside className="map-selection axis-selection">
        <h3>{chosen.title}</h3>
        <p>{label(xk)}: {Math.round(chosen[xk] * 10) / 10} · {label(yk)}: {Math.round(chosen[yk] * 10) / 10}</p>
        <p>{chosen.direct} suoraa · {chosen.context} kontekstia · {chosen.counter} vastanäyttöä · {chosen.span} aikakautta</p>
      </aside>}
    </div>
  );
}
