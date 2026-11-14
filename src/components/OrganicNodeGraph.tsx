import type { AtlasData } from "@/lib/atlas.functions";
import { catalogueFor } from "@/lib/teema.system";
import { ThemeSelectionDetails } from "./ThemeSelectionDetails";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildForceGraph,
  layoutForceGraph,
  neighbours,
  type ForceKind,
} from "@/lib/atlas.force-graph";
import { rotate, perspective, type Orbit } from "@/lib/teema.camera";

const W = 1000,
  H = 760,
  PALETTE = 8;
const KIND_LABEL: Record<ForceKind, string> = {
  theme: "Teema",
  conclusion: "Päätelmä",
  concept: "Käsite",
};

export function OrganicNodeGraph({
  active = true,
  data,
}: {
  active?: boolean;
  data: AtlasData;
}) {
  const catalog = catalogueFor(data);
  const graph = useMemo(
    () => layoutForceGraph(buildForceGraph(catalog.themes)),
    [catalog],
  );
  const [orbit, setOrbit] = useState<Orbit>({ yaw: 0.4, pitch: -0.25 });
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  const [show, setShow] = useState<Record<ForceKind, boolean>>({
    theme: true,
    conclusion: true,
    concept: true,
  });
  const [spin, setSpin] = useState(true);
  const [full, setFull] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!active || !spin || sel !== null) return;
    let raf = 0,
      last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - last, 50);
      last = t;
      setOrbit((o) => ({ ...o, yaw: o.yaw + dt * 0.00008 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, spin, sel]);

  useEffect(() => {
    if (!full) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [full]);

  const near = useMemo(
    () => (sel === null ? null : neighbours(graph, sel)),
    [graph, sel],
  );
  const proj = graph.nodes.map((n) => {
    const r = rotate(n.p, orbit),
      s = perspective(r.z * 2.2) * zoom * 0.6;
    return { x: W / 2 + r.x * s, y: H / 2 + r.y * s, z: r.z, s };
  });
  const visible = (i: number) => show[graph.nodes[i]!.kind];
  const order = graph.nodes
    .map((_, i) => i)
    .filter(visible)
    .sort((a, b) => proj[b]!.z - proj[a]!.z);
  const color = (i: number) =>
    `var(--constellation-${(graph.nodes[i]!.themes[0]! % PALETTE) + 1})`;
  const depthAlpha = (z: number) => Math.max(0.25, Math.min(1, 0.75 - z / 900));

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (pinch.current)
        setZoom((z) => Math.min(4, Math.max(0.5, (z * d) / pinch.current!)));
      pinch.current = d;
      moved.current = true;
      return;
    }
    const dx = e.clientX - prev.x,
      dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
    setOrbit((o) => ({
      yaw: o.yaw + dx * 0.006,
      pitch: Math.max(-1.4, Math.min(1.4, o.pitch - dy * 0.006)),
    }));
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const s = sel === null ? null : graph.nodes[sel]!;
  const links =
    sel === null ? [] : graph.edges.filter((e) => e.a === sel || e.b === sel);

  return (
    <section
      className={`organic-graph ${full ? "fixed inset-0 z-50" : "relative"} bg-background text-foreground`}
      aria-label="Orgaaninen 3D-solmuverkko"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3 text-xs">
        <strong className="mr-2 text-sm">☍ Solmuverkko</strong>
        {(Object.keys(KIND_LABEL) as ForceKind[]).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={show[k]}
              onChange={(e) => setShow({ ...show, [k]: e.target.checked })}
            />
            {KIND_LABEL[k]}
          </label>
        ))}
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            className="rounded border border-border px-2 py-1"
            onClick={() => setZoom((z) => Math.min(4, z * 1.25))}
          >
            ＋
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1"
            onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))}
          >
            －
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1"
            aria-pressed={spin}
            onClick={() => setSpin(!spin)}
          >
            {spin ? "Pysäytä pyöritys" : "Pyöritä"}
          </button>
          <button
            type="button"
            className="rounded border border-border px-2 py-1"
            onClick={() => setFull(!full)}
          >
            {full ? "Sulje koko näyttö" : "Koko näyttö"}
          </button>
        </span>
      </header>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`block w-full touch-none select-none ${full ? "h-[calc(100vh-49px)]" : "h-auto"}`}
          style={{ cursor: "grab" }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(e) =>
            setZoom((z) =>
              Math.min(4, Math.max(0.5, z * Math.exp(-e.deltaY * 0.0015))),
            )
          }
          onClick={() => {
            if (!moved.current) setSel(null);
          }}
        >
          <defs>
            <marker
              id="organic-direction"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0L10 5L0 10" fill="none" stroke="context-stroke" />
            </marker>
            <radialGradient id="og-glow">
              <stop offset="0" stopColor="var(--foreground)" stopOpacity=".9" />
              <stop offset="1" stopColor="var(--foreground)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {graph.edges.map((e, i) => {
            if (!visible(e.a) || !visible(e.b)) return null;
            const a = proj[e.a]!,
              b = proj[e.b]!,
              hot = sel !== null && (e.a === sel || e.b === sel);
            const op =
              sel !== null
                ? hot
                  ? 0.9
                  : 0.04
                : depthAlpha((a.z + b.z) / 2) *
                  (e.kind === "mechanism" ? 0.55 : 0.18);
            return (
              <line
                markerEnd={
                  e.kind === "mechanism" ? "url(#organic-direction)" : undefined
                }
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  e.kind === "mechanism"
                    ? color(e.a)
                    : "var(--muted-foreground)"
                }
                strokeOpacity={op}
                strokeWidth={
                  (e.kind === "mechanism" ? 1.6 : 0.8) * (hot ? 1.8 : 1)
                }
                strokeDasharray={e.kind === "member" ? "3 4" : undefined}
              />
            );
          })}
          {order.map((i) => {
            const n = graph.nodes[i]!,
              p = proj[i]!;
            const r =
              (n.kind === "theme" ? 14 : n.kind === "concept" ? 6 : 4.5) * p.s;
            const dim = near && !near.has(i);
            const op = dim ? 0.12 : depthAlpha(p.z);
            const showLabel =
              n.kind === "theme" || (near?.has(i) ?? false) || zoom * p.s > 2.2;
            return (
              <g
                role="button"
                tabIndex={0}
                aria-label={n.label}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setSel(i);
                    setPanelOpen(true);
                  }
                }}
                key={n.id}
                opacity={op}
                style={{ cursor: "pointer" }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (!moved.current) {
                    setSel(i);
                    setPanelOpen(true);
                  }
                }}
              >
                {n.kind === "theme" && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r * 2.6}
                    fill="url(#og-glow)"
                    opacity={0.18}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(r, 2)}
                  fill={
                    n.kind === "conclusion" ? "var(--foreground)" : color(i)
                  }
                  stroke={
                    i === sel
                      ? "var(--foreground)"
                      : n.themes.length > 1
                        ? color(i)
                        : "none"
                  }
                  strokeWidth={i === sel ? 3 : 1.5}
                />
                {showLabel && (
                  <text
                    x={p.x}
                    y={p.y - r - 6}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={n.kind === "theme" ? 15 : 11}
                    style={{
                      pointerEvents: "none",
                      paintOrder: "stroke",
                      stroke: "var(--background)",
                      strokeWidth: 3,
                    }}
                  >
                    {n.label.length > 42 ? n.label.slice(0, 40) + "…" : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {s && !panelOpen && (
          <button
            type="button"
            aria-label="Avaa tietolaatikko"
            onClick={() => setPanelOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-lg border border-r-0 border-border bg-card/95 px-1.5 py-4 text-xs shadow-lg backdrop-blur transition-colors hover:bg-accent"
          >
            ◂ Tiedot
          </button>
        )}
        <aside
          aria-hidden={!panelOpen}
          className={`absolute inset-y-0 right-0 flex w-[min(340px,85%)] flex-col border-l border-border bg-card/95 text-sm shadow-lg backdrop-blur transition-transform duration-300 ease-out ${
            panelOpen && s
              ? "translate-x-0"
              : "pointer-events-none translate-x-full"
          }`}
        >
          <button
            type="button"
            aria-label="Sulje tietolaatikko"
            onClick={() => setPanelOpen(false)}
            className="absolute -left-7 top-1/2 flex h-14 w-7 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-border bg-card/95 text-xs shadow-lg backdrop-blur transition-colors hover:bg-accent"
          >
            ▸
          </button>
          {s && (
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {KIND_LABEL[s.kind]}
                {s.themes.length > 1 ? ` · ${s.themes.length} teemassa` : ""}
              </p>
              <h3 className="mt-1 font-semibold leading-snug">{s.label}</h3>
              {catalog.themes[s.themes[0]!] && (
                <ThemeSelectionDetails
                  data={data}
                  theme={
                    catalog.themes.find((t) =>
                      t.concepts.some((c) => `K:${c.id}` === s.id),
                    ) ?? catalog.themes[s.themes[0]!]!
                  }
                  kind={s.kind === "theme" ? "theme" : s.kind}
                  label={s.id.startsWith("K:") ? s.id.slice(2) : undefined}
                  index={
                    s.kind === "conclusion"
                      ? catalog.themes[s.themes[0]!]!.conclusions.findIndex(
                          (c) => `P:${c.id}` === s.id,
                        )
                      : 0
                  }
                />
              )}
              <ul className="mt-3 space-y-1 text-xs">
                {links.map((e, k) => {
                  const o = e.a === sel ? e.b : e.a;
                  return (
                    <li key={k}>
                      {e.kind === "mechanism" && (
                        <details>
                          <summary>{e.label}</summary>
                          {catalog.themes
                            .flatMap((t) => t.mechanisms)
                            .filter((m) => m.id === e.referenceId)
                            .map((m) => (
                              <div key={m.id}>
                                <p>
                                  {m.from} → {m.to}
                                </p>
                                <p>{m.d}</p>
                                <p>Ehdot: {m.conditions}</p>
                                <p>Rajaus: {m.m}</p>
                                <p>Tila: {m.reviewStatus}</p>
                              </div>
                            ))}
                        </details>
                      )}
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setSel(o)}
                      >
                        {e.kind === "mechanism" ? "⟶ " : "· "}
                        {graph.nodes[o]!.label}
                        {e.label ? (
                          <span className="text-muted-foreground">
                            {" "}
                            — {e.label}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="mt-3 self-start rounded border border-border px-2 py-1 text-xs"
                onClick={() => setSel(null)}
              >
                Näytä koko verkko
              </button>
            </div>
          )}
        </aside>
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
          Raahaa pyörittääksesi · nipistä tai rullaa zoomataksesi · nuoli =
          kirjattu mekanismiehdotus, katkoviiva = teemajäsenyys. Sijainti kuvaa
          kytkentöjä, ei vaikutuksen suuruutta.
        </p>
      </div>
    </section>
  );
}
