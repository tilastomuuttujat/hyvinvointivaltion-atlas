import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasData, Cell } from "@/lib/atlas.functions";
import { relatedConnections, timelineSegments } from "../lib/atlas.relationships";
import { heightField, contourSegments } from "../lib/atlas.contours";
import { STORYLINES, storylineStops, backcast, futurePeriods, periodAt } from "../lib/atlas.storylines";

type Relation = "direct" | "context" | "counter";
const RELATIONS: { key: Relation; label: string; radius: number; color: string }[] = [
  { key: "context", label: "Taustoittava", radius: 0.8, color: "var(--kind-hypo)" },
  { key: "direct", label: "Suora", radius: 0.97, color: "var(--primary)" },
  { key: "counter", label: "Vastanäyttö", radius: 1.12, color: "var(--warning)" },
];
type V3 = [number, number, number];
type Props = {
  data: AtlasData; selected: number | null; period: string | null;
  kinds: Set<string>; showContext: boolean;
  onPick: (conclusion: number, period: string) => void; onClear: () => void;
  immersive?: boolean; onEra?: (period: string) => void; onLensChange?: (open: boolean) => void;
  scrubYear?: number;
};

const W = 680, H = 600, CX = 340, CY = 300, BASE = 215;

// Deterministic starfield
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  const q = (v: number) => Math.round(v * 100) / 100;
  return { x: q(r(1) * W), y: q(r(2) * H), s: q(0.3 + r(3) * 1.2), o: q(0.2 + r(4) * 0.7), d: q(2 + r(5) * 5) };
});

export function AtlasSphere({ data, selected, period, kinds, showContext, onPick, onClear, immersive = false, onEra, onLensChange, scrubYear }: Props) {
  const [yaw, setYaw] = useState(-0.6), [pitch, setPitch] = useState(0.25), [zoom, setZoom] = useState(1);
  const [auto, setAuto] = useState(true);
  const [hideOthers, setHideOthers] = useState(false);
  const [layer, setLayer] = useState<"all" | Relation>("all");
  const [hover, setHover] = useState<string | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [stopIdx, setStopIdx] = useState(0);
  const [scenario, setScenario] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lens, setLens] = useState<{ c: number; p: string; x: number; y: number; rel: string; relColor: string; count: number } | null>(null);
  const [lensTrail, setLensTrail] = useState<number[]>([]);
  const [lensMode, setLensMode] = useState<"network" | "mindmap">("network");
  const [lensHover, setLensHover] = useState<string | number | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lensFired = useRef(false);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const vel = useRef({ y: 0, p: 0 });
  const target = useRef<number | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => { onLensChange?.(lens != null); }, [lens, onLensChange]);

  // Smooth rotation loop: auto-spin, drag inertia, and easing to the selected point
  useEffect(() => {
    let raf = 0, last = performance.now();
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!drag.current) {
        const v = vel.current;
        if (target.current != null) {
          setYaw((y) => { const diff = Math.atan2(Math.sin(target.current! - y), Math.cos(target.current! - y)); if (Math.abs(diff) < 0.002) { target.current = null; return y; } return y + diff * Math.min(1, dt * 4); });
        } else if (Math.abs(v.y) > 0.0005 || Math.abs(v.p) > 0.0005) {
          setYaw((y) => y + v.y); setPitch((p) => clampP(p + v.p));
          v.y *= 0.94; v.p *= 0.94;
        } else if (auto && !hover && !reduce) {
          setYaw((y) => y + dt * 0.12);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, hover]);

  const order = useMemo(() => [...data.conclusions].sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id), [data]);
  const orderIdx = useMemo(() => new Map(order.map((c, i) => [c.id, i])), [order]);
  const perMap = useMemo(() => new Map(data.periods.map((p) => [p.id, p])), [data]);
  const conMap = useMemo(() => new Map(data.conclusions.map((c) => [c.id, c])), [data]);
  const selectedConclusion = selected != null ? conMap.get(selected) : undefined;
  const rels = RELATIONS.filter((r) => (showContext || r.key !== "context") && (layer === "all" || layer === r.key));

  const angleOf = (pid: string) => { const per = perMap.get(pid)!; return 0.25 + (((per.start + per.end) / 2 - 1850) / 200) * (Math.PI * 2 - 0.5); };
  const latOf = (c: number) => -1.25 + ((orderIdx.get(c) ?? 0) / Math.max(1, order.length - 1)) * 2.5;
  const sph = (lat: number, ang: number, r: number): V3 => [r * Math.cos(lat) * Math.sin(ang), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(ang)];
  const location = (c: number, p: string, r: number) => sph(latOf(c), angleOf(p), r);
  const R = BASE * zoom;
  function project([x, y, z]: V3) {
    const xx = x * Math.cos(yaw) + z * Math.sin(yaw), zz = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const yy = y * Math.cos(pitch) - zz * Math.sin(pitch), depth = y * Math.sin(pitch) + zz * Math.cos(pitch);
    const s = (R * 3.8) / (3.8 - depth);
    return { x: CX + xx * s, y: CY - yy * s, z: depth };
  }
  const path = (ps: { x: number; y: number }[]) => ps.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  const cells = data.cells.filter((cell) => kinds.has(conMap.get(cell.c)?.kind ?? ""));
  const points = cells.flatMap((cell) => rels.filter((rel) => cell[rel.key] > 0).map((rel) => ({ cell, rel, id: `${cell.c}:${cell.p}:${rel.key}` })));
  const max = Math.max(1, ...points.map((p) => p.cell[p.rel.key]));
  const plotted = points.map((p) => ({ ...p, ...project(location(p.cell.c, p.cell.p, p.rel.radius)) })).sort((a, b) => a.z - b.z);
  const hoverPoint = plotted.find((p) => p.id === hover);

  // Lifted 3D arc between two surface points (rendered as glowing animated path)
  const liftArc = (a: V3, b: V3, lift: number) => {
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, m: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const len = Math.hypot(...m) || 1, r0 = Math.hypot(...a) * (1 - t) + Math.hypot(...b) * t;
      // Lift mostly sideways (xz-plane) so arcs near the poles don't shoot straight up/down
      const base = r0 / len, h = lift * Math.sin(Math.PI * t);
      const hl = Math.hypot(m[0], m[2]) || 1;
      out.push(project([m[0] * base + (m[0] / hl) * h, m[1] * base + Math.sign(m[1]) * h * 0.25, m[2] * base + (m[2] / hl) * h]));
    }
    return out;
  };

  // Timeline: selected conclusion's strongest relation per period, chained 1850 → 2050
  const timeline = useMemo(() => {
    if (selected == null) return [];
    return data.periods.map((p) => {
      const cell = data.cells.find((x) => x.c === selected && x.p === p.id);
      const v = cell ? cell.direct + (showContext ? cell.context * 0.5 : 0) : 0;
      const hasData = !!cell && cell.direct + cell.context + cell.counter > 0;
      return { p, cell, v, hasData };
    });
  }, [data, selected, showContext]);
  const tlMax = Math.max(1, ...timeline.map((t) => t.v));

  const segments = useMemo(() => timelineSegments(timeline), [timeline]);
  const gaps = timeline.filter((t) => !t.hasData);

  // Evidence-based connections: shared article or exactly matching key concept in the same period
  const related = useMemo(() => {
    if (selected == null) return [];
    return relatedConnections(data.evidenceIndex ?? [], selected).filter((x) => kinds.has(conMap.get(x.c)?.kind ?? ""));
  }, [data, selected, kinds, conMap]);
  const causal = related.slice(0, 14).map((x) => ({ ...x, w: x.articles.length + x.concepts.length }));
  const relatedSet = useMemo(() => new Set(related.map((x) => `${x.c}:${x.p}`)), [related]);

  // Topography: each conclusion×era is a hill whose height = number of supporting articles
  const [topo, setTopo] = useState(true);
  const contours = useMemo(() => {
    const peaks = cells.filter((c) => c.articles > 0).map((c) => ({ lat: latOf(c.c), ang: angleOf(c.p), w: c.articles }));
    const f = heightField(peaks, 56, 112, 0.11);
    // Levels from value quantiles so mid-density regions also surface as land, not only the tallest peak
    const vals = f.h.flat().filter((v) => v > f.max * 0.01).sort((a, b) => a - b);
    const q = (t: number) => vals[Math.floor(t * (vals.length - 1))] ?? f.max;
    const levels = [0.3, 0.5, 0.66, 0.8, 0.9, 0.96].map(q);
    // Land raster: grid cells above sea level, tinted by elevation band
    const land: { la0: number; la1: number; an0: number; an1: number; band: number }[] = [];
    for (let i = 0; i < f.lats.length - 1; i++) for (let j = 0; j < f.angs.length - 1; j++) {
      const v = (f.h[i]![j]! + f.h[i]![j + 1]! + f.h[i + 1]![j]! + f.h[i + 1]![j + 1]!) / 4;
      let band = -1; levels.forEach((lv, k) => { if (v >= lv) band = k; });
      if (band >= 0) land.push({ la0: f.lats[i]!, la1: f.lats[i + 1]!, an0: f.angs[j]!, an1: f.angs[j + 1]!, band });
    }
    return { land, lines: levels.map((lv, i) => ({ i, segs: contourSegments(f, lv) })) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kinds, order]);
  const summits = useMemo(() => {
    const best = new Map<number, Cell>();
    for (const c of cells) if (c.articles > (best.get(c.c)?.articles ?? 0)) best.set(c.c, c);
    return [...best.values()].sort((a, b) => b.articles - a.articles).slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kinds]);
  const kindBands = useMemo(() => {
    const m = new Map<string, number[]>();
    order.forEach((c) => { if (kinds.has(c.kind)) m.set(c.kind, [...(m.get(c.kind) ?? []), c.id]); });
    return [...m.entries()].map(([kind, ids]) => ({ kind, lat: (latOf(ids[0]!) + latOf(ids[ids.length - 1]!)) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, kinds]);
  const KIND_FI: Record<string, string> = { synteesi: "Synteesit", "hypoteesi / ajallisesti todennettava väite": "Hypoteesit" };

  // Theme paths, scenario back-casting and time machine
  const story = STORYLINES.find((x) => x.id === storyId) ?? null;
  const stops = useMemo(() => (story ? storylineStops(data.periods, data.cells, story.conclusions) : []), [story, data]);
  const stop = stops[Math.min(stopIdx, Math.max(0, stops.length - 1))] ?? null;
  const futureIds = useMemo(() => new Set(futurePeriods(data.periods).map((p) => p.id)), [data]);
  const scenarioOptions = useMemo(() => data.conclusions.filter((c) => data.cells.some((x) => x.c === c.id && futureIds.has(x.p) && x.direct + x.context + x.counter > 0)), [data, futureIds]);
  const back = useMemo(() => (scenario != null ? backcast(data.periods, data.cells, data.evidenceIndex ?? [], scenario) : []), [scenario, data]);
  const backSet = useMemo(() => new Set(back.map((b) => `${b.c}:${b.p}`)), [back]);
  const effectiveYear = scrubYear ?? year;
  const scrubPeriod = effectiveYear != null ? periodAt(data.periods, effectiveYear) : undefined;
  const storySet = useMemo(() => new Set(story?.conclusions ?? []), [story]);
  const inFocus = (c: number, pid: string) => {
    if (story && !storySet.has(c)) return false;
    if (scenario != null && !((c === scenario && futureIds.has(pid)) || backSet.has(`${c}:${pid}`))) return false;
    if (scrubPeriod && (perMap.get(pid)?.start ?? 0) > scrubPeriod.start) return false;
    return true;
  };
  const visible = plotted.filter((p) => inFocus(p.cell.c, p.cell.p) && (!hideOthers || selected === null || p.cell.c === selected || relatedSet.has(`${p.cell.c}:${p.cell.p}`)));
  const storyTimelines = useMemo(() => (story ? story.conclusions.map((c) => ({
    c, segs: timelineSegments(data.periods.map((p) => { const x = data.cells.find((y) => y.c === c && y.p === p.id); return { p, hasData: !!x && x.direct + x.context + x.counter > 0 }; })),
  })) : []), [story, data]);
  const rotateTo = (pid: string | null | undefined) => { if (pid) { target.current = -angleOf(pid); setAuto(false); } };
  useEffect(() => { rotateTo(stop); }, [stop]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rotateTo(scrubPeriod?.id); }, [scrubPeriod?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (scenario != null) rotateTo([...futureIds][0]); }, [scenario]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setYear((y) => { const n = (y ?? 1845) + 5; if (n >= 2050) { setPlaying(false); return 2050; } return n; }), 450);
    return () => clearInterval(t);
  }, [playing]);
  const stopTop = useMemo(() => (stop && story ? data.cells.filter((x) => x.p === stop && storySet.has(x.c)).sort((a, b) => b.direct + b.context - (a.direct + a.context)).slice(0, 3) : []), [stop, story, storySet, data]);

  const lensGraph = useMemo(() => {
    if (!lens) return null;
    const ev = (data.evidenceIndex ?? []).filter((e) => e.p === lens.p);
    const own = ev.filter((e) => e.c === lens.c);
    const ownArts = new Set(own.map((e) => e.articleNo));
    const cw = new Map<string, number>();
    for (const e of own) for (const k of e.concepts) cw.set(k, (cw.get(k) ?? 0) + 1);
    const concepts = [...cw.entries()].sort((x, y) => y[1] - x[1]).slice(0, 9).map(([k, w]) => ({ k, w }));
    const cset = new Set(concepts.map((x) => x.k));
    const others = new Map<number, { c: number; concepts: Set<string>; arts: Set<number> }>();
    for (const e of ev) {
      if (e.c === lens.c) continue;
      const shared = e.concepts.filter((k) => cset.has(k)), art = ownArts.has(e.articleNo);
      if (!shared.length && !art) continue;
      const o = others.get(e.c) ?? { c: e.c, concepts: new Set(), arts: new Set() };
      shared.forEach((k) => o.concepts.add(k)); if (art) o.arts.add(e.articleNo);
      others.set(e.c, o);
    }
    const outer = [...others.values()].sort((x, y) => y.concepts.size + y.arts.size - (x.concepts.size + x.arts.size)).slice(0, 12);
    return { concepts, outer, articles: ownArts.size };
  }, [lens, data]);
  const lensGo = (c: number) => {
    if (!lens) return;
    onPick(c, lens.p);
    if (c === lens.c) return;
    setLensTrail((t) => [...t, lens.c]); setLensHover(null); setLens({ ...lens, c });
  };
  const lensBack = () => { const prev = lensTrail[lensTrail.length - 1]; if (prev == null || !lens) return; setLensTrail((t) => t.slice(0, -1)); setLensHover(null); setLens({ ...lens, c: prev }); onPick(prev, lens.p); };
  const nearestAt = (el: SVGSVGElement, cx: number, cy: number) => {
    const box = el.getBoundingClientRect(), x = ((cx - box.left) * W) / box.width, y = ((cy - box.top) * H) / box.height;
    return visible.filter((p) => p.z > -0.2).map((p) => ({ p, d: Math.hypot(p.x - x, p.y - y) })).filter((v) => v.d < 14).sort((a, b) => a.d - b.d || b.p.z - a.p.z)[0]?.p;
  };
  const clearPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null; };
  useEffect(() => clearPress, []);
  const steer = (dy: number, dp: number) => { setYaw((v) => v + dy); setPitch((v) => clampP(v + dp)); };
  const pick = (c: number, p: string) => {
    onPick(c, p);
    target.current = -angleOf(p); // rotate chosen era to the front
  };
  const focusYaw = period ? -angleOf(period) : null;
  useEffect(() => { if (focusYaw != null) { target.current = focusYaw; setAuto(false); } }, [focusYaw]);
  useEffect(() => { if (scrubPeriod && !immersive) onEra?.(scrubPeriod.id); }, [scrubPeriod?.id]);

  const lightX = CX - R * 0.38, lightY = CY - R * 0.42;

  return (
    <div className={`w-full ${immersive ? 'sphere-immersive' : ''}`} data-testid="atlas-sphere">
      <div className="flex flex-wrap items-center gap-2 px-2 text-xs">
        <div className="flex overflow-hidden rounded-full border border-border bg-card/60 backdrop-blur" role="group" aria-label="Pallon kerros">
          {(["all", ...rels.map((r) => r.key)] as const).filter((v, i, a) => a.indexOf(v) === i).map((k) => {
            const rel = RELATIONS.find((r) => r.key === k);
            return (
              <button key={k} onClick={() => setLayer(k as typeof layer)} aria-pressed={layer === k}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${layer === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {rel && <span className="h-2 w-2 rounded-full" style={{ background: rel.color }} />}{rel ? rel.label : "Kaikki"}
              </button>
            );
          })}
          {layer !== "all" && !rels.length && null}
        </div>
        <button onClick={() => setAuto((a) => !a)} aria-pressed={auto}
          className={`rounded-full border px-3 py-1.5 transition-colors ${auto ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
          {auto ? "❚❚ Pysäytä pyöritys" : "▶ Pyöritä"}
        </button>
        <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-primary" checked={hideOthers} onChange={(e) => setHideOthers(e.target.checked)} />Vain liittyvät pisteet</label>
        <button className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground" onClick={() => { setYaw(-0.6); setPitch(0.25); setZoom(1); vel.current = { y: 0, p: 0 }; }}>Palauta asento</button>
        <button className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40" onClick={onClear} disabled={selected === null}>Näytä kokonaisuus</button>
      </div>

      <div className="mx-2 mt-3 grid gap-3 text-xs md:grid-cols-3">
        <section className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur" aria-label="Teemapolut">
          <h3 className="font-display text-sm text-foreground">Teemapolut</h3>
          <select aria-label="Valitse teemapolku" className="mt-2 w-full rounded-md border border-border bg-card p-1.5 text-foreground" value={storyId ?? ""}
            onChange={(e) => { setStoryId(e.target.value || null); setStopIdx(0); if (e.target.value) setScenario(null); }}>
            <option value="">Ei polkua</option>
            {STORYLINES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          {story && (
            <div className="mt-2 space-y-2">
              <p className="text-muted-foreground">{story.lead}</p>
              {stop ? (
                <>
                  <p className="text-foreground">Käännekohta {Math.min(stopIdx, stops.length - 1) + 1}/{stops.length}: <b>{perMap.get(stop)?.label}</b>{futureIds.has(stop) && <span className="text-muted-foreground"> · skenaario</span>}</p>
                  <ul className="space-y-1">
                    {stopTop.map((x) => (
                      <li key={x.c}><button className="text-left text-muted-foreground hover:text-foreground" onClick={() => pick(x.c, x.p)}>#{x.c} {conMap.get(x.c)?.title}</button></li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button className="rounded-full border border-border px-3 py-1 disabled:opacity-40" disabled={stopIdx <= 0} onClick={() => setStopIdx((i) => i - 1)}>← Edellinen</button>
                    <button className="rounded-full border border-primary px-3 py-1 text-primary disabled:opacity-40" disabled={stopIdx >= stops.length - 1} onClick={() => setStopIdx((i) => i + 1)}>Seuraava käännekohta →</button>
                  </div>
                </>
              ) : <p className="text-muted-foreground">Polun päätelmillä ei ole vielä kirjattua aineistoa.</p>}
            </div>
          )}
        </section>
        <section className="rounded-xl border border-dashed border-border bg-card/40 p-3 backdrop-blur" aria-label="Tulevaisuusskenaariot">
          <h3 className="font-display text-sm text-foreground">Skenaariot 2026–2050</h3>
          <select aria-label="Valitse tulevaisuusskenaario" className="mt-2 w-full rounded-md border border-dashed border-border bg-card p-1.5 text-foreground" value={scenario ?? ""}
            onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setScenario(v); if (v != null) setStoryId(null); }}>
            <option value="">Ei skenaariota</option>
            {scenarioOptions.map((c) => <option key={c.id} value={c.id}>#{c.id} {c.title}</option>)}
          </select>
          {scenario != null && (
            <p className="mt-2 text-muted-foreground">
              <span className="text-foreground">Mahdollisuusavaruus</span>, ei dokumentoitu tapahtuma. Takaisinmallinnus valaisee {back.length} kirjattua kehityskulkua 1970–2025 —
              päätelmän oman aineiston sekä päätelmät, joilla on yhteinen artikkeli tai avainkäsite.
            </p>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur" aria-label="Aikakone">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm text-foreground">Aikakone</h3>
            <span className="font-display text-lg text-primary tabular-nums">{year ?? "—"}</span>
          </div>
          <input aria-label="Aikakone 1850–2050" type="range" min={1850} max={2050} step={5} value={year ?? 2050} className="mt-2 w-full accent-primary"
            onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{scrubPeriod ? `${scrubPeriod.label}${scrubPeriod.start >= 2026 ? " · skenaariot" : ""} · kytkennät tähän asti` : "Kaikki aikakaudet"}</span>
            <span className="flex gap-1">
              <button className="rounded-full border border-primary px-2 py-0.5 text-primary" onClick={() => { if (!playing && (year == null || year >= 2050)) setYear(1850); setPlaying((x) => !x); }}>{playing ? "❚❚" : "▶"}</button>
              <button className="rounded-full border border-border px-2 py-0.5 disabled:opacity-40" disabled={year == null} onClick={() => { setPlaying(false); setYear(null); }}>Nollaa</button>
            </span>
          </div>
        </section>
      </div>

      <div className="mx-2 mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <button aria-pressed={topo} onClick={() => setTopo((x) => !x)} className={`rounded-full border px-2.5 py-0.5 ${topo ? "border-primary text-primary" : "border-border"}`}>Korkeuskäyrät</button>
        {topo && <span>Lue palloa kuin karttaa: lähekkäiset, aineiston tukemat päätelmät muodostavat saaria ja mantereita; tumma meri on vähäisen aineiston aluetta. Mitä tiheämmät ja kirkkaammat käyrät, sitä useampi artikkeli tukee sitä. ▲ = alueen korkein huippu. Pituuspiirit ovat aikakausia, leveysvyöhykkeet päätelmätyyppejä.</span>}
      </div>

      <p className="mx-2 mt-3 min-h-[2.5em] text-xs text-muted-foreground" role="status">
        {selectedConclusion
          ? <>Korostettu: <span className="text-foreground">{selectedConclusion.title}</span>. Hehkuva aikajana kulkee 1850 → 2050; kaaret yhdistävät päätelmiin, joilla on samalla aikakaudella yhteinen artikkeli tai sama avainkäsite. Aineistoaukkoja ei yhdistetä.</>
          : `${plotted.length} pistettä. Vedä kiertääksesi, valitse piste avataksesi sen käsittelyt, pidä pistettä painettuna avataksesi tarkennuslinssin.`}
      </p>

      <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full cursor-grab touch-none select-none rounded-xl bg-[var(--space)] outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing" tabIndex={0}
        aria-label="Pyöritettävä Atlas-pallo. Nuolinäppäimet kiertävät, plus ja miinus zoomaavat, välilyönti pysäyttää pyörityksen. Esc poistaa valinnan. Verkostonäkymä sulkeutuu vain Takaisin palloon -painikkeella."
        onWheel={(e) => setZoom((v) => Math.max(0.6, Math.min(1.5, v - e.deltaY * 0.001)))}
        onKeyDown={(e) => {
          const k = e.key;
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "Escape", " "].includes(k)) e.preventDefault();
          if (k === "ArrowLeft") steer(-0.12, 0); if (k === "ArrowRight") steer(0.12, 0);
          if (k === "ArrowUp") steer(0, 0.1); if (k === "ArrowDown") steer(0, -0.1);
          if (k === "+") setZoom((v) => Math.min(1.5, v + 0.1)); if (k === "-") setZoom((v) => Math.max(0.6, v - 0.1));
          if (k === " ") setAuto((a) => !a); if (k === "Escape" && !lens) onClear();
        }}
        onPointerDown={(e) => { if (e.button !== 0 || (e.target as Element).closest("[data-lens]")) return; drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; vel.current = { y: 0, p: 0 }; target.current = null; suppressClick.current = false; e.currentTarget.setPointerCapture?.(e.pointerId);
          lensFired.current = false; clearPress();
          const hit = nearestAt(e.currentTarget, e.clientX, e.clientY);
          if (hit) pressTimer.current = setTimeout(() => { lensFired.current = true; suppressClick.current = true; setAuto(false); setLensHover(null); setLensTrail([]); setLens({ c: hit.cell.c, p: hit.cell.p, x: hit.x, y: hit.y, rel: hit.rel.label, relColor: hit.rel.color, count: hit.cell[hit.rel.key] }); target.current = -angleOf(hit.cell.p); }, 550); }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d) return;
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) { d.moved = true; clearPress(); }
          if (d.moved) { const dy = (e.clientX - d.x) * 0.008, dp = (e.clientY - d.y) * 0.008; steer(dy, dp); vel.current = { y: dy, p: dp }; }
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          clearPress();
          const d = drag.current; suppressClick.current = !!d?.moved || lensFired.current; drag.current = null;
          if (lensFired.current) return;
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          if (d && !d.moved) {
            const box = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - box.left) * W) / box.width, y = ((e.clientY - box.top) * H) / box.height;
            const near = visible.filter((p) => p.z > -0.2).map((p) => ({ p, d: Math.hypot(p.x - x, p.y - y) })).filter((v) => v.d < 12).sort((a, b) => a.d - b.d || b.p.z - a.p.z)[0];
            if (near) { pick(near.p.cell.c, near.p.cell.p); suppressClick.current = true; }
          }
        }}
        onPointerCancel={() => { clearPress(); drag.current = null; suppressClick.current = true; }}
        onPointerLeave={() => setHover(null)}>
        <title>Atlas-pallo: aikakaudet, päätelmät ja kytkentöjen laji</title>
        <defs>
          <radialGradient id="sph-body" cx={lightX} cy={lightY} r={R * 1.5} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--sphere-lit)" />
            <stop offset="45%" stopColor="var(--sphere-mid)" />
            <stop offset="100%" stopColor="var(--space)" />
          </radialGradient>
          <radialGradient id="sph-spec" cx={lightX} cy={lightY} r={R * 0.55} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sph-rim" cx={CX} cy={CY} r={R * 1.25} gradientUnits="userSpaceOnUse">
            <stop offset="76%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="82%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sph-nebula" cx="70%" cy="20%" r="70%">
            <stop offset="0%" stopColor="var(--kind-principle)" stopOpacity="0.12" />
            <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--space)" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#sph-nebula)" />
        <g pointerEvents="none">
          {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="var(--foreground)" opacity={s.o} className="atlas-twinkle" style={{ animationDuration: `${s.d}s` }} />)}
        </g>

        {/* Sphere body with lighting */}
        <circle cx={CX} cy={CY} r={R * 1.3} fill="url(#sph-rim)" pointerEvents="none" />
        <ellipse cx={CX} cy={CY + R * 1.08} rx={R * 0.8} ry={R * 0.08} fill="var(--primary)" opacity="0.08" filter="url(#glow-strong)" pointerEvents="none" />
        <circle cx={CX} cy={CY} r={R * 0.98} fill="url(#sph-body)" pointerEvents="none" />

        {/* Graticule: back half faint, front half brighter */}
        <g fill="none" strokeWidth="0.7" pointerEvents="none">
          {Array.from({ length: 9 }, (_, i) => {
            const lat = -1.25 + (i / 8) * 2.5;
            const pts = Array.from({ length: 73 }, (_, n) => project(sph(lat, (n / 72) * Math.PI * 2, 0.97)));
            return <Segments key={`lat${i}`} pts={pts} path={path} />;
          })}
          {data.periods.map((p) => {
            const pts = Array.from({ length: 41 }, (_, n) => project(sph(-1.35 + (n / 40) * 2.7, angleOf(p.id), 0.97)));
            return <Segments key={`lon${p.id}`} pts={pts} path={path} strong={period === p.id && selected != null} />;
          })}
        </g>

        {/* Contour topography: thin elevation lines, higher = more supporting articles */}
        {topo && (
          <g fill="none" pointerEvents="none" strokeLinecap="round">
            {[0, 1, 2, 3, 4, 5].map((band) => {
              let d = "";
              for (const q of contours.land) {
                if (q.band !== band) continue;
                const c = [project(sph(q.la0, q.an0, 0.972)), project(sph(q.la0, q.an1, 0.972)), project(sph(q.la1, q.an1, 0.972)), project(sph(q.la1, q.an0, 0.972))];
                if (c.every((p) => p.z < 0)) continue;
                d += `M${c.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z`;
              }
              return <path key={`l${band}`} d={d} fill={band >= 4 ? "var(--kind-hypo)" : "var(--primary)"} fillOpacity={0.18 + band * 0.08} stroke="none" />;
            })}
            {contours.lines.map(({ i, segs }) => {
              let d = "";
              for (const [a, b] of segs) {
                const pa = project(sph(a[0], a[1], 0.975 + i * 0.006)), pb = project(sph(b[0], b[1], 0.975 + i * 0.006));
                if (pa.z < 0 && pb.z < 0) continue;
                d += `M${pa.x.toFixed(1)},${pa.y.toFixed(1)}L${pb.x.toFixed(1)},${pb.y.toFixed(1)}`;
              }
              return <path key={i} d={d} stroke={i >= 4 ? "var(--kind-hypo)" : "var(--primary)"} strokeOpacity={0.45 + i * 0.1} strokeWidth={i === 0 ? 1.2 : 0.8 + i * 0.1} />;
            })}
            {kindBands.map((b) => {
              const v = project(sph(b.lat, -yaw, 1.0));
              return v.z > 0.3 && <text key={b.kind} x={v.x} y={v.y} textAnchor="middle" fontSize="11" letterSpacing="3" className="font-display uppercase" fill="var(--foreground)" opacity="0.35">{KIND_FI[b.kind] ?? b.kind.split(" ")[0]}</text>;
            })}
            {summits.map((s) => {
              const v = project(location(s.c, s.p, 1.0));
              if (v.z < 0.15) return null;
              const t = conMap.get(s.c)?.title ?? "";
              return (
                <g key={`${s.c}:${s.p}`}>
                  <path d={`M${v.x - 4},${v.y + 3}L${v.x},${v.y - 4}L${v.x + 4},${v.y + 3}Z`} fill="var(--kind-hypo)" opacity="0.85" />
                  <text x={v.x + 6} y={v.y - 4} fontSize="9.5" fill="var(--foreground)" opacity="0.85" stroke="var(--space)" strokeWidth="2.5" paintOrder="stroke">{t.length > 28 ? t.slice(0, 27) + "…" : t} · {s.articles} art.</text>
                </g>
              );
            })}
          </g>
        )}

        {/* Era labels on an outer orbit */}
        {data.periods.map((p) => {
          const v = project(sph(0, angleOf(p.id), 1.26));
          const fut = p.start >= 2026, front = v.z > -0.1;
          return (
            <g key={p.id} pointerEvents="none" opacity={front ? 1 : 0.35}>
              <text x={v.x} y={v.y} textAnchor="middle" fontSize={front ? 12 : 10} className="font-display" fill={period === p.id && selected != null ? "var(--primary)" : "var(--foreground)"}>{p.label}</text>
              {fut && <text x={v.x} y={v.y + 13} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">skenaariot</text>}
            </g>
          );
        })}

        {/* Points (back to front) */}
        {visible.map((p) => {
          const active = selected === null || p.cell.c === selected;
          const exact = p.cell.c === selected && p.cell.p === period;
          const isHover = hover === p.id;
          const count = p.cell[p.rel.key], size = (2.4 + Math.sqrt(count / max) * 4.2) * (0.75 + 0.35 * (p.z + 1) / 2) * zoom;
          const per = perMap.get(p.cell.p)!, c = conMap.get(p.cell.c)!;
          const back = p.z < 0;
          const op = active ? (back ? 0.3 : 0.55 + 0.45 * p.z) : 0.05;
          return (
            <g key={p.id} opacity={isHover ? 1 : op}>
              <circle data-sphere-point={p.id} cx={p.x} cy={p.y} r={size + (exact || isHover ? 2 : 0)}
                fill={per.start >= 2026 ? "var(--space)" : p.rel.color} stroke={p.rel.color} strokeWidth={exact ? 2.4 : 1}
                filter={!back && active && (selected != null || count / max > 0.4) ? "url(#glow)" : undefined}
                onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}
                onClick={() => { if (!suppressClick.current) pick(p.cell.c, p.cell.p); }} className="cursor-pointer transition-[r]">
                <title>{`${c.title} · ${per.label} · ${p.rel.label}: ${count} kytkentää`}</title>
              </circle>
              {exact && <circle cx={p.x} cy={p.y} r={size + 7} fill="none" stroke="var(--foreground)" strokeWidth="1" className="atlas-pulse" pointerEvents="none" />}
            </g>
          );
        })}

        {/* Causal arcs: shared-era evidence to other conclusions */}
        {selected != null && causal.filter(k => !scrubPeriod || (perMap.get(k.p)?.start ?? 0) <= scrubPeriod.start).map((k, i) => {
          const a = location(selected, k.p, 0.97), b = location(k.c, k.p, 0.97);
          const pts = liftArc(a, b, 0.14);
          const front = pts[14]!.z > -0.15;
          const tgt = conMap.get(k.c);
          return (
            <g key={`ca${i}`} pointerEvents="none" opacity={front ? 0.9 : 0.25}>
              <path d={path(pts)} fill="none" stroke="var(--kind-principle)" strokeWidth={0.8 + k.w * 0.5} strokeLinecap="round" filter="url(#glow)" opacity="0.35" />
              <path d={path(pts)} fill="none" stroke="var(--kind-principle)" strokeWidth={1.2} strokeLinecap="round" strokeDasharray="4 10" className="atlas-flow" style={{ animationDelay: `${i * -0.2}s` }} />
              {front && <circle cx={pts[28]!.x} cy={pts[28]!.y} r={2.4} fill="var(--kind-principle)" filter="url(#glow)"><title>{`${tgt?.title ?? ""}${k.articles.length ? ` · yhteiset art. ${k.articles.join(", ")}` : ""}${k.concepts.length ? ` · käsitteet: ${k.concepts.join(", ")}` : ""}`}</title></circle>}
            </g>
          );
        })}

        {/* Timeline arcs across eras for the selected conclusion */}
        {selected != null && segments.filter(([, t]) => !scrubPeriod || t.p.start <= scrubPeriod.start).map(([prev, t], i) => {
          const a = location(selected, prev.p.id, 1.02), b = location(selected, t.p.id, 1.02);
          const pts = liftArc(a, b, 0.07 + 0.12 * ((prev.v + t.v) / (2 * tlMax)));
          const fut = t.p.start >= 2026;
          const strength = 1 + 3 * ((prev.v + t.v) / (2 * tlMax));
          const front = pts[14]!.z > -0.2;
          return (
            <g key={`tl${i}`} pointerEvents="none" opacity={front ? 1 : 0.3}>
              <path d={path(pts)} fill="none" stroke="var(--primary)" strokeWidth={strength + 3} opacity="0.25" filter="url(#glow-strong)" />
              <path d={path(pts)} fill="none" stroke="var(--primary)" strokeWidth={strength} strokeLinecap="round"
                strokeDasharray={fut ? "2 6" : "14 8"} className="atlas-flow" style={{ animationDuration: fut ? "2.4s" : "1.6s" }} />
            </g>
          );
        })}
        {selected != null && timeline.filter(t => !scrubPeriod || t.p.start <= scrubPeriod.start).map((t) => {
          const v = project(location(selected, t.p.id, 1.02));
          const front = v.z > -0.2;
          const on = t.p.id === period;
          return (
            <g key={`tn${t.p.id}`} opacity={front ? 1 : 0.35} className="cursor-pointer" onClick={() => { if (!suppressClick.current) pick(selected, t.p.id); }}>
              <circle cx={v.x} cy={v.y} r={4 + 5 * (t.v / tlMax)} fill={t.v > 0 ? "var(--primary)" : "var(--space)"} stroke="var(--primary)" strokeWidth={on ? 2.5 : 1.2} filter="url(#glow)" />
              {front && <text x={v.x} y={v.y - 10 - 5 * (t.v / tlMax)} textAnchor="middle" fontSize="9" fill="var(--foreground)" pointerEvents="none">{t.p.start}</text>}
            </g>
          );
        })}

        {/* Theme path timelines */}
        {storyTimelines.flatMap(({ c, segs }) => segs.filter(([a, b]) => !scrubPeriod || b.p.start <= scrubPeriod.start).map(([a, b], i) => {
          const pts = liftArc(location(c, a.p.id, 1.0), location(c, b.p.id, 1.0), 0.08);
          const fut = b.p.start >= 2026, on = stop === b.p.id || stop === a.p.id;
          return (
            <g key={`st${c}-${i}`} pointerEvents="none" opacity={pts[14]!.z > -0.2 ? (on ? 1 : 0.6) : 0.2}>
              <path d={path(pts)} fill="none" stroke="var(--kind-synth)" strokeWidth={on ? 2.4 : 1.4} strokeDasharray={fut ? "2 6" : "10 6"} className="atlas-flow" filter="url(#glow)" />
            </g>
          );
        }))}

        {/* Scenario: possibility space + back-cast arcs into documented past */}
        {scenario != null && [...futureIds].map((fid) => {
          const pts = Array.from({ length: 41 }, (_, n) => project(sph(-1.35 + (n / 40) * 2.7, angleOf(fid), 1.06)));
          const lbl = project(sph(1.2, angleOf(fid), 1.14));
          return (
            <g key={`fs${fid}`} pointerEvents="none">
              <path d={path(pts)} fill="none" stroke="var(--kind-hypo)" strokeWidth={14} strokeOpacity={0.08} strokeDasharray="3 5" />
              {lbl.z > -0.1 && <text x={lbl.x} y={lbl.y} textAnchor="middle" fontSize="10" fill="var(--kind-hypo)" className="font-display">mahdollisuusavaruus</text>}
            </g>
          );
        })}
        {scenario != null && back.map((b, i) => {
          const fid = [...futureIds][0]!;
          const pts = liftArc(location(scenario, fid, 1.04), location(b.c, b.p, 0.97), 0.18);
          return (
            <g key={`bc${i}`} opacity={pts[14]!.z > -0.2 ? 0.9 : 0.25}>
              <path d={path(pts)} fill="none" stroke="var(--kind-hypo)" strokeWidth={b.via === "same" ? 2 : 1.2} strokeDasharray="3 7" className="atlas-flow" style={{ animationDirection: "reverse" }} filter="url(#glow)" pointerEvents="none" />
              <circle cx={pts[28]!.x} cy={pts[28]!.y} r={3} fill="var(--kind-hypo)" filter="url(#glow)" className="cursor-pointer" onClick={() => pick(b.c, b.p)}>
                <title>{`${perMap.get(b.p)?.label} · #${b.c} ${conMap.get(b.c)?.title ?? ""}${b.articles.length ? ` · art. ${b.articles.join(", ")}` : ""}${b.concepts.length ? ` · ${b.concepts.join(", ")}` : ""}`}</title>
              </circle>
            </g>
          );
        })}

        {/* Specular gloss on top */}
        <circle cx={CX} cy={CY} r={R * 0.98} fill="url(#sph-spec)" pointerEvents="none" />
        <ellipse cx={lightX + R * 0.1} cy={lightY + R * 0.02} rx={R * 0.22} ry={R * 0.11} transform={`rotate(-35 ${lightX + R * 0.1} ${lightY + R * 0.02})`} fill="var(--foreground)" opacity="0.08" pointerEvents="none" />

        {hoverPoint && (() => {
          const c = conMap.get(hoverPoint.cell.c), per = perMap.get(hoverPoint.cell.p);
          const bx = Math.min(W - 300, Math.max(10, hoverPoint.x + 14)), by = Math.max(10, hoverPoint.y - 62);
          return (
            <g pointerEvents="none">
              <line x1={hoverPoint.x} y1={hoverPoint.y} x2={bx} y2={by + 28} stroke="var(--primary)" strokeOpacity="0.5" />
              <rect x={bx} y={by} width="290" height="54" rx="8" fill="var(--popover)" fillOpacity="0.92" stroke="var(--border)" />
              <text x={bx + 10} y={by + 20} fontSize="11.5" fill="var(--foreground)">{(c?.title ?? "").slice(0, 44)}{(c?.title.length ?? 0) > 44 ? "…" : ""}</text>
              <text x={bx + 10} y={by + 40} fontSize="10.5" fill="var(--muted-foreground)">{per?.label} · <tspan fill={hoverPoint.rel.color}>{hoverPoint.rel.label}</tspan> · {hoverPoint.cell[hoverPoint.rel.key]} kytkentää</text>
            </g>
          );
        })()}

        {lens && lensGraph && (() => {
          const per = perMap.get(lens.p), c0 = conMap.get(lens.c);
          const { concepts, outer } = lensGraph;
          const cpos = new Map(concepts.map((k, i) => { const a = -Math.PI / 2 + (i / Math.max(1, concepts.length)) * Math.PI * 2; return [k.k, { x: CX + Math.cos(a) * 120, y: CY + Math.sin(a) * 100, a }]; }));
          const opos = outer.map((o, i) => {
            const as = [...o.concepts].map((k) => cpos.get(k)!.a);
            const base = as.length ? Math.atan2(as.reduce((s, a) => s + Math.sin(a), 0), as.reduce((s, a) => s + Math.cos(a), 0)) : -Math.PI / 2 + (i / outer.length) * Math.PI * 2;
            const a = base + ((i % 3) - 1) * 0.22;
            return { ...o, x: CX + Math.cos(a) * 245, y: CY + Math.sin(a) * 215 };
          });
          const short = (t: string, n: number) => (t.length > n ? t.slice(0, n) + "…" : t);
          const hi = lensHover;
          const lit = (k: string | number) => hi == null || hi === k;
          return (
            <g data-lens>
              <rect x="0" y="0" width={W} height={H} fill="var(--space)" opacity="0.94" />
              <g pointerEvents="none">
                <line x1={lens.x} y1={lens.y} x2={CX} y2={CY} stroke={lens.relColor} strokeOpacity="0.35" strokeDasharray="2 4" />
                <circle cx={lens.x} cy={lens.y} r="9" fill="none" stroke={lens.relColor} strokeWidth="1.5" className="atlas-pulse" />
                <circle cx={lens.x} cy={lens.y} r="4" fill={lens.relColor} />
              </g>
              {lensMode === "mindmap" ? <MindMap center={lens.c} concepts={concepts} outer={outer} title={(c) => conMap.get(c)?.title ?? ""} hi={hi} setHi={setLensHover}
                onPick={lensGo} /> : <>
              {[120, 245].map((r, i) => <ellipse key={r} cx={CX} cy={CY} rx={r} ry={i ? 215 : 100} fill="none" stroke="var(--sphere-grid)" strokeOpacity="0.1" strokeDasharray="2 6" pointerEvents="none" />)}
              {opos.map((o) => [...o.concepts].map((k) => { const p = cpos.get(k)!; const on = lit(k) || lit(o.c);
                return <line key={o.c + k} x1={p.x} y1={p.y} x2={o.x} y2={o.y} stroke="var(--kind-hypo)" strokeWidth={on && hi != null ? 1.8 : 1} strokeOpacity={on ? 0.55 : 0.06} pointerEvents="none" />; }))}
              {opos.filter((o) => o.arts.size).map((o) => (
                <line key={"a" + o.c} x1={CX} y1={CY} x2={o.x} y2={o.y} stroke="var(--primary)" strokeWidth={1 + Math.min(3, o.arts.size)} strokeOpacity={lit(o.c) ? 0.35 : 0.05} strokeDasharray="4 7" className="atlas-flow" pointerEvents="none" />
              ))}
              {concepts.map((k) => { const p = cpos.get(k.k)!; const on = lit(k.k);
                return <line key={"c" + k.k} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--primary)" strokeWidth={1 + k.w} strokeOpacity={on ? 0.7 : 0.1} className="atlas-flow" strokeDasharray="6 5" pointerEvents="none" />; })}
              {opos.map((o) => { const on = lit(o.c) || [...o.concepts].some((k) => hi === k);
                return (
                  <g key={o.c} className="cursor-pointer" opacity={hi == null || on ? 1 : 0.25} onPointerEnter={() => setLensHover(o.c)} onPointerLeave={() => setLensHover(null)}
                    onClick={() => lensGo(o.c)}>
                    <title>{conMap.get(o.c)?.title}</title>
                    <circle cx={o.x} cy={o.y} r={6 + Math.min(6, (o.concepts.size + o.arts.size) * 1.4)} fill="var(--card)" stroke="var(--foreground)" strokeOpacity="0.6" />
                    <text x={o.x} y={o.y + 3.5} fontSize="9" textAnchor="middle" fill="var(--foreground)">{o.c}</text>
                    <text x={o.x} y={o.y + (o.y > CY ? 26 : -16)} fontSize="9.5" textAnchor="middle" fill="var(--muted-foreground)">{short(conMap.get(o.c)?.title ?? "", 26)}</text>
                  </g>
                ); })}
              {concepts.map((k) => { const p = cpos.get(k.k)!; const on = lit(k.k);
                const w = Math.min(150, k.k.length * 6 + 18);
                return (
                  <g key={"n" + k.k} opacity={on ? 1 : 0.3} onPointerEnter={() => setLensHover(k.k)} onPointerLeave={() => setLensHover(null)} className="cursor-default">
                    <rect x={p.x - w / 2} y={p.y - 11} width={w} height="22" rx="11" fill="var(--popover)" stroke="var(--kind-hypo)" strokeWidth={1 + k.w * 0.5} filter={hi === k.k ? "url(#glow)" : undefined} />
                    <text x={p.x} y={p.y + 4} fontSize="10.5" textAnchor="middle" fill="var(--kind-hypo)">{short(k.k, 22)}</text>
                  </g>
                ); })}
              <g className="cursor-pointer" onClick={() => lensGo(lens.c)}>
                <circle cx={CX} cy={CY} r="30" fill="var(--primary)" opacity="0.18" className="atlas-pulse" pointerEvents="none" />
                <circle cx={CX} cy={CY} r="24" fill="var(--card)" stroke="var(--primary)" strokeWidth="2.5" filter="url(#glow)" />
                <text x={CX} y={CY + 4} fontSize="12" textAnchor="middle" fill="var(--foreground)" fontWeight="600">#{lens.c}</text>
              </g>
              </>}
              <text x="20" y="30" fontSize="13" fill="var(--foreground)" className="font-display">{short(c0?.title ?? "", 52)}</text>
              <text x="20" y="66" fontSize="10.5" fill="var(--muted-foreground)">Painettu kohta: <tspan fill={lens.relColor}>●</tspan> {per?.label} · {lens.rel} · {lens.count} kytkentää — merkitty pallolle sykkivällä renkaalla</text>
              <g fontSize="10.5">
                {(["network", "mindmap"] as const).map((m, i) => (
                  <g key={m} className="cursor-pointer" onClick={() => { setLensMode(m); setLensHover(null); }}>
                    <rect x={W - 196 + i * 92} y="16" width="88" height="24" rx="12" fill={lensMode === m ? "var(--primary)" : "var(--card)"} stroke="var(--border)" />
                    <text x={W - 152 + i * 92} y="32" textAnchor="middle" fill={lensMode === m ? "var(--primary-foreground)" : "var(--muted-foreground)"}>{m === "network" ? "Verkosto" : "Mielikartta"}</text>
                  </g>
                ))}
              </g>
              <g fontSize="11" className="cursor-pointer">
                <g onClick={() => setLens(null)} className="cursor-pointer transition-opacity hover:opacity-80">
                  <title>Sulje verkostonäkymä ja palaa pallonäkymään</title>
                  <rect x={W - 196} y="48" width="180" height="26" rx="13" fill="var(--card)" stroke="var(--primary)" strokeWidth="1.5" />
                  <text x={W - 106} y="65" textAnchor="middle" fill="var(--primary)" fontWeight="600">◐ Takaisin palloon</text>
                </g>
                {lensTrail.length > 0 && (
                  <g onClick={lensBack}>
                    <rect x={W - 196} y="80" width="180" height="24" rx="12" fill="var(--card)" stroke="var(--border)" />
                    <text x={W - 106} y="96" textAnchor="middle" fill="var(--muted-foreground)">‹ Edellinen (#{lensTrail[lensTrail.length - 1]})</text>
                  </g>
                )}
              </g>
              {lensTrail.length > 0 && <text x="20" y="84" fontSize="10" fill="var(--muted-foreground)">Polku: {[...lensTrail, lens.c].slice(-6).map((c) => `#${c}`).join(" → ")}</text>}
              <text x="20" y="48" fontSize="10.5" fill="var(--muted-foreground)">{lensMode === "network" ? "Käsiteverkko" : "Mielikartta"} · {per?.label} · {lensGraph.articles} artikkelia · {concepts.length} käsitettä · {outer.length} kytkettyä päätelmää</text>
              {!concepts.length && !outer.length && <text x={CX} y={CY + 60} fontSize="11" textAnchor="middle" fill="var(--muted-foreground)">Tälle aikakaudelle ei ole kirjattu käsitelinkkejä</text>}
              <g fontSize="10" fill="var(--muted-foreground)">
                <rect x="20" y={H - 52} width="18" height="10" rx="5" fill="none" stroke="var(--kind-hypo)" /><text x="44" y={H - 43}>avainkäsite</text>
                <circle cx="124" cy={H - 47} r="5" fill="var(--card)" stroke="var(--foreground)" /><text x="134" y={H - 43}>päätelmä, jolla sama käsite</text>
                <line x1="290" y1={H - 47} x2="312" y2={H - 47} stroke="var(--primary)" strokeDasharray="4 4" /><text x="318" y={H - 43}>yhteinen artikkeli</text>
                <text x="20" y={H - 22}>Vie osoitin käsitteen päälle korostaaksesi sen yhteydet · klikkaa päätelmää siirtyäksesi siihen · paluu vain ◐ Takaisin palloon -painikkeella</text>
              </g>
            </g>
          );
        })()}
      </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">Zoom <input aria-label="Pallon zoom" className="accent-primary" type="ran

... [truncated — file is 59316 bytes, showing first 51200]