import { HistoryWall } from "./HistoryWall";
import { spotlightRoutes, orientationSpotlight } from "@/lib/atlas.spotlight";
import { ReaderJourney } from "./ReaderJourney";
import { GraphExplore, useGraphExplore } from "./GraphExplore";
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
.reasoning-space{--rs-9:oklch(.83 .12 200);--rs-10:oklch(.85 .13 115);--rs-11:oklch(.82 .12 315);--rs-12:oklch(.85 .10 45)}
.reasoning-space .rs-mechanism{transition:opacity .45s ease}
.reasoning-space .rs-start-ring{fill:none;stroke:currentColor;stroke-width:1.5;stroke-dasharray:2 6}
.reasoning-space .rs-flow-target{cursor:pointer}
.history-title{paint-order:stroke;stroke:oklch(.11 .03 260);stroke-width:3;stroke-linejoin:round}
.history-heading{fill:oklch(.75 .02 230);font-size:14px;letter-spacing:.05em}
.history-link.recorded{animation:rs-flow 3s linear infinite}
.history-card{box-sizing:border-box;background:oklch(.13 .025 260);border:1px solid oklch(.45 .03 230);border-radius:10px;padding:14px;color:oklch(.94 .02 230);height:250px;overflow:auto;font:14px/1.5 sans-serif}
.history-card h3{font-size:18px;margin:8px 0}.history-card p{margin:6px 0}.history-card button,.history-card a{display:inline-block;padding:5px 8px;margin:3px;border:1px solid oklch(.45 .03 230);border-radius:5px;color:inherit;background:transparent}.history-card small{display:block;opacity:.6;margin-top:8px}
.reasoning-space .rs-guide{position:absolute;bottom:95px;left:18px;font-size:12px;opacity:.65;pointer-events:none;max-width:300px}

.reasoning-space{--rs-1:oklch(0.82 0.10 180);--rs-2:oklch(0.82 0.11 145);--rs-3:oklch(0.84 0.12 95);--rs-4:oklch(0.82 0.12 65);--rs-5:oklch(0.78 0.12 25);--rs-6:oklch(0.80 0.10 335);--rs-7:oklch(0.78 0.10 295);--rs-8:oklch(0.80 0.10 230);color:oklch(0.93 0.015 230);background:oklch(0.11 0.03 260)}
.reasoning-space .rs-label{fill:currentColor;paint-order:stroke;stroke:oklch(0.11 0.03 260);stroke-width:3px;pointer-events:none}
.reasoning-space .rs-flow{animation:rs-flow 2.4s linear infinite}
.reasoning-space .rs-fast{animation-duration:1.1s}
.reasoning-space .rs-pulse{animation:rs-pulse 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes rs-flow{to{stroke-dashoffset:-24}}
@keyframes rs-pulse{50%{transform:scale(1.5);opacity:.6}}
@media (prefers-reduced-motion:reduce){.reasoning-space .rs-flow,.reasoning-space .rs-pulse,.history-link.recorded{animation:none}.reasoning-space .rs-mechanism{transition:none}}
`;
const W = 1600,
  H = 1000,
  PALETTE = 12;

/**
 * Persistent visual network with optional inquiry, source and path-summary controls.
 * Mechanisms retain their recorded direction; membership never becomes causality.
 */
export function ReasoningSpace({
  data,
  onClose,
}: {
  data: AtlasData;
  onClose: () => void;
}) {
  const exploration = useGraphExplore(data);
  const catalog = catalogueFor(data);
  const graph = useMemo(
    () => layoutForceGraph(buildForceGraph(catalog.themes)),
    [catalog],
  );
  const [orbit, setOrbit] = useState<Orbit>({ yaw: 0.4, pitch: -0.2 });
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const idle = useRef(0);
  const routes = useMemo(() => spotlightRoutes(data), [data]);
  const previousSpotlight = useRef<string | undefined>(undefined);
  const rotated = graph.nodes.map((n) => rotate(n.p, orbit));
  const spotlight = orientationSpotlight(
    routes,
    graph,
    rotated,
    previousSpotlight.current,
  );
  useEffect(() => {
    previousSpotlight.current = spotlight?.start;
  }, [spotlight?.start]);
  const spotlightNodes = new Set(spotlight?.nodes.map((id) => `K:${id}`));
  const spotlightEdges = new Set(spotlight?.mechanisms);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      if (
        !reducedMotion &&
        t - idle.current > 2500 &&
        pointers.current.size === 0
      )
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
  }, [sel, onClose, reducedMotion]);

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
    setSel(null);
    setHover(null);
    exploration.setPreview(null);
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
  useEffect(() => {
    if (!exploration.current) return;
    const i = graph.nodes.findIndex((n) => n.id === `K:${exploration.current}`);
    if (i >= 0) setSel(i);
  }, [exploration.current, graph]);
  const choose = (i: number) => {
    if (moved.current) return;
    if (sel === i) {
      setSel(null);
      return;
    }
    const node = graph.nodes[i]!;
    if (node.kind === "concept") {
      const id = node.id.slice(2);
      if (exploration.current && exploration.candidate(id)) {
        const choices = exploration.options.filter(
          (o) => o.target.id === id && o.assessment.status !== "outside",
        );
        if (choices.length === 1)
          exploration.pick(id, choices[0]!.mechanism.id);
        else {
          setSel(i);
          exploration.setPreview({ target: id });
        }
      } else exploration.start(id);
    } else setSel(i);
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
      data-spotlight={spotlight?.start ?? ""}
    >
      <style>{RS_CSS}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="rs-canvas block h-full w-full touch-none select-none"
        tabIndex={0}
        role="group"
        aria-label="Pyöritä vaikutusavaruutta nuolinäppäimillä tai vetämällä"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (
            ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            idle.current = performance.now();
            setSel(null);
            setHover(null);
            setOrbit((o) => ({
              yaw:
                o.yaw +
                (event.key === "ArrowLeft"
                  ? -0.3
                  : event.key === "ArrowRight"
                    ? 0.3
                    : 0),
              pitch: Math.max(
                -1.4,
                Math.min(
                  1.4,
                  o.pitch +
                    (event.key === "ArrowUp"
                      ? 0.2
                      : event.key === "ArrowDown"
                        ? -0.2
                        : 0),
                ),
              ),
            }));
          }
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => {
          up(e);
          if (moved.current) return;
          const element = document.elementFromPoint(
            e.clientX,
            e.clientY,
          ) as Element | null;
          const flow = element?.closest("[data-rs-follow]");
          if (flow) {
            const mechanism = exploration.describe(
              flow.getAttribute("data-rs-follow")!,
            );
            if (mechanism)
              exploration.pick(
                mechanism.from === exploration.current
                  ? mechanism.to
                  : mechanism.from,
                mechanism.id,
              );
            return;
          }
          const hit = element?.closest("[data-i]");
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
          <marker
            id="rs-direction"
            viewBox="0 0 10 10"
            refX="15"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path
              d="M1 1L9 5L1 9"
              fill="none"
              stroke="context-stroke"
              strokeWidth="1.5"
            />
          </marker>
          <radialGradient id="rs-glow">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <HistoryWall
          data={data}
          zoom={zoom}
          mechanismIds={
            sel !== null && graph.nodes[sel]?.kind === "concept"
              ? exploration.options
                  .filter(
                    (o) => !o.incoming && o.assessment.status !== "outside",
                  )
                  .map((o) => o.mechanism.id)
              : (spotlight?.mechanisms ?? [])
          }
          themeIds={
            (sel !== null
              ? graph.nodes[sel]?.themes
              : graph.nodes.find((n) => n.id === `K:${spotlight?.start}`)
                  ?.themes
            )?.map((i) => catalog.themes[i]!.id) ?? []
          }
          origin={(() => {
            const i =
              sel !== null && graph.nodes[sel]?.kind === "concept"
                ? sel
                : graph.nodes.findIndex(
                    (n) => n.id === `K:${spotlight?.start}`,
                  );
            return i >= 0 ? proj[i]! : null;
          })()}
          onExplore={(theme) => {
            const i = graph.nodes.findIndex((n) => n.id === `T:${theme}`);
            if (i >= 0) setSel(i);
          }}
        />
        {edges.map((e, k) => {
          const a = proj[e.a]!,
            b = proj[e.b]!;
          const chosen =
            e.kind === "mechanism" &&
            !!e.referenceId &&
            exploration.chosen(e.referenceId);
          const mechanism = e.referenceId
            ? exploration.describe(e.referenceId)
            : undefined;
          const causal =
            mechanism?.basis === "causal" &&
            mechanism.reviewStatus === "accepted";
          const inSpotlight =
            !!e.referenceId && spotlightEdges.has(e.referenceId);
          const lit =
            inSpotlight ||
            chosen ||
            exploration.edgePreview(e.referenceId ?? "") ||
            (focus !== null && (e.a === focus || e.b === focus));
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
            <g
              key={k}
              style={{ color: color(e.a) }}
              pointerEvents="none"
              className="rs-mechanism"
              opacity={
                inSpotlight ||
                chosen ||
                exploration.edgePreview(e.referenceId ?? "")
                  ? 1
                  : 0.12
              }
              data-spotlit={inSpotlight}
              data-rs-mechanism={e.referenceId}
              data-chosen={chosen}
            >
              <title>
                {e.label} — {mechanism?.explanation}
              </title>
              {(chosen ||
                exploration.edgePreview(e.referenceId ?? "") ||
                (inSpotlight && mechanism?.from === spotlight?.start)) && (
                <text
                  x={mx}
                  y={my - 12}
                  textAnchor="middle"
                  className="rs-label"
                  fontSize="14"
                >
                  {e.label}
                </text>
              )}
              <path
                d={d}
                fill="none"
                stroke="currentColor"
                strokeDasharray={chosen || causal ? undefined : "6 5"}
                markerEnd="url(#rs-direction)"
                strokeWidth={chosen ? 4 : lit ? 2.4 : 1.1}
                opacity={chosen ? 1 : alpha * 0.5}
              />
              {lit &&
                mechanism &&
                (mechanism.from === exploration.current ||
                  mechanism.to === exploration.current) && (
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    pointerEvents="stroke"
                    className="rs-flow-target"
                    role="button"
                    tabIndex={0}
                    aria-label={`Seuraa: ${mechanism.label}`}
                    data-rs-follow={mechanism.id}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      if (!moved.current)
                        exploration.pick(
                          mechanism.from === exploration.current
                            ? mechanism.to
                            : mechanism.from,
                          mechanism.id,
                        );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        exploration.pick(
                          mechanism.from === exploration.current
                            ? mechanism.to
                            : mechanism.from,
                          mechanism.id,
                        );
                      }
                    }}
                  />
                )}
              {lit && (
                <path
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={lit ? 3.2 : 1.6}
                  strokeLinecap="round"
                  strokeDasharray="2 22"
                  opacity={Math.min(1, alpha)}
                  className="rs-flow rs-fast"
                />
              )}
            </g>
          );
        })}
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
            (focus === null
              ? spotlightNodes.has(n.id) && p.z < 250
              : w >= 0.45);
          const label = n.label.trim() || n.id;
          return (
            <g
              key={i}
              style={{ color: color(i) }}
              className="cursor-pointer"
              onPointerEnter={() => {
                setHover(i);
                const id = n.id.slice(2);
                if (n.kind === "concept" && exploration.candidate(id))
                  exploration.setPreview({ target: id });
              }}
              onPointerLeave={() => {
                setHover((h) => (h === i ? null : h));
                exploration.setPreview(null);
              }}
              data-i={i}
              data-spotlight-start={n.id === `K:${spotlight?.start}`}
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
              {n.id === `K:${spotlight?.start}` && (
                <g pointerEvents="none">
                  <circle
                    className="rs-start-ring"
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(18, r + 10)}
                  />
                  <text
                    x={p.x}
                    y={p.y - r - 33}
                    textAnchor="middle"
                    className="rs-label"
                    fontSize="12"
                  >
                    {catalog.themes[n.themes[0] ?? 0]?.label} · vaikutusketjun
                    alku
                  </text>
                </g>
              )}
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
      <svg
        className="reader-minimap"
        viewBox={`0 0 ${W} ${H}`}
        aria-label="Polun sijainti kokonaisverkossa"
        role="img"
      >
        {graph.edges
          .filter((e) => e.kind === "mechanism")
          .map((edge, i) => {
            const a = proj[edge.a]!,
              b = proj[edge.b]!;
            return (
              <line
                key={i}
                x1={W / 2 + (a.x - W / 2) / zoom}
                y1={H / 2 + (a.y - H / 2) / zoom}
                x2={W / 2 + (b.x - W / 2) / zoom}
                y2={H / 2 + (b.y - H / 2) / zoom}
                stroke={color(edge.a)}
                strokeWidth={
                  edge.referenceId && exploration.chosen(edge.referenceId)
                    ? 12
                    : 3
                }
                opacity={
                  edge.referenceId && exploration.chosen(edge.referenceId)
                    ? 1
                    : 0.2
                }
              />
            );
          })}
        {graph.nodes.map((n, i) => (
          <circle
            key={n.id}
            cx={W / 2 + (proj[i]!.x - W / 2) / zoom}
            cy={H / 2 + (proj[i]!.y - H / 2) / zoom}
            r={exploration.steps.some((s) => `K:${s.id}` === n.id) ? 15 : 5}
            fill={color(i)}
            opacity={
              exploration.steps.some((s) => `K:${s.id}` === n.id) ? 1 : 0.4
            }
          />
        ))}
      </svg>
      <p className="rs-guide">
        Pyöritä: uusi vaikutusketju nousee esiin. Valitse sen alku ja seuraa
        virtaa.
      </p>
      <ReaderJourney data={data} />
      <GraphExplore
        data={data}
        exploration={exploration}
        onOpenSummary={() => {}}
        onPick={() => {}}
      />
      <div
        className="rs-time-horizon"
        style={{
          position: "absolute",
          bottom: 65,
          right: 18,
          fontSize: 11,
          opacity: 0.65,
        }}
      >
        1850 · 1900 · 1950 · 2000 · 2050 · sijainti ei kuvaa aikaa
      </div>
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
