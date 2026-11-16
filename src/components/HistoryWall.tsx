import { useEffect, useMemo, useRef, useState } from "react";
import raw from "@/content/history-wall.json";
import type { AtlasData } from "@/lib/atlas.functions";
import { catalogueFor } from "@/lib/teema.system";
import {
  historyConnections,
  corridorLayout,
  historyThemes,
  validateHistory,
  type HistoryBundle,
} from "@/lib/atlas.history";
const history = raw as HistoryBundle;
validateHistory(history);
// Clock ring: 1850 at -150deg, 2050 at +150deg (clockwise from top), gap at the bottom.
const MAX_ILLUMINATED = 12;
const RING = { cx: 800, cy: 500, r: 455 };
const yearAngle = (year: number) =>
  -150 + (300 * (Math.min(2050, Math.max(1850, year)) - 1850)) / 200;
const ringPoint = (deg: number, r = RING.r) => {
  const a = (deg * Math.PI) / 180;
  return { x: RING.cx + r * Math.sin(a), y: RING.cy - r * Math.cos(a) };
};
export function HistoryWall({
  data,
  mechanismIds,
  themeIds,
  zoom,
  origin,
  onExplore,
}: {
  data: AtlasData;
  mechanismIds: string[];
  themeIds: string[];
  zoom: number;
  origin: { x: number; y: number } | null;
  onExplore: (theme: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [hover, setHover] = useState<string | null>(null),
    [details, setDetails] = useState(false);
  const catalog = catalogueFor(data),
    themeOrder = catalog.themes.map((t) => t.id);
  const layout = useMemo(() => corridorLayout(history, themeOrder), [catalog]);
  const connections = historyConnections(
      history,
      data,
      new Set(mechanismIds),
      new Set(themeIds),
    ),
    byId = new Map(connections.map((c) => [c.item.id, c]));
  const detail = zoom >= 2.8 ? 420 : zoom >= 1.5 ? 240 : 120;
  const lit = connections
    .filter((c) => c.relation !== "none")
    .sort(
      (a, b) =>
        (b.relation === "recorded" ? 10 : 0) -
          (a.relation === "recorded" ? 10 : 0) ||
        (b.item.importance ?? 0) - (a.item.importance ?? 0) ||
        a.item.start - b.item.start,
    );
  // Keep historical periods represented instead of letting recent dense records fill the wall.
  const priority = [...layout].sort(
    (a, b) =>
      (b.item.importance ?? 0) - (a.item.importance ?? 0) ||
      a.item.id.localeCompare(b.item.id),
  );
  const sampled = new Set<string>();
  for (let year = 1850; year < 2050; year += 20) {
    for (const p of priority
      .filter((p) => p.item.start >= year && p.item.start < year + 20)
      .slice(0, Math.ceil(detail / 10)))
      sampled.add(p.item.id);
  }
  const illuminated = new Set(lit.slice(0, MAX_ILLUMINATED).map((c) => c.item.id));
  const visible = layout.filter(
    (p) =>
      sampled.has(p.item.id) ||
      illuminated.has(p.item.id) ||
      p.item.id === selected,
  );
  const color = (theme: string | undefined) =>
    theme ? `var(--rs-${themeOrder.indexOf(theme) + 1})` : "oklch(.65 .02 230)";
  const labels: { deg: number; r: number }[] = [];
  // The ring turns gently so the lit era drifts toward the top of the clock.
  const litYears = lit.slice(0, MAX_ILLUMINATED).map((c) => c.item.start).sort((a, b) => a - b);
  const target = litYears.length
    ? -yearAngle(litYears[Math.floor(litYears.length / 2)]!) * 0.6
    : 0;
  const [rot, setRot] = useState(0),
    rotRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const d = target - rotRef.current;
      if (Math.abs(d) < 0.05) {
        rotRef.current = target;
        setRot(target);
        return;
      }
      rotRef.current += d * 0.08;
      setRot(rotRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const place = (start: number, id: string) => {
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const deg = yearAngle(start) + rot,
      r = RING.r - 6 - (Math.abs(h) % 4) * 9;
    return { deg, r, ...ringPoint(deg, r) };
  };
  const selectedRaw = layout.find((p) => p.item.id === selected),
    selectedPoint = selectedRaw
      ? (() => {
          const q = place(selectedRaw.item.start, selectedRaw.item.id);
          return { ...selectedRaw, x: q.x, y: q.y, side: q.deg < 0 ? "left" : "right" };
        })()
      : undefined,
    item = selectedPoint?.item,
    connection = item ? byId.get(item.id) : null;
  return (
    <g className="history-wall" data-history-count={history.items.length}>
      <g pointerEvents="none" data-history-corridor="true" data-history-clock="true">
        <radialGradient id="history-clock-glow">
          <stop offset="80%" stopColor="oklch(.55 .08 230)" stopOpacity="0" />
          <stop offset="96%" stopColor="oklch(.55 .08 230)" stopOpacity=".14" />
          <stop offset="100%" stopColor="oklch(.55 .08 230)" stopOpacity="0" />
        </radialGradient>
        <circle cx={RING.cx} cy={RING.cy} r={RING.r + 30} fill="url(#history-clock-glow)" />
        {[RING.r + 6, RING.r - 44].map((r) => {
          const s0 = ringPoint(-150 + rot, r), s1 = ringPoint(150 + rot, r);
          return <path key={r} d={`M${s0.x} ${s0.y} A${r} ${r} 0 1 1 ${s1.x} ${s1.y}`} fill="none" stroke="currentColor" opacity=".14" />;
        })}
        {Array.from({ length: 41 }, (_, i) => 1850 + i * 5).map((year) => {
          const major = year % 50 === 0 || year === 2025,
            deg = yearAngle(year) + rot,
            o = ringPoint(deg, RING.r + 6),
            n = ringPoint(deg, RING.r + (major ? 22 : 12));
          return <line key={year} x1={o.x} y1={o.y} x2={n.x} y2={n.y} stroke="currentColor" opacity={major ? 0.4 : 0.15} strokeDasharray={year > 2026 ? "2 2" : undefined} />;
        })}
        {[1850, 1900, 1950, 2000, 2026, 2050].map((year) => {
          const deg = yearAngle(year) + rot, t = ringPoint(deg, RING.r + 40);
          return (
            <text key={year} x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="15" letterSpacing=".1em" opacity={year === 2026 ? 0.7 : 0.4} transform={`rotate(${deg > 90 || deg < -90 ? deg + 180 : deg} ${t.x} ${t.y})`}>
              {year === 2026 ? "nyt" : year}
            </text>
          );
        })}
        {origin && visible.filter((p) => illuminated.has(p.item.id)).map((p) => {
          const q = place(p.item.start, p.item.id);
          return (
            <path key={p.item.id} d={`M${origin.x} ${origin.y} Q${(origin.x + RING.cx) / 2} ${(origin.y + RING.cy) / 2} ${q.x} ${q.y}`} fill="none" stroke={color(p.theme)} strokeWidth=".8" opacity=".3" className="history-thread" />
          );
        })}
      </g>
      {visible.map((p) => {
        const light = illuminated.has(p.item.id),
          active = selected === p.item.id || hover === p.item.id;
        const q = place(p.item.start, p.item.id),
          side = q.deg < 0 ? "left" : "right";
        const label = !labels.some(
          (l) => Math.abs(l.deg - q.deg) < 1.6 && Math.abs(l.r - q.r) < 10,
        );
        if (label || light || active) labels.push({ deg: q.deg, r: q.r });
        return (
          <g
            key={p.item.id}
            data-history-item={p.item.id}
            data-history-side={side}
            data-history-lit={light}
            data-history-context={byId.get(p.item.id)?.relation}
            role="button"
            tabIndex={0}
            aria-label={`${p.item.title}, ${p.item.start}–${p.item.end}`}
            style={{ color: color(p.theme), cursor: "pointer" }}
            onPointerEnter={() => setHover(p.item.id)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(p.item.id)}
            onBlur={() => setHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(p.item.id);
              setDetails(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setSelected(p.item.id);
                setDetails(false);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <title>
              {p.item.title} · {p.item.start}–{p.item.end} · {p.item.kind}.{" "}
              {light
                ? "Aiheeseen sopiva taustakohde; ei kausaalivahvistus."
                : ""}
            </title>
            <circle cx={q.x} cy={q.y} r="10" fill="transparent" />
            <circle cx={q.x} cy={q.y} r={light || active ? 3 : 1.4} fill="currentColor" opacity={light || active ? 0.95 : 0.35} />
            {(label || light || active) && (() => {
              const on = light || active,
                flip = q.deg < 0,
                txt = p.item.title.length > 34 ? p.item.title.slice(0, 32) + "…" : p.item.title,
                fs = on ? 14 : 9.5,
                rotDeg = flip ? q.deg + 90 : q.deg - 90;
              return (
                <g transform={`translate(${q.x} ${q.y}) rotate(${rotDeg})`} className="history-carving" data-history-carving={on ? "lit" : "dim"}>
                  <text x={flip ? 6 : -6} y={3} fill="currentColor" textAnchor={flip ? "start" : "end"} fontSize={fs} letterSpacing=".06em" opacity={on ? 0.95 : 0.3} className="history-title" style={on ? { filter: "drop-shadow(0 0 3px currentColor)" } : undefined}>{txt}</text>
                </g>
              );
            })()}
          </g>
        );
      })}
      {selectedPoint && !details && (
        <g
          role="button"
          tabIndex={0}
          aria-label="Avaa historiallisen ilmiön lähteet"
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setDetails(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setDetails(true);
            }
          }}
        >
          <rect
            x={Math.max(10, Math.min(1485, selectedPoint.x + (selectedPoint.side === "left" ? 6 : -111)))}
            y={selectedPoint.y + 10}
            width="105"
            height="27"
            rx="5"
            fill="oklch(.18 .03 260)"
            stroke="currentColor"
            opacity=".9"
          />
          <text
            x={(Math.max(10, Math.min(1485, selectedPoint.x + (selectedPoint.side === "left" ? 6 : -111)))) + 8}
            y={selectedPoint.y + 28}
            fill="currentColor"
            fontSize="13"
          >
            Ajoitus ja lähteet
          </text>
        </g>
      )}
      {item && details && (
        <foreignObject
          x={selectedPoint?.side === "right" ? 1290 : 10}
          y="155"
          width="300"
          height="300"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div className="history-card" data-history-detail={item.id}>
            <button onClick={() => setDetails(false)}>Sulje</button>
            <h3>{item.title}</h3>
            <p>
              {item.start}–{item.end} · {item.kind} · luottamus:{" "}
              {item.confidence || "ei kirjattu"}
            </p>
            <p>
              {connection?.relation === "recorded"
                ? "Kirjattu lähteistetty kontekstikytkentä. Tämä ei yksin vahvista ketjun syyvaikutusta."
                : connection?.relation === "context"
                  ? "Toimituksellinen aihealueryhmittely" +
                    (connection.timed
                      ? " ja kirjattuun aikaikkunaan osuminen."
                      : " ilman varmistettua yhteistä ajoitusta.")
                  : "Taustakohde. Kytkentää nykyiseen ketjuun ei ole kirjattu."}
            </p>
            <p>
              {item.start > 2026 || item.kind === "tulevaisuusskenaario"
                ? "Tulevaisuus / skenaario, ei toteutunut havainto."
                : ""}
            </p>
            <div>
              {item.sources.length ? (
                item.sources.map((s, i) =>
                  /^https?:\/\//.test(s) ? (
                    <a
                      key={i}
                      href={s}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lähde {i + 1}
                    </a>
                  ) : (
                    <p key={i}>{s}</p>
                  ),
                )
              ) : (
                <p>Lähdeviite puuttuu.</p>
              )}
            </div>
            {historyThemes(item)
              .filter((t) => themeOrder.includes(t))
              .map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onExplore(t);
                    setSelected(null);
                  }}
                >
                  Korosta samaa aihealuetta verkossa
                </button>
              ))}
            <small>
              Historiallinen vienti: {history.exportedAt.slice(0, 10)} ·
              erillinen aineistoversio
            </small>
          </div>
        </foreignObject>
      )}
    </g>
  );
}
