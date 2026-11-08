import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasData, Cell } from "@/lib/atlas.functions";

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
};

const W = 680, H = 600, CX = 340, CY = 300, BASE = 215;

// Deterministic starfield
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { x: r(1) * W, y: r(2) * H, s: 0.3 + r(3) * 1.2, o: 0.2 + r(4) * 0.7, d: 2 + r(5) * 5 };
});

export function AtlasSphere({ data, selected, period, kinds, showContext, onPick, onClear }: Props) {
  const [yaw, setYaw] = useState(-0.6), [pitch, setPitch] = useState(0.25), [zoom, setZoom] = useState(1);
  const [auto, setAuto] = useState(true);
  const [hideOthers, setHideOthers] = useState(false);
  const [layer, setLayer] = useState<"all" | Relation>("all");
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const vel = useRef({ y: 0, p: 0 });
  const target = useRef<number | null>(null);
  const suppressClick = useRef(false);

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
  const visible = plotted.filter((p) => !hideOthers || selected === null || p.cell.c === selected);
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
      return { p, cell, v };
    });
  }, [data, selected, showContext]);
  const tlMax = Math.max(1, ...timeline.map((t) => t.v));

  // Causal arcs: conclusions co-occurring with the selected one in the same period (shared evidence context)
  const causal = useMemo(() => {
    if (selected == null) return [];
    const mine = new Map(data.cells.filter((x) => x.c === selected && x.direct > 0).map((x) => [x.p, x.direct]));
    const scored = data.cells
      .filter((x) => x.c !== selected && x.direct > 0 && mine.has(x.p) && kinds.has(conMap.get(x.c)?.kind ?? ""))
      .map((x) => ({ c: x.c, p: x.p, w: Math.min(x.direct, mine.get(x.p)!) }))
      .sort((a, b) => b.w - a.w);
    return scored.slice(0, 14);
  }, [data, selected, kinds, conMap]);

  const steer = (dy: number, dp: number) => { setYaw((v) => v + dy); setPitch((v) => clampP(v + dp)); };
  const pick = (c: number, p: string) => {
    onPick(c, p);
    target.current = -angleOf(p); // rotate chosen era to the front
  };
  const focusYaw = selected != null && period ? -angleOf(period) : null;
  useEffect(() => { if (focusYaw != null) target.current = focusYaw; }, [focusYaw]);

  const lightX = CX - R * 0.38, lightY = CY - R * 0.42;

  return (
    <div className="w-full" data-testid="atlas-sphere">
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
        <label className="flex items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-primary" checked={hideOthers} onChange={(e) => setHideOthers(e.target.checked)} />Vain valittu</label>
        <button className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground" onClick={() => { setYaw(-0.6); setPitch(0.25); setZoom(1); vel.current = { y: 0, p: 0 }; }}>Palauta asento</button>
        <button className="rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40" onClick={onClear} disabled={selected === null}>Näytä kokonaisuus</button>
      </div>

      <p className="mx-2 mt-3 min-h-[2.5em] text-xs text-muted-foreground" role="status">
        {selectedConclusion
          ? <>Korostettu: <span className="text-foreground">{selectedConclusion.title}</span>. Hehkuva aikajana kulkee 1850 → 2050; kaaret näyttävät päätelmät, joita samat aikakaudet tukevat suoraan.</>
          : `${plotted.length} pistettä. Vedä kiertääksesi, valitse piste avataksesi sen käsittelyt.`}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full cursor-grab touch-none select-none rounded-xl bg-[var(--space)] outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing" tabIndex={0}
        aria-label="Pyöritettävä Atlas-pallo. Nuolinäppäimet kiertävät, plus ja miinus zoomaavat, välilyönti pysäyttää pyörityksen. Esc poistaa valinnan."
        onWheel={(e) => setZoom((v) => Math.max(0.6, Math.min(1.5, v - e.deltaY * 0.001)))}
        onKeyDown={(e) => {
          const k = e.key;
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "Escape", " "].includes(k)) e.preventDefault();
          if (k === "ArrowLeft") steer(-0.12, 0); if (k === "ArrowRight") steer(0.12, 0);
          if (k === "ArrowUp") steer(0, 0.1); if (k === "ArrowDown") steer(0, -0.1);
          if (k === "+") setZoom((v) => Math.min(1.5, v + 0.1)); if (k === "-") setZoom((v) => Math.max(0.6, v - 0.1));
          if (k === " ") setAuto((a) => !a); if (k === "Escape") onClear();
        }}
        onPointerDown={(e) => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; vel.current = { y: 0, p: 0 }; target.current = null; suppressClick.current = false; e.currentTarget.setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d) return;
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
          if (d.moved) { const dy = (e.clientX - d.x) * 0.008, dp = (e.clientY - d.y) * 0.008; steer(dy, dp); vel.current = { y: dy, p: dp }; }
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          const d = drag.current; suppressClick.current = !!d?.moved; drag.current = null;
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          if (d && !d.moved) {
            const box = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - box.left) * W) / box.width, y = ((e.clientY - box.top) * H) / box.height;
            const near = visible.filter((p) => p.z > -0.2).map((p) => ({ p, d: Math.hypot(p.x - x, p.y - y) })).filter((v) => v.d < 12).sort((a, b) => a.d - b.d || b.p.z - a.p.z)[0];
            if (near) { pick(near.p.cell.c, near.p.cell.p); suppressClick.current = true; }
          }
        }}
        onPointerCancel={() => { drag.current = null; suppressClick.current = true; }}
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
        {selected != null && causal.map((k, i) => {
          const a = location(selected, k.p, 0.97), b = location(k.c, k.p, 0.97);
          const pts = liftArc(a, b, 0.14);
          const front = pts[14]!.z > -0.15;
          const tgt = conMap.get(k.c);
          return (
            <g key={`ca${i}`} pointerEvents="none" opacity={front ? 0.9 : 0.25}>
              <path d={path(pts)} fill="none" stroke="var(--kind-principle)" strokeWidth={0.8 + k.w * 0.5} strokeLinecap="round" filter="url(#glow)" opacity="0.35" />
              <path d={path(pts)} fill="none" stroke="var(--kind-principle)" strokeWidth={1.2} strokeLinecap="round" strokeDasharray="4 10" className="atlas-flow" style={{ animationDelay: `${i * -0.2}s` }} />
              {front && <circle cx={pts[28]!.x} cy={pts[28]!.y} r={2.4} fill="var(--kind-principle)" filter="url(#glow)"><title>{tgt?.title}</title></circle>}
            </g>
          );
        })}

        {/* Timeline arcs across eras for the selected conclusion */}
        {selected != null && timeline.slice(1).map((t, i) => {
          const prev = timeline[i]!;
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
        {selected != null && timeline.map((t) => {
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
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-muted-foreground">
        <label className="flex items-center gap-2">Zoom <input aria-label="Pallon zoom" className="accent-primary" type="range" min=".6" max="1.5" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
        <label className="flex max-w-full items-center gap-2">Valitse piste
          <select aria-label="Valitse pallon piste" className="min-w-0 max-w-[300px] rounded-md border border-border bg-card p-1.5 text-foreground" value=""
            onChange={(e) => { const p = points.find((p) => p.id === e.target.value); if (p) pick(p.cell.c, p.cell.p); }}>
            <option value="">Päätelmä · aikakausi · yhteystyyppi</option>
            {points.map((p) => <option key={p.id} value={p.id}>{p.cell.c} · {perMap.get(p.cell.p)?.label} · {p.rel.label} ({p.cell[p.rel.key]})</option>)}
          </select>
        </label>
      </div>
      <div className="mx-2 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-primary shadow-[0_0_6px_var(--primary)]" />Aikajana 1850 → 2050</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: "var(--kind-principle)" }} />Saman aikakauden yhteinen näyttö</span>
        <span>Ontto piste = skenaario · koko = kytkentöjen määrä</span>
      </div>
      <p className="mx-2 mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
        Pituusaste = aikakausi, leveysaste = päätelmä, kerros = yhteystyyppi. Kaaret kuvaavat aineiston toimituksellisia kytkentöjä — ne eivät todista syy-yhteyttä.
      </p>
    </div>
  );
}

const clampP = (v: number) => Math.max(-1.3, Math.min(1.3, v));

function Segments({ pts, path, strong }: { pts: { x: number; y: number; z: number }[]; path: (p: { x: number; y: number }[]) => string; strong?: boolean }) {
  const segs: { front: boolean; pts: typeof pts }[] = [];
  for (const p of pts) {
    const front = p.z >= 0, last = segs[segs.length - 1];
    if (!last || last.front !== front) segs.push({ front, pts: last ? [last.pts[last.pts.length - 1]!, p] : [p] });
    else last.pts.push(p);
  }
  return <>{segs.map((s, i) => <path key={i} d={path(s.pts)} stroke={strong ? "var(--primary)" : "var(--sphere-grid)"} strokeOpacity={s.front ? (strong ? 0.9 : 0.55) : 0.12} />)}</>;
}

export type { Cell };
