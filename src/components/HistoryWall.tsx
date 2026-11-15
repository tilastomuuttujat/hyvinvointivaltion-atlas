import { useMemo, useState } from "react";
import raw from "@/content/history-wall.json";
import type { AtlasData } from "@/lib/atlas.functions";
import { catalogueFor } from "@/lib/teema.system";
import {
  historyConnections,
  corridorLayout,
  historyThemes,
  validateHistory,
  CORRIDOR,
  corridorScale,
  type HistoryBundle,
} from "@/lib/atlas.history";
const history = raw as HistoryBundle;
validateHistory(history);
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
  const detail = zoom >= 2.8 ? 240 : zoom >= 1.5 ? 110 : 42;
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
  const illuminated = new Set(lit.slice(0, 6).map((c) => c.item.id));
  const visible = layout.filter(
    (p) =>
      sampled.has(p.item.id) ||
      illuminated.has(p.item.id) ||
      p.item.id === selected,
  );
  const color = (theme: string | undefined) =>
    theme ? `var(--rs-${themeOrder.indexOf(theme) + 1})` : "oklch(.65 .02 230)";
  const selectedPoint = layout.find((p) => p.item.id === selected),
    item = selectedPoint?.item,
    connection = item ? byId.get(item.id) : null;
  const labels: { x: number; y: number; width: number }[] = [];
  return (
    <g className="history-wall" data-history-count={history.items.length}>
      <g pointerEvents="none" data-history-corridor="true">
        {(() => {
          const { cx, cy, halfW, halfH } = CORRIDOR,
            far = corridorScale(2050),
            corner = (sx: number, sy: number, k: number) =>
              `${cx + sx * halfW * k} ${cy + sy * halfH * k}`;
          return (
            <>
              <radialGradient id="history-horizon">
                <stop offset="0%" stopColor="oklch(.55 .08 230)" stopOpacity=".22" />
                <stop offset="100%" stopColor="oklch(.55 .08 230)" stopOpacity="0" />
              </radialGradient>
              <ellipse cx={cx} cy={cy} rx={halfW * far * 1.6} ry={halfH * far * 1.4} fill="url(#history-horizon)" />
              {[-1, 1].map((sx) => (
                <path
                  key={sx}
                  d={`M${corner(sx, -1, 1)} L${corner(sx, -1, far)} L${corner(sx, 1, far)} L${corner(sx, 1, 1)}Z`}
                  fill="oklch(.24 .04 250)"
                  opacity=".28"
                />
              ))}
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
                <path key={`${sx}${sy}`} d={`M${corner(sx!, sy!, 1)} L${corner(sx!, sy!, far)}`} stroke="currentColor" opacity=".12" />
              ))}
              {[1850, 1900, 1950, 2000, 2026, 2050].map((year) => {
                const k = corridorScale(year);
                return (
                  <g key={year} opacity={year === 2026 ? 0.22 : 0.1}>
                    <path
                      d={`M${corner(-1, -1, k)} L${corner(1, -1, k)} L${corner(1, 1, k)} L${corner(-1, 1, k)}Z`}
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={year > 2026 ? "4 6" : undefined}
                    />
                    <text x={cx - halfW * k + 8} y={cy + halfH * k - 8 * k} textAnchor="start" fill="currentColor" fontSize={11 + 6 * k} opacity="1.6">
                      {year === 2026 ? "nyt" : year}
                    </text>
                  </g>
                );
              })}
            </>
          );
        })()}
      </g>
      {origin &&
        visible
          .filter((p) => illuminated.has(p.item.id))
          .map((p) => {
            const c = byId.get(p.item.id)!;
            return (
              <path
                key={`flow:${p.item.id}`}
                className={
                  c.relation === "recorded"
                    ? "history-link recorded"
                    : "history-link context"
                }
                data-history-relation={c.relation}
                d={`M${p.x} ${p.y} Q${(p.x + origin.x) / 2} ${Math.min(p.y, origin.y) - 40},${origin.x} ${origin.y}`}
                fill="none"
                stroke={color(p.theme)}
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={c.relation === "recorded" ? undefined : "2 6"}
                opacity={0.24}
                pointerEvents="none"
              />
            );
          })}
      {visible.map((p) => {
        const light = illuminated.has(p.item.id),
          active = selected === p.item.id || hover === p.item.id;
        const k = p.depth,
          width = 250,
          x = p.x + (p.side === "left" ? 8 : -8) * k,
          y = p.y - 6 * k;
        const label =
          (active || light || (k > 0.7 && labels.length < (zoom >= 1.5 ? 12 : 6))) &&
          !labels.some((l) => Math.abs(l.y - y) < 18 * k && Math.abs(l.x - x) < 160 * k);
        if (label) labels.push({ x, y, width });
        return (
          <g
            key={p.item.id}
            data-history-item={p.item.id}
            data-history-side={p.side}
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
            <line
              x1={p.x}
              x2={p.endX}
              y1={p.y}
              y2={p.endY}
              stroke="currentColor"
              strokeDasharray={
                p.item.kind === "tulevaisuusskenaario" || p.item.start > 2026
                  ? "4 4"
                  : undefined
              }
              strokeWidth={(light || active ? 2.4 : 1.2) * k}
              opacity={light || active ? 0.7 : 0.05 + 0.08 * k}
            />
            {p.item.start < 1850 ? (
              <path
                d={`M${p.x + 5} ${p.y - 4} L${p.x} ${p.y} L${p.x + 5} ${p.y + 4}`}
                fill="none"
                stroke="currentColor"
                opacity={light || active ? 0.8 : 0.1}
              />
            ) : (
              <circle
                cx={p.x}
                cy={p.y}
                r={(active ? 6 : light ? 5 : 2.4) * k + 0.8}
                fill="currentColor"
                opacity={light || active ? 0.9 : 0.06 + 0.12 * k}
              />
            )}
            {light && (
              <circle cx={p.x} cy={p.y} r={14 * k + 4} fill="currentColor" opacity=".14" className="history-glow" />
            )}
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            {label && (() => {
              const { cx, cy } = CORRIDOR;
              const lx = p.x + (p.side === "left" ? 6 : -6) * k,
                ly = p.y - 7 * k,
                deg = (Math.atan((cy - ly) / (cx - lx || 1)) * 180) / Math.PI,
                on = light || active,
                txt = p.item.title.length > 37 ? p.item.title.slice(0, 35) + "…" : p.item.title,
                fs = on ? 11 + 7 * k : 11 * Math.max(0.6, k);
              return (
                <g transform={`translate(${lx} ${ly}) skewY(${deg})`} className="history-carving">
                  <text x={0} y={0.9} fill="oklch(.08 .02 250)" textAnchor={p.side === "left" ? "start" : "end"} fontSize={fs} letterSpacing=".08em" opacity={on ? 0.8 : 0.3}>{txt}</text>
                  <text x={0} y={0} fill="currentColor" textAnchor={p.side === "left" ? "start" : "end"} fontSize={fs} letterSpacing=".08em" opacity={on ? 0.95 : 0.16} className="history-title" style={on ? { filter: "drop-shadow(0 0 3px currentColor)" } : undefined}>{txt}</text>
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
