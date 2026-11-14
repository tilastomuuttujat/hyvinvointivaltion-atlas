import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import {
  buildConceptMap,
  conceptObservations,
  fitMap,
  localPosition,
  mapDepth,
  mechanismStatus,
  observationPosition,
  pathAvailability,
  zoomMap,
  type MapCamera,
  type MapConcept,
  type MapLayout,
} from "@/lib/atlas.concept-map";
import { observationDate } from "@/lib/atlas.evidence";
import {
  relationLabel,
  reviewLabel,
  sourceCheck,
  sourceRefsFor,
  temporalStatus,
} from "@/lib/atlas.navigation";
import "../styles/concept-map.css";
function textLines(text: string, width: number, max = 2) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines
    .slice(0, max)
    .map((l, i) => (i === max - 1 && lines.length > max ? l + "…" : l));
}
const DEPTH = ["Klusterialueet", "Avainkäsitteet", "Havainnot", "Lähteet"];
export function ConceptMap({
  data,
  layout = "field",
  active = true,
}: {
  data: AtlasData;
  layout?: MapLayout;
  active?: boolean;
}) {
  const model = useMemo(() => buildConceptMap(data, layout), [data, layout]);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const fitted = useMemo(
    () => fitMap(size.width, size.height, model.width, model.height),
    [size, model.width, model.height],
  );
  const [camera, setCamera] = useState<MapCamera>(() =>
      fitMap(900, 600, model.width, model.height),
    ),
    [depth, setDepth] = useState(0),
    [motion, setMotion] = useState(false);
  const [clusterId, setClusterId] = useState<string | null>(null),
    [conceptId, setConceptId] = useState<string | null>(null),
    [observationId, setObservationId] = useState<string | null>(null),
    [sourceId, setSourceId] = useState<string | null>(null),
    [periodId, setPeriodId] = useState<string | null>(null),
    [page, setPage] = useState(0);
  const [pathId, setPathId] = useState(model.paths[0]?.id ?? ""),
    [pathStep, setPathStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [reduced, setReduced] = useState(false),
    [mechanismId, setMechanismId] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    oldFrame = useRef({
      width: 900,
      height: 600,
      fit: fitMap(900, 600, model.width, model.height).scale,
    });
  const pointers = useRef(new Map<number, { x: number; y: number }>()),
    drag = useRef<{
      x: number;
      y: number;
      startX: number;
      startY: number;
      target: string | null;
      moved: boolean;
    } | null>(null),
    pinch = useRef<{ distance: number; x: number; y: number } | null>(null),
    suppressClick = useRef(false);
  const uid = useId().replace(/:/g, "");
  const concept = model.concepts.find((c) => c.id === conceptId),
    region = model.regions.find((c) => c.id === clusterId),
    observation = data.evidence?.observations.find(
      (o) => o.id === observationId,
    ),
    mechanism = model.mechanisms.find((m) => m.id === mechanismId);
  const observations = useMemo(
    () => (concept ? conceptObservations(data, concept, periodId) : []),
    [data, concept, periodId],
  );
  const shown = observations.slice(page * 6, page * 6 + 6);
  const sources = useMemo(
    () =>
      data.evidence && observationId
        ? sourceRefsFor(data.evidence, observationId).flatMap((ref) => {
            const source = data.evidence?.reasoning?.sources.find(
              (s) => s.id === ref.sourceId,
            );
            return source ? [{ ref, source }] : [];
          })
        : [],
    [data, observationId],
  );
  const source = sources.find((s) => s.source.id === sourceId);
  const observationPoint =
    concept && observation
      ? observationPosition(concept, observation)
      : undefined;
  const eligibleObservation =
    observation &&
    (!periodId ||
      temporalStatus(
        observation,
        data.periods.find((p) => p.id === periodId) ?? null,
      ) === "inside");
  const route = model.paths.find((p) => p.id === pathId),
    steps = useMemo(
      () => pathAvailability(data, model, pathId, periodId),
      [data, model, pathId, periodId],
    );
  const currentStep = steps[Math.min(pathStep, Math.max(0, steps.length - 1))];
  const visibleMechanisms = useMemo(
    () =>
      model.mechanisms.filter(
        (m) => mechanismStatus(data, m, periodId) !== "outside",
      ),
    [data, model, periodId],
  );
  const routeEdges = new Set(
    steps
      .filter((s) => s.available && s.viaMechanismId)
      .map((s) => s.viaMechanismId!),
  );
  const relativeZoom = camera.scale / fitted.scale;
  useEffect(
    () => setDepth((previous) => mapDepth(relativeZoom, previous)),
    [relativeZoom],
  );
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (box.width > 0 && box.height > 0)
        setSize({
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const old = oldFrame.current;
    setCamera((c) => {
      const x = (old.width / 2 - c.x) / c.scale,
        y = (old.height / 2 - c.y) / c.scale,
        scale = fitted.scale * (c.scale / old.fit);
      return {
        scale,
        x: size.width / 2 - x * scale,
        y: size.height / 2 - y * scale,
      };
    });
    oldFrame.current = { ...size, fit: fitted.scale };
  }, [size, fitted.scale]);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => {
      setReduced(query.matches);
      if (query.matches) setPlaying(false);
    };
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);
  useEffect(() => setPage(0), [periodId, conceptId, pathId]);
  useEffect(() => setPlaying(false), [periodId, pathId]);
  const focus = (point: { x: number; y: number }, zoom: number) => {
    setMotion(true);
    const scale = fitted.scale * zoom;
    setCamera({
      scale,
      x: size.width / 2 - point.x * scale,
      y: size.height / 2 - point.y * scale,
    });
  };
  const openConcept = (c: MapConcept, automatic = false) => {
    if (!automatic) setPlaying(false);
    setClusterId(c.clusterId);
    setConceptId(c.id);
    const routeIndex = steps.findIndex((step) => step.conceptId === c.id);
    if (routeIndex >= 0) setPathStep(routeIndex);
    setObservationId(null);
    setSourceId(null);
    setMechanismId(null);
    setPage(0);
    focus(c, 2.9);
  };
  const openObservation = (id: string) => {
    if (!concept) return;
    const o = data.evidence?.observations.find((o) => o.id === id);
    if (!o) return;
    setPlaying(false);
    setObservationId(id);
    setSourceId(null);
    setMechanismId(null);
    focus(observationPosition(concept, o), 4.5);
  };
  const openSource = (id: string) => {
    if (!observationPoint) return;
    setSourceId(id);
    setPlaying(false);
    focus(localPosition(observationPoint, id, 130, 50), 5.4);
  };
  const follow = (index: number, automatic = false) => {
    const step = steps[index],
      c = model.concepts.find((c) => c.id === step?.conceptId);
    if (!c || !step?.available) return;
    setPathStep(index);
    openConcept(c, automatic);
  };
  useEffect(() => {
    if (!playing || reduced || !active || !route) return;
    if (pathStep >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    if (!steps[pathStep + 1]?.available) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => follow(pathStep + 1, true), 6000);
    return () => clearTimeout(timer);
  }, [playing, pathStep, steps, reduced, active, route]);
  // IDs and world coordinates remain stable; zoom changes visibility, not arrangement.
  const activate = (key: string) => {
    const [kind, ...parts] = key.split("|"),
      id = parts.join("|");
    if (kind === "cluster") {
      const r = model.regions.find((r) => r.id === id);
      if (!r) return;
      setPlaying(false);
      setClusterId(id);
      setConceptId(null);
      setObservationId(null);
      setSourceId(null);
      setMechanismId(null);
      focus({ x: r.x + r.width / 2, y: r.y + r.height / 2 }, 1.9);
    } else if (kind === "concept") {
      const c = model.concepts.find((c) => c.id === id);
      if (c) openConcept(c);
    } else if (kind === "observation") openObservation(id);
    else if (kind === "source") openSource(id);
    else if (kind === "mechanism") {
      setMechanismId(id);
      setClusterId(null);
      setConceptId(null);
      setObservationId(null);
      setSourceId(null);
      setPlaying(false);
    }
  };
  const local = (e: { clientX: number; clientY: number }) => {
    const b = svg.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - b.left) * size.width) / (b.width || size.width),
      y: ((e.clientY - b.top) * size.height) / (b.height || size.height),
    };
  };
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setMotion(false);
      setPlaying(false);
      const a = local(e),
        factor = Math.exp(
          -e.deltaY *
            (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? size.height : 1) *
            0.0015,
        );
      setCamera((c) => zoomMap(c, factor, a, fitted.scale));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [size, fitted.scale]);
  const zoom = (factor: number) => {
    setMotion(false);
    setPlaying(false);
    setCamera((c) =>
      zoomMap(
        c,
        factor,
        { x: size.width / 2, y: size.height / 2 },
        fitted.scale,
      ),
    );
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || (e.target as Element).closest("[data-map-external]"))
      return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    suppressClick.current = false;
    setMotion(false);
    setPlaying(false);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
      drag.current = null;
      suppressClick.current = true;
    } else
      drag.current = {
        ...p,
        startX: p.x,
        startY: p.y,
        target:
          (e.target as Element)
            .closest("[data-map-action]")
            ?.getAttribute("data-map-action") ?? null,
        moved: false,
      };
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pinch.current) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const next = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
        },
        old = pinch.current;
      setCamera((c) =>
        zoomMap(
          { ...c, x: c.x + next.x - old.x, y: c.y + next.y - old.y },
          next.distance / Math.max(1, old.distance),
          next,
          fitted.scale,
        ),
      );
      pinch.current = next;
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(p.x - d.startX, p.y - d.startY) > 5) d.moved = true;
    if (d.moved)
      setCamera((c) => ({ ...c, x: c.x + p.x - d.x, y: c.y + p.y - d.y }));
    d.x = p.x;
    d.y = p.y;
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (!pointers.current.size) pinch.current = null;
      drag.current = null;
      suppressClick.current = true;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (d && !d.moved && d.target) {
      activate(d.target);
      suppressClick.current = true;
    } else suppressClick.current = !!d?.moved;
  };
  const keyAction = (e: React.KeyboardEvent, key: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      activate(key);
    }
  };
  const actionProps = (key: string) => ({
    "data-map-action": key,
    role: "button" as const,
    tabIndex: 0,
    onClick: () => {
      if (!suppressClick.current) activate(key);
    },
    onKeyDown: (e: React.KeyboardEvent) => keyAction(e, key),
  });
  const scale = camera.scale;
  const name = (id: string) =>
    model.concepts.find((c) => c.id === id)?.label ?? id;
  if (!model.regions.length)
    return (
      <section className="concept-map">
        <p>
          Tämä aineistoversio ei sisällä määriteltyjä käsiteklustereita.
          Mittarikenttä ja muut näkymät ovat käytettävissä.
        </p>
      </section>
    );
  return (
    <section
      className="concept-map"
      data-layout={layout}
      aria-label={
        layout === "routes"
          ? "Käsitteiden reittikartta"
          : "Klusteroitu käsitekartta"
      }
    >
      <header className="concept-map-header">
        <div>
          <h2>
            {layout === "routes"
              ? "Seuraa selityksen reittiä"
              : "Tutki käsitteitä karttana"}
          </h2>
          <p>
            {model.regions.length} käsitealuetta · {model.concepts.length}{" "}
            määriteltyä avainkäsitettä. Sijainti ja reitin pituus ovat
            navigointia, eivät vaikutuksen mittareita.
          </p>
        </div>
        <label>
          Aikakausi
          <select
            aria-label="Käsitekartan aikakausi"
            value={periodId ?? ""}
            onChange={(e) => setPeriodId(e.target.value || null)}
          >
            <option value="">Kaikki aikakaudet</option>
            {data.periods.map((p) => (
              <option value={p.id} key={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="concept-map-status">
        <span aria-live="polite">
          {DEPTH[depth]} · {relativeZoom.toFixed(1)}×
        </span>
        <span>
          Lähennä alueeseen, valitse käsite ja avaa sen havainnot tai seuraa
          valmista polkua.
        </span>
      </div>
      <div className="concept-map-layout">
        <div className="concept-map-canvas" ref={canvas}>
          <div className="concept-map-zoom">
            <button
              type="button"
              aria-label="Lähennä käsitekarttaa"
              onClick={() => zoom(1.4)}
            >
              ＋
            </button>
            <button
              type="button"
              aria-label="Loitonna käsitekarttaa"
              onClick={() => zoom(1 / 1.4)}
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setMotion(false);
                setPlaying(false);
                setCamera(fitted);
              }}
            >
              Yleiskuva
            </button>
          </div>
          <svg
            ref={svg}
            viewBox={`0 0 ${size.width} ${size.height}`}
            data-depth={depth}
            data-zoom={relativeZoom.toFixed(2)}
            role="group"
            tabIndex={0}
            aria-label="Zoomattava käsitekartta. Plus ja miinus lähentävät, nuolinäppäimet siirtävät karttaa."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => {
              pointers.current.clear();
              drag.current = null;
              pinch.current = null;
              suppressClick.current = true;
            }}
            onKeyDown={(e) => {
              if (
                [
                  "+",
                  "-",
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                ].includes(e.key)
              ) {
                e.preventDefault();
                setMotion(false);
                setPlaying(false);
                if (e.key === "+") zoom(1.3);
                else if (e.key === "-") zoom(1 / 1.3);
                else
                  setCamera((c) => ({
                    ...c,
                    x:
                      c.x +
                      (e.key === "ArrowLeft"
                        ? 55
                        : e.key === "ArrowRight"
                          ? -55
                          : 0),
                    y:
                      c.y +
                      (e.key === "ArrowUp"
                        ? 55
                        : e.key === "ArrowDown"
                          ? -55
                          : 0),
                  }));
              }
            }}
          >
            <defs>
              <marker
                id={`${uid}-direction`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0 0L10 5L0 10" fill="var(--warning)" />
              </marker>
            </defs>
            <g
              data-map-world
              transform={`translate(${camera.x} ${camera.y}) scale(${scale})`}
              style={{
                transition:
                  motion && !reduced ? "transform 300ms ease-out" : undefined,
              }}
            >
              {model.regions.map((r) => {
                const font = size.width < 640 ? 12 : 17,
                  labelLines = textLines(
                    r.label,
                    Math.max(
                      14,
                      Math.floor((r.width * scale) / (font * 0.6)) - 5,
                    ),
                    3,
                  );
                return (
                  <g
                    key={r.id}
                    {...actionProps(`cluster|${r.id}`)}
                    aria-label={`Käsitealue: ${r.label}`}
                    className="concept-region"
                  >
                    <rect
                      x={r.x}
                      y={r.y}
                      width={r.width}
                      height={r.height}
                      rx={layout === "routes" ? 35 : 70}
                      fill={r.color}
                      fillOpacity={clusterId === r.id ? 0.14 : 0.055}
                      stroke={r.color}
                      strokeOpacity=".6"
                      strokeWidth={1 / scale}
                    />
                    <text fontSize={font / scale} fill={r.color}>
                      {labelLines.map((line, i) => (
                        <tspan
                          key={i}
                          x={r.x + 18 / scale}
                          y={r.y + (24 + i * (font + 3)) / scale}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                    {depth === 0 && r.height * scale > 100 && (
                      <text
                        x={r.x + 18 / scale}
                        y={r.y + (32 + labelLines.length * (font + 3)) / scale}
                        fontSize={11 / scale}
                        fill="var(--muted-foreground)"
                      >
                        {
                          model.concepts.filter((c) => c.clusterId === r.id)
                            .length
                        }{" "}
                        käsitettä
                      </text>
                    )}
                  </g>
                );
              })}
              {visibleMechanisms.map((m) => {
                const a = model.concepts.find((c) => c.id === m.from)!,
                  b = model.concepts.find((c) => c.id === m.to)!,
                  on = routeEdges.has(m.id),
                  middle = (a.x + b.x) / 2;
                const d =
                  layout === "routes"
                    ? `M${a.x} ${a.y} H${middle} V${b.y} H${b.x}`
                    : `M${a.x} ${a.y} Q${middle} ${Math.min(a.y, b.y) - 110} ${b.x} ${b.y}`;
                return (
                  <g
                    key={m.id}
                    {...actionProps(`mechanism|${m.id}`)}
                    aria-label={`Kirjattu mekanismi: ${m.label}`}
                    className="concept-mechanism"
                  >
                    <title>
                      {m.label} · {reviewLabel(m.reviewStatus)} ·{" "}
                      {m.basis === "causal"
                        ? "kausaaliseksi arvioitu"
                        : "ehdotettu vaikutussuunta"}
                    </title>
                    <path
                      data-mechanism-id={m.id}
                      d={d}
                      fill="none"
                      stroke={on ? "var(--warning)" : "var(--muted-foreground)"}
                      strokeWidth={(on ? 3 : 1.4) / scale}
                      strokeDasharray={
                        m.basis === "causal" && m.reviewStatus === "accepted"
                          ? undefined
                          : `${7 / scale} ${6 / scale}`
                      }
                      opacity={on ? 1 : 0.45}
                      markerEnd={`url(#${uid}-direction)`}
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18 / scale}
                    />
                  </g>
                );
              })}
              {model.concepts.map((c) => (
                <g
                  key={c.id}
                  {...actionProps(`concept|${c.id}`)}
                  data-concept-id={c.id}
                  data-world-x={c.x}
                  data-world-y={c.y}
                  aria-label={`Avainkäsite: ${c.label}`}
                  className="concept-station"
                  opacity={
                    conceptId &&
                    conceptId !== c.id &&
                    !steps.some((s) => s.conceptId === c.id)
                      ? 0.45
                      : 1
                  }
                >
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={(conceptId === c.id ? 10 : 7) / scale}
                    fill={
                      model.regions.find((r) => r.id === c.clusterId)?.color
                    }
                    stroke="var(--background)"
                    strokeWidth={2 / scale}
                  />
                  {conceptId === c.id && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={16 / scale}
                      fill="none"
                      stroke="var(--foreground)"
                      strokeWidth={1 / scale}
                    />
                  )}{" "}
                  {(depth > 0 ||
                    c.id === conceptId ||
                    steps.some((s) => s.conceptId === c.id)) && (
                    <text fontSize={13 / scale}>
                      {textLines(
                        c.label,
                        Math.max(12, Math.floor((220 * scale) / (13 * 0.55))),
                        2,
                      ).map((line, i) => (
                        <tspan
                          key={i}
                          x={c.x + 14 / scale}
                          y={c.y + (5 + i * 15) / scale}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  )}
                </g>
              ))}
              {concept &&
                depth >= 2 &&
                shown.map((o) => {
                  const p = observationPosition(concept, o);
                  return (
                    <g
                      key={o.id}
                      {...actionProps(`observation|${o.id}`)}
                      aria-label={`Havainto: ${o.kind === "research_finding" ? "tutkimustulos" : `${observationDate(o)} ${o.value} ${o.unit}`}`}
                      data-observation-id={o.id}
                      className="concept-observation"
                    >
                      <line
                        x1={concept.x}
                        y1={concept.y}
                        x2={p.x}
                        y2={p.y}
                        stroke="var(--muted-foreground)"
                        strokeWidth={1 / scale}
                        strokeDasharray={`${3 / scale} ${5 / scale}`}
                        pointerEvents="none"
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={6 / scale}
                        fill="var(--foreground)"
                      />
                      <text
                        x={p.x + 10 / scale}
                        y={p.y + 3 / scale}
                        fontSize={11 / scale}
                      >
                        {o.kind === "research_finding"
                          ? `Tutkimustulos · ${o.title}`
                          : `${observationDate(o)} · ${Number(o.value).toLocaleString("fi-FI")}`}
                      </text>
                    </g>
                  );
                })}
              {observationPoint &&
                eligibleObservation &&
                depth >= 3 &&
                sources.map(({ source: s }) => {
                  const p = localPosition(observationPoint, s.id, 130, 50);
                  return (
                    <g
                      key={s.id}
                      {...actionProps(`source|${s.id}`)}
                      aria-label={`Lähde: ${s.title}`}
                      className="concept-source"
                    >
                      <line
                        x1={observationPoint.x}
                        y1={observationPoint.y}
                        x2={p.x}
                        y2={p.y}
                        stroke="var(--primary)"
                        strokeWidth={1 / scale}
                        pointerEvents="none"
                      />
                      <rect
                        x={p.x - 6 / scale}
                        y={p.y - 6 / scale}
                        width={12 / scale}
                        height={12 / scale}
                        fill="var(--primary)"
                      />
                      <text
                        x={p.x + 12 / scale}
                        y={p.y + 4 / scale}
                        fontSize={12 / scale}
                      >
                        Alkuperäislähde
                      </text>
                    </g>
                  );
                })}
            </g>
          </svg>
          <p className="concept-map-caption">
            Alueet = määritelty ryhmittely. Nuolet = kirjatut mekanismit;
            katkoviiva = kausaalisuus vahvistamatta. Läheisyys ja samalle
            alueelle kuuluminen eivät osoita vaikutussuhdetta.
          </p>
        </div>
        <aside
          className="concept-map-reader"
          aria-label="Käsitekartan sisältö ja lähteet"
        >
          <nav
            className="concept-map-breadcrumb"
            aria-label="Sijainti käsitekartalla"
          >
            <button
              type="button"
              onClick={() => {
                setClusterId(null);
                setConceptId(null);
                setObservationId(null);
                setSourceId(null);
                setMechanismId(null);
                setPlaying(false);
                setCamera(fitted);
              }}
            >
              Klusterit
            </button>
            {region && (
              <button
                type="button"
                onClick={() => activate(`cluster|${region.id}`)}
              >
                {region.label}
              </button>
            )}
            {concept && (
              <button type="button" onClick={() => openConcept(concept)}>
                {concept.label}
              </button>
            )}
            {observation && (
              <button
                type="button"
                onClick={() => openObservation(observation.id)}
              >
                Havainto
              </button>
            )}
            {source && <span aria-current="page">Lähde</span>}
          </nav>
          {!concept && !mechanism && (
            <>
              <h3>{region?.label ?? "Valitse alue tai seuraa reittiä"}</h3>
              <p>
                {region?.question ??
                  "Kartta jäsentää nykyistä määriteltyä sanastoa. Se ei vielä kata kaikkia artikkelisarjan aiheita."}
              </p>
              <div className="concept-map-list">
                {(region
                  ? model.concepts.filter((c) => c.clusterId === region.id)
                  : []
                ).map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => openConcept(c)}
                  >
                    {c.label} →
                  </button>
                ))}
              </div>
            </>
          )}
          {mechanism && (
            <section>
              <h3>{mechanism.label}</h3>
              <p>
                {name(mechanism.from)} → {name(mechanism.to)}
              </p>
              <p>{mechanism.explanation}</p>
              <p>Ehdot: {mechanism.conditions}</p>
              <p>{mechanism.limitations}</p>
              <p>
                {reviewLabel(mechanism.reviewStatus)} ·{" "}
                {mechanism.basis === "causal"
                  ? "kausaaliseksi arvioitu"
                  : "ei hyväksyttyä kausaalipäätelmää"}
              </p>
              {mechanismStatus(data, mechanism, periodId) === "undated" && (
                <p>
                  Ajallinen soveltamisala on avoin; näkyvä yhteys ei tarkoita
                  näyttöä valitusta aikakaudesta.
                </p>
              )}
            </section>
          )}
          {concept && !mechanism && (
            <section>
              <h3>{concept.label}</h3>
              <p>{concept.definition}</p>
              <p className="concept-map-note">{concept.limitations}</p>
              {concept.memberships.length > 1 && (
                <p>
                  Kuuluu myös alueisiin:{" "}
                  {concept.memberships
                    .filter((id) => id !== concept.clusterId)
                    .map((id) => model.regions.find((r) => r.id === id)?.label)
                    .join(", ")}
                  . Sama käsite, ei uusi vaikutussuhde.
                </p>
              )}
              {!observation && (
                <>
                  <p>{observations.length} havaintoa tässä aikarajauksessa.</p>
                  {!observations.length && (
                    <p>
                      Havaintoaukko: tällä rajauksella ei ole julkaistavaa
                      havaintoa. Käsitteen olemassaolo ei tarkoita, että se
                      olisi mitattu.
                    </p>
                  )}
                  <div className="concept-map-list">
                    {shown.map((o) => (
                      <button
                        type="button"
                        key={o.id}
                        data-observation-id={o.id}
                        onClick={() => openObservation(o.id)}
                      >
                        {o.kind === "research_finding"
                          ? `Tutkimustulos · ${o.title}`
                          : `${observationDate(o)} · ${Number(o.value).toLocaleString("fi-FI")} ${o.unit}`}
                        <small>{o.population}</small>
                      </button>
                    ))}
                  </div>
                  {observations.length > 6 && (
                    <div className="concept-map-page">
                      <button
                        type="button"
                        disabled={!page}
                        onClick={() => setPage(page - 1)}
                      >
                        Edelliset
                      </button>
                      <span>
                        {page * 6 + 1}–
                        {Math.min((page + 1) * 6, observations.length)} /{" "}
                        {observations.length}
                      </span>
                      <button
                        type="button"
                        disabled={(page + 1) * 6 >= observations.length}
                        onClick={() => setPage(page + 1)}
                      >
                        Seuraavat
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          {observation && !mechanism && (
            <section className="concept-map-evidence">
              <h3>
                {observation.kind === "research_finding"
                  ? "Tutkimustulos"
                  : `${observationDate(observation)} · ${Number(observation.value).toLocaleString("fi-FI")} ${observation.unit}`}
              </h3>
              {!eligibleObservation && (
                <p className="concept-map-caution">
                  Valittu havainto on aikarajauksen ulkopuolella tai epätarkasti
                  ajoitettu. Aikarajausta ei vaihdeta automaattisesti.
                </p>
              )}
              <p>{observation.finding ?? observation.title}</p>
              <p>
                {observationDate(observation)} · {observation.population}
              </p>
              <p>{observation.design}</p>
              <p>{observation.limitations}</p>
              {data.evidence?.links
                .filter(
                  (l) =>
                    l.observationId === observation.id &&
                    l.conceptId === conceptId &&
                    l.reviewStatus !== "rejected",
                )
                .map((l) => (
                  <p key={l.relation}>
                    {relationLabel[l.relation] ?? l.relation}: {l.rationale}{" "}
                    {l.limitations} ({reviewLabel(l.reviewStatus)}).
                  </p>
                ))}
              <p>{sourceCheck(observation.verification)}</p>
              <div className="concept-map-list">
                {sources.map(({ source: s }) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => openSource(s.id)}
                  >
                    Lähde:{" "}
                    {s.title === s.url ? "Alkuperäinen tilastolähde" : s.title}{" "}
                    →
                  </button>
                ))}
              </div>
            </section>
          )}
          {source && !mechanism && (
            <section className="concept-map-source">
              <h3>{source.source.title}</h3>
              <p>Lähdekohta: {source.ref.locator}</p>
              <p>{sourceCheck(source.source.verification)}</p>
              <p>
                Lähdeviite: {reviewLabel(source.ref.reviewStatus)}
                {source.source.checkedOn
                  ? ` · tarkistettu ${source.source.checkedOn}`
                  : ""}
              </p>
              {/^https?:\/\//.test(source.source.url) && (
                <a href={source.source.url} target="_blank" rel="noreferrer">
                  Avaa alkuperäislähde ↗
                </a>
              )}
            </section>
          )}
          <section className="concept-map-routes">
            <h3>Seuraa selityspolkua</h3>
            {!model.paths.length ? (
              <p>Tässä aineistoversiossa ei ole yhtenäistä kirjattua polkua.</p>
            ) : (
              <>
                <label>
                  Polku
                  <select
                    aria-label="Käsitekartan selityspolku"
                    value={pathId}
                    onChange={(e) => {
                      setPathId(e.target.value);
                      setPathStep(0);
                      setPlaying(false);
                    }}
                  >
                    {model.paths.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                {route && (
                  <>
                    <p>{route.introduction}</p>
                    <p className="concept-map-note">{route.limitations}</p>
                    <div className="concept-map-path-steps">
                      {steps.map((s, i) => (
                        <button
                          type="button"
                          key={s.order}
                          aria-current={
                            pathStep === i && conceptId === s.conceptId
                              ? "step"
                              : undefined
                          }
                          disabled={!s.available}
                          onClick={() => follow(i)}
                        >
                          {i + 1}. {name(s.conceptId)}
                          {!s.available
                            ? " · ei sovellu aikarajaukseen"
                            : s.status === "undated"
                              ? " · ajoitus avoin"
                              : ""}
                        </button>
                      ))}
                    </div>
                    {conceptId &&
                      steps.some((s) => s.conceptId === conceptId) &&
                      currentStep && (
                        <p aria-live="polite">
                          Vaihe {pathStep + 1}/{steps.length}:{" "}
                          {currentStep.caption}
                        </p>
                      )}
                    <div className="concept-map-route-actions">
                      <button
                        type="button"
                        disabled={!steps[0]?.available}
                        onClick={() => follow(0)}
                      >
                        Aloita reitti
                      </button>
                      <button
                        type="button"
                        disabled={
                          reduced ||
                          !active ||
                          pathStep >= steps.length - 1 ||
                          steps.some((s) => !s.available)
                        }
                        aria-pressed={playing}
                        onClick={() => setPlaying(!playing)}
                      >
                        {playing ? "Pysäytä" : "Toista reitti"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          pathStep >= steps.length - 1 ||
                          !steps[pathStep + 1]?.available
                        }
                        onClick={() => follow(pathStep + 1)}
                      >
                        Seuraava vaihe →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

