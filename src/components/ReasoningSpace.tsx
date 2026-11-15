import { useEffect, useMemo, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import { catalogueFor } from "@/lib/teema.system";
import {
  buildForceGraph,
  layoutForceGraph,
  neighbours,
} from "@/lib/atlas.force-graph";
import { rotate, perspective, type Orbit } from "@/lib/teema.camera";

const RS_CSS = `
.reasoning-space{--rs-1:oklch(0.82 0.10 180);--rs-2:oklch(0.82 0.11 145);--rs-3:oklch(0.84 0.12 95);--rs-4:oklch(0.82 0.12 65);--rs-5:oklch(0.78 0.12 25);--rs-6:oklch(0.80 0.10 335);--rs-7:oklch(0.78 0.10 295);--rs-8:oklch(0.80 0.10 230);color:oklch(0.93 0.015 230);background:oklch(0.11 0.03 260)}
.reasoning-space .rs-label{fill:oklch(0.95 0.015 230);paint-order:stroke;stroke:oklch(0.11 0.03 260);stroke-width:3px;pointer-events:none}
.reasoning-space .rs-flow{animation:rs-flow 2.4s linear infinite}
.reasoning-space .rs-fast{animation-duration:1.1s}
.reasoning-space .rs-pulse{animation:rs-pulse 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes rs-flow{to{stroke-dashoffset:-24}}
@keyframes rs-pulse{50%{transform:scale(1.5);opacity:.6}}
@media (prefers-reduced-motion:reduce){.reasoning-space .rs-flow,.reasoning-space .rs-pulse{animation:none}}
`;
const W = 1600,
  H = 1000,
  PALETTE = 8;

/**
 * Wordless reasoning space: concepts carry their names, relations are shown only
 * visually (flow direction = recorded mechanism direction, faint threads = theme membership).
 * No buttons except the exit; the reader draws their own conclusions.
 */
export function ReasoningSpace({
  data,
  onClose,
}: {
  data: AtlasData;
  onClose: () => void;
}) {
  const catalog = catalogueFor(data);
  const graph = useMemo(
    () => layoutForceGraph(buildForceGraph(catalog.themes)),
    [catalog],
  );
  const [orbit, setOrbit] = useState<Orbit>({ yaw: 0.4, pitch: -0.2 });
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const idle = useRef(0);

  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      if (t - idle.current > 2500 && pointers.current.size === 0)
        setOrbit((o) => ({
          ...o,
          yaw: o.yaw + dt * (sel === null ? 0.00006 : 0.00002),
        }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", k);
    };
  }, [sel, onClose]);

  const proj = graph.nodes.map((n) => {
    const r = rotate(n.p, orbit),
      s = perspective(r.z * 2.2) * zoom * 0.95;
    return { x: W / 2 + r.x * s, y: H / 2 + r.y * s, z: r.z, s };
  });
  const focus = sel ?? hover;
  const near = useMemo(
    () => (focus === null ? null : neighbours(graph, focus)),
    [graph, focus],
  );
  // second ring: neighbours of neighbours via mechanisms only (resonance)
  const echo = useMemo(() => {
    if (focus === null || !near) return null;
    const s = new Set<number>();
    for (const e of graph.edges)
      if (e.kind === "mechanism" && (near.has(e.a) || near.has(e.b))) {
        s.add(e.a);
        s.add(e.b);
      }
    return s;
  }, [graph, focus, near]);
  const degree = useMemo(() => {
    const d = graph.nodes.map(() => 0);
    for (const e of graph.edges)
      if (e.kind === "mechanism") {
        d[e.a]!++;
        d[e.b]!++;
      }
    return d;
  }, [graph]);

  const color = (i: number) =>
    `var(--rs-${(graph.nodes[i]!.themes[0]! % PALETTE) + 1})`;
  const fog = (z: number) => Math.max(0.3, Math.min(1, 0.85 - z / 900));
  const weight = (i: number) =>
    focus === null ? 1 : near!.has(i) ? 1 : echo!.has(i) ? 0.45 : 0.08;

  const down = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    if (!pointers.current.size) origin.current = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    idle.current = performance.now();
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    idle.current = performance.now();
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (pinch.current)
        setZoom((z) => Math.min(5, Math.max(0.5, (z * d) / pinch.current!)));
      pinch.current = d;
      moved.current = true;
      return;
    }
    if (
      Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8
    )
      moved.current = true;
    if (!moved.current) return;
    setOrbit((o) => ({
      yaw: o.yaw + (e.clientX - prev.x) * 0.005,
      pitch: Math.max(
        -1.4,
        Math.min(1.4, o.pitch - (e.clientY - prev.y) * 0.005),
      ),
    }));
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const choose = (i: number) => {
    if (moved.current) return;
    if (sel === i) {
      setSel(null);
      return;
    }
    setSel(i);
    setTrail((t) => (t[t.length - 1] === i ? t : [...t.slice(-6), i]));
  };

  const order = graph.nodes
    .map((_, i) => i)
    .sort((a, b) => proj[b]!.z - proj[a]!.z);
  const edges = graph.edges.filter(
    (e) =>
      focus === null ||
      near!.has(e.a) ||
      near!.has(e.b) ||
      e.kind === "mechanism",
  );

  return (
    <section
      className="reasoning-space fixed inset-0 z-50 bg-background"
      aria-label="Päättelyavaruus"
    >
      <style>{RS_CSS}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full touch-none select-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => {
          up(e);
          if (moved.current) return;
          const hit = (
            document.elementFromPoint(e.clientX, e.clientY) as Element | null
          )?.closest("[data-i]");
          if (hit) choose(Number(hit.getAttribute("data-i")));
          else setSel(null);
        }}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onWheel={(e) => {
          idle.current = performance.now();
          setZoom((z) =>
            Math.min(5, Math.max(0.5, z * Math.exp(-e.deltaY * 0.0015))),
          );
        }}
      >
        <defs>
          <radialGradient id="rs-glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        {edges.map((e, k) => {
          const a = proj[e.a]!,
            b = proj[e.b]!;
          const lit = focus !== null && (e.a === focus || e.b === focus);
          const echoed =
            focus !== null && !lit && echo!.has(e.a) && echo!.has(e.b);
          const alpha =
            Math.min(fog(a.z), fog(b.z)) *
            (focus === null ? 1 : lit ? 1.4 : echoed ? 0.6 : 0.12);
          const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.12,
            my = (a.y + b.y) / 2 + (b.x - a.x) * 0.12;
          const d = `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
          if (e.kind === "member")
            return (
              <path
                key={k}
                d={d}
                fill="none"
                stroke={color(e.a)}
                strokeWidth={0.5}
                opacity={alpha * 0.25}
              />
            );
          return (
            <g key={k} style={{ color: color(e.a) }} pointerEvents="none">
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={lit ? 2.4 : 1.1}
                opacity={alpha * 0.5}
              />
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={lit ? 3.2 : 1.6}
                strokeLinecap="round"
                strokeDasharray="2 22"
                opacity={Math.min(1, alpha)}
                className={lit ? "rs-flow rs-fast" : "rs-flow"}
              />
            </g>
          );
        })}
        {trail.length > 1 && (
          <polyline
            points={trail.map((i) => `${proj[i]!.x},${proj[i]!.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="1 6"
            opacity={0.5}
            pointerEvents="none"
          />
        )}
        {order.map((i) => {
          const n = graph.nodes[i]!,
            p = proj[i]!;
          const w = weight(i),
            a = fog(p.z) * w;
          const base =
            n.kind === "theme"
              ? 9
              : n.kind === "conclusion"
                ? 3
                : 2.5 + Math.sqrt(degree[i]!) * 1.6;
          const r = base * p.s * 1.4 * (i === focus ? 1.8 : 1);
          // Keep the overview quiet; name all highlighted local node kinds,
          // plus any explicitly hovered, focused or selected point.
          const showLabel =
            i === sel ||
            i === hover ||
            (focus === null ? n.kind === "concept" && p.z < 250 : w >= 0.45);
          const label = n.label.trim() || n.id;
          return (
            <g
              key={i}
              style={{ color: color(i) }}
              className="cursor-pointer"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              data-i={i}
              data-node-kind={n.kind}
              data-label-context={
                focus === null ? "overview" : w >= 0.45 ? "local" : "background"
              }
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={sel === i}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  moved.current = false;
                  idle.current = performance.now();
                  choose(i);
                }
              }}
            >
              <title>{label}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={r * 4}
                fill="url(#rs-glow)"
                opacity={a * (i === focus ? 0.7 : 0.25)}
                className={
                  sel !== null && near!.has(i) && i !== sel
                    ? "rs-pulse"
                    : undefined
                }
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={Math.max(1.5, r)}
                fill="currentColor"
                opacity={a}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={Math.max(14, r * 3)}
                fill="transparent"
              />
              {showLabel && (
                <text
                  x={p.x}
                  y={p.y - r - 8}
                  textAnchor="middle"
                  className="rs-label"
                  fontSize={Math.max(
                    13,
                    Math.min(28, p.s * (i === focus ? 26 : 16)),
                  )}
                  opacity={
                    focus === null && i !== hover && i !== sel
                      ? Math.max(0.35, 1 - (p.z + 300) / 600)
                      : 1
                  }
                  fontWeight={i === focus ? 600 : 400}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <button
        type="button"
        onClick={onClose}
        aria-label="Takaisin atlakseen"
        className="absolute left-4 top-4 h-9 w-9 rounded-full border border-border/40 text-muted-foreground opacity-50 transition hover:opacity-100"
      >
        ←
      </button>
    </section>
  );
}
