import { useMemo, useState } from "react";
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
  const illuminated = new Set(lit.slice(0, 2).map((c) => c.item.id));
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
      <defs>
        <clipPath id="history-left-wall">
          <rect x="0" y="100" width="320" height="820" />
        </clipPath>
        <clipPath id="history-right-wall">
          <rect x="1280" y="100" width="320" height="820" />
        </clipPath>
      </defs>
      <g pointerEvents="none" data-history-corridor="true">
        <path
          d="M0 90 L320 145 L320 865 L0 950Z"
          fill="oklch(.16 .025 260)"
          opacity=".24"
        />
        <path
          d="M1600 90 L1280 145 L1280 865 L1600 950Z"
          fill="oklch(.16 .025 260)"
          opacity=".24"
        />
        <path
          d="M0 90L320 145M0 950L320 865M1600 90L1280 145M1600 950L1280 865"
          fill="none"
          stroke="currentColor"
          opacity=".08"
        />
        {[1850, 1900, 1950, 2000, 2050].map((year) => (
          <g key={year}>
            {["left", "right"].map((side) => (
              <text
                key={side}
                x={side === "left" ? 18 : 1582}
                y={155 + ((year - 1850) / 200) * 680}
                textAnchor={side === "left" ? "start" : "end"}
                fill="currentColor"
                fontSize="12"
                opacity=".2"
              >
                {year}
              </text>
            ))}
          </g>
        ))}
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
                d={`M${origin.x} ${origin.y} C${origin.x + (p.side === "left" ? -80 : 80)} ${origin.y},${p.x + (p.side === "left" ? 90 : -90)} ${p.y},${p.x} ${p.y}`}
                fill="none"
                stroke={color(p.theme)}
                strokeWidth={0.65}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={c.relation === "recorded" ? "3 12" : "1 7"}
                opacity={0.18}
                pointerEvents="none"
              />
            );
          })}
      {visible.map((p) => {
        const light = illuminated.has(p.item.id),
          active = selected === p.item.id || hover === p.item.id;
        const width = 250,
          x = p.side === "left" ? 24 : 1326,
          y = p.y - 10;
        const label =
          (active || light || labels.length < (zoom >= 1.5 ? 12 : 6)) &&
          !labels.some((l) => Math.abs(l.y - y) < 20 && l.x === x);
        if (label) labels.push({ x, y, width });
        return (
          <g
            key={p.item.id}
            data-history-item={p.item.id}
            data-history-side={p.side}
            clipPath={`url(#history-${p.side}-wall)`}
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
              strokeWidth={light || active ? 2 : 1}
              opacity={light || active ? 0.65 : 0.07}
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
                r={active ? 5 : light ? 4 : 2}
                fill="currentColor"
                opacity={light || active ? 0.8 : 0.1}
              />
            )}
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            {label && (
              <text
                x={x}
                y={y}
                fill="currentColor"
                fontSize={light || active ? 13 : 11}
                opacity={light || active ? 0.85 : 0.1}
                className="history-title"
              >
                {p.item.title.length > 37
                  ? p.item.title.slice(0, 35) + "…"
                  : p.item.title}
              </text>
            )}
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
            x={selectedPoint.side === "left" ? 30 : 1450}
            y={selectedPoint.y + 10}
            width="105"
            height="27"
            rx="5"
            fill="oklch(.18 .03 260)"
            stroke="currentColor"
            opacity=".9"
          />
          <text
            x={(selectedPoint.side === "left" ? 30 : 1450) + 8}
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
