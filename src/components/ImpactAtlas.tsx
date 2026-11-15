import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import {
  buildImpactGraph,
  impactNeighborhood,
  impactCurve,
  fitImpact,
  type ImpactCamera,
  type ImpactDirection,
} from "@/lib/atlas.impact";
import { assessMechanism } from "@/lib/atlas.context";
import { GraphExplore, useGraphExplore } from "./GraphExplore";
import "@/styles/impact-atlas.css";
const wrap = (s: string, n = 27) => {
  const lines: string[] = [];
  for (const word of s.split(/\s+/)) {
    const last = lines.at(-1);
    if (last && (last + " " + word).length <= n)
      lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
};
export function ImpactAtlas({
  data,
  active = true,
}: {
  data: AtlasData;
  active?: boolean;
}) {
  const e = useGraphExplore(data),
    graph = useMemo(() => buildImpactGraph(data), [data]),
    uid = useId().replaceAll(":", ""),
    svgRef = useRef<SVGSVGElement>(null);
  const [direction, setDirection] = useState<ImpactDirection>("effects"),
    [depth, setDepth] = useState(1),
    [overview, setOverview] = useState(!e.current),
    [query, setQuery] = useState(""),
    [theme, setTheme] = useState<string | null>(null),
    [mini, setMini] = useState(true),
    [hover, setHover] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 760 }),
    [camera, setCamera] = useState<ImpactCamera>(() =>
      fitImpact(graph.nodes, 1280 / 760),
    );
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    origin = useRef({ x: 0, y: 0 }),
    moved = useRef(false);
  const excluded = new Set(
    graph.edges
      .filter(
        (m) =>
          assessMechanism(data, m, e.context, e.steps).status === "outside",
      )
      .map((m) => m.id),
  );
  const scene = impactNeighborhood(
      graph,
      e.current,
      e.steps,
      direction,
      depth,
      excluded,
    ),
    ratio = viewport.width / viewport.height,
    k = viewport.width / camera.width;
  const visible = (id: string) =>
    overview
      ? !theme || graph.nodes.find((n) => n.id === id)?.themes.includes(theme)
      : scene.nodes.has(id);
  const color = (id: string) =>
    `var(--constellation-${
      (Math.max(
        0,
        graph.themes.findIndex((t) => t.id === id),
      ) %
        8) +
      1
    })`;
  const routeIds = new Set(e.steps.map((s) => s.id));
  const fitScene = () => {
    setOverview(false);
    setTheme(null);
    setCamera(
      fitImpact(
        graph.nodes.filter((n) => scene.nodes.has(n.id)),
        ratio,
      ),
    );
  };
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      if (r.width && r.height) {
        setViewport({ width: r.width, height: r.height });
        setCamera((c) => {
          const height = (c.width * r.height) / r.width;
          return { ...c, y: c.y + c.height / 2 - height / 2, height };
        });
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(svg);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    if (!active) {
      e.setPreview(null);
      return;
    }
    if (e.current) {
      setOverview(false);
      setTheme(null);
      setCamera(
        fitImpact(
          graph.nodes.filter((n) => scene.nodes.has(n.id)),
          ratio,
        ),
      );
    } else {
      setOverview(true);
      setCamera(fitImpact(graph.nodes, ratio));
    }
  }, [e.current, direction, depth, active]);
  const point = (x: number, y: number, c: ImpactCamera) => {
    const r = svgRef.current?.getBoundingClientRect();
    const width = r?.width || viewport.width,
      height = r?.height || viewport.height;
    return {
      x: c.x + ((x - (r?.left ?? 0)) * c.width) / width,
      y: c.y + ((y - (r?.top ?? 0)) * c.height) / height,
    };
  };
  const zoomAt = (factor: number, x: number, y: number) =>
    setCamera((c) => {
      const p = point(x, y, c),
        width = Math.max(
          220,
          Math.min(graph.bounds.width * 5, c.width * factor),
        ),
        height = width / ratio;
      const fx = (p.x - c.x) / c.width,
        fy = (p.y - c.y) / c.height;
      return { x: p.x - fx * width, y: p.y - fy * height, width, height };
    });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const d =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.height
            : 1);
      if (Math.abs(event.deltaX) > 1 && !event.ctrlKey && !event.metaKey)
        setCamera((c) => ({
          ...c,
          x: c.x + (event.deltaX * c.width) / viewport.width,
          y: c.y + (d * c.height) / viewport.height,
        }));
      else
        zoomAt(
          Math.exp(Math.max(-1, Math.min(1, d * 0.0018))),
          event.clientX,
          event.clientY,
        );
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [ratio, viewport.width, viewport.height, graph.bounds.width]);
  const choose = (id: string) => {
    if (moved.current) return;
    if (!e.current || overview) {
      e.start(id);
      setQuery("");
      setTheme(null);
      return;
    }
    if (routeIds.has(id) || scene.distance.get(id) === 1) {
      e.pick(id);
      return;
    }
  };
  const preview = (id: string | null) => {
    setHover(id);
    if (id && scene.distance.get(id) === 1) e.setPreview({ target: id });
    else e.setPreview(null);
  };
  const current = graph.nodes.find((n) => n.id === e.current),
    next = graph.nodes.filter(
      (n) =>
        scene.distance.get(n.id) === 1 &&
        !routeIds.has(n.id) &&
        e.candidate(n.id),
    );
  const timeEdges = e.steps.flatMap((s) => {
    const m = s.via ? e.describe(s.via) : undefined;
    const statement = data.evidence?.reasoning?.statements.find(
      (x) => x.id === m?.statementId,
    );
    return statement ? [{ m, statement }] : [];
  });
  return (
    <section
      className="impact-atlas"
      aria-label="Vaikutusketjujen visuaalinen atlas"
    >
      <header className="impact-heading">
        <div>
          <p>Vaikutusketjut · 1850–2050</p>
          <h2>Mistä vaikutus alkaa, minne se haarautuu?</h2>
          <span>
            Valitse aloitus. Seuraa nuolia, avaa haaroja ja säilytä yhteys
            kokonaisuuteen.
          </span>
        </div>
        <div className="impact-count">
          <strong>{graph.nodes.length}</strong> käsitettä ·{" "}
          <strong>{graph.edges.length}</strong> kirjattua mekanismia
        </div>
      </header>
      <div className="impact-start">
        <label>
          Hae aloituspiste
          <input
            aria-label="Hae vaikutusketjun aloituspiste"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Esim. tuottavuus, työkyky, toimeentulo"
          />
        </label>
        {query.trim() && (
          <div className="impact-search-results">
            {graph.nodes
              .filter((n) =>
                n.label
                  .toLocaleLowerCase("fi")
                  .includes(query.toLocaleLowerCase("fi")),
              )
              .slice(0, 8)
              .map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => {
                    e.start(n.id);
                    setQuery("");
                  }}
                >
                  {n.label}
                </button>
              ))}
          </div>
        )}
        <span>Aloita esimerkiksi</span>
        {[
          "labour_productivity",
          "work_accommodation",
          "service_digitalisation",
        ].flatMap((id) => {
          const n = graph.nodes.find((n) => n.id === id);
          return n
            ? [
                <button type="button" key={id} onClick={() => e.start(id)}>
                  {n.label}
                </button>,
              ]
            : [];
        })}
      </div>
      <div className="impact-toolbar">
        <div role="group" aria-label="Vaikutuksen tutkimissuunta">
          {(
            [
              ["effects", "Seuraukset →"],
              ["causes", "← Taustatekijät"],
              ["both", "Molemmat suunnat"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={direction === id}
              onClick={() => setDirection(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Vaikutushaarojen syvyys">
          {[1, 2, 3].map((d) => (
            <button
              type="button"
              key={d}
              aria-pressed={depth === d}
              onClick={() => setDepth(d)}
            >
              {d} {d === 1 ? "askel" : "askelta"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setOverview(true);
            setTheme(null);
            setCamera(fitImpact(graph.nodes, ratio));
          }}
        >
          Näytä kokonaiskuva
        </button>
        {e.current && (
          <button type="button" onClick={fitScene}>
            Palaa polkuun
          </button>
        )}
      </div>
      <div className="impact-stage">
        <svg
          ref={svgRef}
          className="impact-canvas"
          viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
          aria-label="Vaikutusten eteneminen ja haarautuminen"
          data-current={e.current ?? ""}
          data-depth={depth}
          data-camera-x={camera.x}
          data-camera-y={camera.y}
          data-camera-width={camera.width}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (!pointers.current.size) {
              moved.current = false;
              origin.current = { x: event.clientX, y: event.clientY };
            }
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            if (
              event.isTrusted &&
              !(event.target as Element).closest('[role="button"]')
            )
              event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const old = pointers.current.get(event.pointerId);
            if (!old) return;
            const before = [...pointers.current.values()];
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const after = [...pointers.current.values()];
            if (
              Math.hypot(
                event.clientX - origin.current.x,
                event.clientY - origin.current.y,
              ) > 6
            )
              moved.current = true;
            if (before.length > 1 && after.length > 1) {
              moved.current = true;
              const a = before[0]!,
                b = before[1]!,
                aa = after[0]!,
                bb = after[1]!,
                distance = Math.hypot(a.x - b.x, a.y - b.y),
                nextDistance = Math.hypot(aa.x - bb.x, aa.y - bb.y);
              if (!distance || !nextDistance) return;
              setCamera((c) => {
                const anchor = point((a.x + b.x) / 2, (a.y + b.y) / 2, c),
                  width = Math.max(
                    220,
                    Math.min(
                      graph.bounds.width * 5,
                      (c.width * distance) / nextDistance,
                    ),
                  ),
                  height = width / ratio,
                  r = svgRef.current?.getBoundingClientRect();
                return {
                  x:
                    anchor.x -
                    (((aa.x + bb.x) / 2 - (r?.left ?? 0)) * width) /
                      (r?.width || viewport.width),
                  y:
                    anchor.y -
                    (((aa.y + bb.y) / 2 - (r?.top ?? 0)) * height) /
                      (r?.height || viewport.height),
                  width,
                  height,
                };
              });
            } else if (moved.current)
              setCamera((c) => ({
                ...c,
                x: c.x - ((event.clientX - old.x) * c.width) / viewport.width,
                y: c.y - ((event.clientY - old.y) * c.height) / viewport.height,
              }));
          }}
          onPointerUp={(event) => pointers.current.delete(event.pointerId)}
          onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
        >
          <defs>
            <marker
              id={`impact-arrow-${uid}`}
              viewBox="0 0 10 10"
              refX="19"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth={12 / k}
              markerHeight={12 / k}
              orient="auto"
            >
              <path
                d="M1 1L9 5L1 9"
                fill="none"
                stroke="context-stroke"
                strokeWidth="1.5"
              />
            </marker>
          </defs>
          {graph.edges.map((m) => {
            const selected = e.chosen(m.id),
              shown = overview || scene.edges.has(m.id),
              first = m.from === e.current || m.to === e.current,
              hot = e.edgePreview(m.id) || hover === m.from || hover === m.to,
              curve = impactCurve(graph, m),
              target = m.from === e.current ? m.to : m.from,
              canFollow = first && next.some((n) => n.id === target),
              isCausal = m.basis === "causal" && m.reviewStatus === "accepted";
            return (
              <g
                key={m.id}
                className={`impact-edge${selected ? " selected" : ""}${hot ? " preview" : ""}${isCausal ? " causal" : " proposed"}${shown ? "" : " background"}`}
                data-impact-mechanism={m.id}
                data-chosen={selected}
                data-visible={shown}
              >
                <path
                  d={curve.d}
                  className="impact-edge-line"
                  markerEnd={`url(#impact-arrow-${uid})`}
                  vectorEffect="non-scaling-stroke"
                />
                {shown && !overview && (
                  <path
                    d={curve.d}
                    className="impact-edge-flow"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {shown && !overview && (first || hot) && (
                  <text
                    className="impact-edge-label"
                    x={curve.x}
                    y={curve.y - 14 / k}
                    textAnchor="middle"
                    fontSize={11 / k}
                  >
                    {wrap(m.label, 32).map((line, i) => (
                      <tspan key={i} x={curve.x} dy={i ? 13 / k : 0}>
                        {line}
                      </tspan>
                    ))}
                    <title>
                      {m.explanation} {m.conditions}
                    </title>
                  </text>
                )}
                {shown && !overview && (
                  <path
                    d={curve.d}
                    className="impact-edge-hit"
                    strokeWidth="22"
                    vectorEffect="non-scaling-stroke"
                    role="button"
                    tabIndex={0}
                    aria-label={`${canFollow ? "Jatka" : "Tutki perustetta"}: ${m.label}`}
                    onMouseEnter={() => {
                      setHover(m.from);
                      if (first) e.setPreview({ target, via: m.id });
                    }}
                    onMouseLeave={() => preview(null)}
                    onFocus={() => {
                      if (first) e.setPreview({ target, via: m.id });
                    }}
                    onBlur={() => preview(null)}
                    onClick={() => {
                      if (moved.current) return;
                      if (canFollow) e.pick(target, m.id);
                      else e.inspect("mechanism", m.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (canFollow) e.pick(target, m.id);
                        else e.inspect("mechanism", m.id);
                      }
                    }}
                  />
                )}
              </g>
            );
          })}
          {graph.nodes.map((n) => {
            const shown = visible(n.id),
              selected = routeIds.has(n.id),
              focus = n.id === e.current,
              candidate = !overview && next.some((x) => x.id === n.id),
              future =
                !overview && (scene.distance.get(n.id) ?? 0) > 1 && !selected,
              canChoose = overview || !e.current || selected || candidate,
              showLabel =
                (shown && !overview) ||
                hover === n.id ||
                (theme && shown) ||
                camera.width < 750;
            const stroke = color(n.themes[0] ?? ""),
              radius = (focus ? 10 : selected ? 8 : candidate ? 7 : 3.5) / k;
            return (
              <g
                key={n.id}
                className={`impact-node${selected ? " selected" : ""}${focus ? " current" : ""}${candidate ? " candidate" : ""}${future ? " future" : ""}${shown ? "" : " background"}`}
                role="button"
                tabIndex={shown ? 0 : -1}
                aria-label={n.label}
                aria-disabled={!canChoose}
                data-impact-node={n.id}
                data-distance={scene.distance.get(n.id)}
                data-selected={selected}
                data-candidate={candidate}
                onMouseEnter={() => preview(n.id)}
                onMouseLeave={() => preview(null)}
                onFocus={() => preview(n.id)}
                onBlur={() => preview(null)}
                onClick={() => choose(n.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    choose(n.id);
                  }
                }}
              >
                <title>
                  {future ? "Etene tähän näkyvien väliaskeleiden kautta. " : ""}
                  {n.definition}
                </title>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={Math.max(radius, 20 / k)}
                  fill="transparent"
                />
                {(candidate || focus) && (
                  <circle
                    className="impact-node-ring"
                    cx={n.x}
                    cy={n.y}
                    r={radius + 6 / k}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.5 / k}
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={radius}
                  fill={stroke}
                  stroke={focus ? "var(--foreground)" : "var(--background)"}
                  strokeWidth={2 / k}
                />
                {selected && (
                  <text
                    x={n.x - 15 / k}
                    y={n.y + 4 / k}
                    textAnchor="end"
                    className="impact-node-number"
                    fontSize={12 / k}
                  >
                    {e.steps.findIndex((s) => s.id === n.id) + 1}
                  </text>
                )}
                {showLabel && (
                  <text
                    x={n.x}
                    y={n.y + 23 / k}
                    textAnchor="middle"
                    className="impact-node-label"
                    fontSize={13 / k}
                  >
                    {wrap(n.label).map((line, i) => (
                      <tspan key={i} x={n.x} dy={i ? 15 / k : 0}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
                {showLabel &&
                  n.themes
                    .slice(1, 4)
                    .map((t, i) => (
                      <circle
                        key={t}
                        cx={n.x + ((i - 1) * 7) / k}
                        cy={n.y - 15 / k}
                        r={2.5 / k}
                        fill={color(t)}
                      />
                    ))}
              </g>
            );
          })}
        </svg>
        <div className="impact-zoom">
          <button
            type="button"
            aria-label="Lähennä vaikutusketjua"
            onClick={() =>
              setCamera((c) => {
                const width = Math.max(220, c.width * 0.7),
                  height = width / ratio;
                return {
                  x: c.x + (c.width - width) / 2,
                  y: c.y + (c.height - height) / 2,
                  width,
                  height,
                };
              })
            }
          >
            ＋
          </button>
          <button
            type="button"
            aria-label="Loitonna vaikutusketjua"
            onClick={() =>
              setCamera((c) => {
                const width = Math.min(graph.bounds.width * 5, c.width * 1.4),
                  height = width / ratio;
                return {
                  x: c.x + (c.width - width) / 2,
                  y: c.y + (c.height - height) / 2,
                  width,
                  height,
                };
              })
            }
          >
            －
          </button>
        </div>
        <div className={`impact-minimap${mini ? " open" : ""}`}>
          <button
            type="button"
            aria-expanded={mini}
            onClick={() => setMini(!mini)}
          >
            Kokonaiskartta {mini ? "−" : "+"}
          </button>
          {mini && (
            <svg
              viewBox={`${graph.bounds.x} ${graph.bounds.y} ${graph.bounds.width} ${graph.bounds.height}`}
              aria-label="Vaikutusketjun sijainti kokonaisverkossa"
              role="img"
            >
              {graph.edges.map((m) => {
                const a = graph.nodes.find((n) => n.id === m.from)!,
                  b = graph.nodes.find((n) => n.id === m.to)!;
                return (
                  <line
                    key={m.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={e.chosen(m.id) ? "chosen" : ""}
                  />
                );
              })}
              {graph.nodes.map((n) => (
                <circle
                  key={n.id}
                  cx={n.x}
                  cy={n.y}
                  r={routeIds.has(n.id) ? 16 : 7}
                  fill={color(n.themes[0] ?? "")}
                  opacity={routeIds.has(n.id) ? 1 : 0.5}
                />
              ))}
              <rect
                className="impact-viewport"
                x={camera.x}
                y={camera.y}
                width={camera.width}
                height={camera.height}
              />
            </svg>
          )}
        </div>
        {e.current && (
          <div className="impact-current" aria-live="polite">
            <strong>{current?.label}</strong>
            <span>
              {next.length
                ? `${next.length} välitöntä jatkopistettä`
                : "Ei kirjattua jatkoa tähän suuntaan"}{" "}
              ·{" "}
              {depth > 1
                ? "Himmeämmät pisteet näyttävät pidemmät mahdolliset haarat"
                : "Valitse seuraava korostettu piste"}
            </span>
            <button
              type="button"
              onClick={() => e.inspect("concept", e.current!)}
            >
              Perustelut ja lähteet
            </button>
          </div>
        )}
        <GraphExplore
          data={data}
          exploration={e}
          onOpenSummary={() => {}}
          onPick={() => {}}
        />
      </div>
      <div className="impact-theme-key" aria-label="Vaikutusketjun teemat">
        {graph.themes.map((t) => (
          <button
            type="button"
            key={t.id}
            aria-pressed={theme === t.id}
            onClick={() => {
              setTheme(theme === t.id ? null : t.id);
              setOverview(true);
              const nodes = graph.nodes.filter(
                (n) => theme === t.id || n.themes.includes(t.id),
              );
              setCamera(fitImpact(nodes, ratio));
            }}
          >
            <i style={{ background: color(t.id) }} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="impact-timeline">
        <svg
          viewBox="0 0 1000 55"
          aria-label="Polun kirjattujen väitteiden ajoitus vuosina 1850–2050"
        >
          <line x1="40" y1="18" x2="960" y2="18" />
          {[1850, 1900, 1950, 2000, 2050].map((year) => (
            <g key={year}>
              <line
                x1={40 + ((year - 1850) / 200) * 920}
                y1="12"
                x2={40 + ((year - 1850) / 200) * 920}
                y2="24"
              />
              <text
                x={40 + ((year - 1850) / 200) * 920}
                y="45"
                textAnchor="middle"
              >
                {year}
              </text>
            </g>
          ))}
          {timeEdges
            .filter(
              (x) =>
                x.statement.start != null &&
                x.statement.end != null &&
                x.statement.end >= 1850 &&
                x.statement.start <= 2050,
            )
            .map(({ m, statement }, i) => (
              <line
                key={`${i}:${m?.id}`}
                className="impact-period"
                x1={
                  40 + ((Math.max(1850, statement.start!) - 1850) / 200) * 920
                }
                x2={Math.max(
                  42 + ((Math.max(1850, statement.start!) - 1850) / 200) * 920,
                  40 + ((Math.min(2050, statement.end!) - 1850) / 200) * 920,
                )}
                y1={18 + ((i % 3) - 1) * 4}
                y2={18 + ((i % 3) - 1) * 4}
              >
                <title>
                  {m?.label}: {statement.start}–{statement.end}
                </title>
              </line>
            ))}
        </svg>
        <span>
          {
            timeEdges.filter(
              (x) => x.statement.start == null || x.statement.end == null,
            ).length
          }{" "}
          yhteydellä avoin ajoitus
        </span>
      </div>
      <p className="impact-note">
        <span className="impact-legend-chosen" /> Valittu reitti{" "}
        <span className="impact-legend-proposed" /> Selitysehdotus · Nuoli
        näyttää kirjatun vaikutussuunnan. Haarat eivät yksin todista koko
        ketjua. Verkon sijainti ei kuvaa vaikutuksen suuruutta tai ajallista
        välimatkaa.
      </p>
    </section>
  );
}
