import { useMemo, useState } from "react";
import raw from "@/content/history-wall.json";
import type { AtlasData } from "@/lib/atlas.functions";
import { catalogueFor } from "@/lib/teema.system";
import {
  historyConnections,
  historyLayout,
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
  const layout = useMemo(() => historyLayout(history, themeOrder), [catalog]);
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
  const illuminated = new Set(lit.slice(0, 8).map((c) => c.item.id));
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
      <rect
        x="70"
        y="100"
        width="1460"
        height="770"
        rx="24"
        fill="oklch(.13 .025 260)"
        opacity=".6"
        pointerEvents="none"
      />
      <text x="100" y="128" className="history-heading">
        Yhteiskunnan muutokset · 1850–2050
      </text>
      {themeOrder.map((id, row) => (
        <g key={id} pointerEvents="none">
          <line
            x1="100"
            x2="1500"
            y1={180 + row * 48}
            y2={180 + row * 48}
            stroke={color(id)}
            opacity=".06"
          />
          <text
            x="100"
            y={166 + row * 48}
            fill={color(id)}
            fontSize="10"
            opacity=".4"
          >
            {catalog.themes[row]!.label}
          </text>
        </g>
      ))}
      {[1850, 1900, 1950, 2000, 2050].map((y) => (
        <g key={y} pointerEvents="none">
          <line
            x1={100 + (y - 1850) * 7}
            x2={100 + (y - 1850) * 7}
            y1="145"
            y2="830"
            stroke="currentColor"
            opacity=".07"
          />
          <text
            x={100 + (y - 1850) * 7}
            y="850"
            textAnchor="middle"
            fill="currentColor"
            fontSize="15"
            opacity=".5"
          >
            {y}
          </text>
        </g>
      ))}
      <rect
        x={100 + (2026 - 1850) * 7}
        y="145"
        width={(2050 - 2026) * 7}
        height="685"
        fill="currentColor"
        opacity=".025"
        pointerEvents="none"
      />
      <text
        x="1470"
        y="815"
        textAnchor="end"
        fontSize="10"
        fill="currentColor"
        opacity=".4"
      >
        2026–2050 · sisältää skenaarioita ja tulevia jaksoja
      </text>
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
                d={`M${origin.x} ${origin.y} Q${(origin.x + p.x) / 2} ${p.y - 70} ${p.x} ${p.y}`}
                fill="none"
                stroke={color(p.theme)}
                strokeWidth={c.relation === "recorded" ? 1.8 : 0.8}
                strokeDasharray={c.relation === "recorded" ? "3 12" : "1 7"}
                opacity={c.relation === "recorded" ? 0.8 : 0.32}
                pointerEvents="none"
              />
            );
          })}
      {visible.map((p) => {
        const light = illuminated.has(p.item.id),
          active = selected === p.item.id || hover === p.item.id;
        const width = Math.min(330, p.item.title.length * 6.4),
          x = Math.max(100, Math.min(1500 - width, p.x)),
          y = p.y - 10;
        const label =
          (active ||
            light ||
            ((p.item.importance ?? 0) >= 5 &&
              labels.length < (zoom >= 1.5 ? 14 : 7))) &&
          !labels.some(
            (l) =>
              Math.abs(l.y - y) < 18 && l.x < x + width && x < l.x + l.width,
          );
        if (label) labels.push({ x, y, width });
        return (
          <g
            key={p.item.id}
            data-history-item={p.item.id}
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
              x2={Math.max(p.x + 3, p.endX)}
              y1={p.y}
              y2={p.y}
              stroke="currentColor"
              strokeDasharray={
                p.item.kind === "tulevaisuusskenaario" || p.item.start > 2026
                  ? "4 4"
                  : undefined
              }
              strokeWidth={light || active ? 3 : 1.5}
              opacity={light || active ? 0.9 : 0.2}
            />
            {p.item.start < 1850 ? (
              <path
                d={`M${p.x + 5} ${p.y - 4} L${p.x} ${p.y} L${p.x + 5} ${p.y + 4}`}
                fill="none"
                stroke="currentColor"
                opacity={light || active ? 1 : 0.3}
              />
            ) : (
              <circle
                cx={p.x}
                cy={p.y}
                r={active ? 5 : light ? 4 : 2}
                fill="currentColor"
                opacity={light || active ? 1 : 0.25}
              />
            )}
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            {label && (
              <text
                x={x}
                y={y}
                fill="currentColor"
                fontSize={light || active ? 13 : 11}
                opacity={light || active ? 1 : 0.32}
                className="history-title"
              >
                {p.item.title.length > 52
                  ? p.item.title.slice(0, 50) + "…"
                  : p.item.title}
              </text>
            )}
          </g>
        );
      })}
      <text x="100" y="880" fill="currentColor" fontSize="11" opacity=".5">
        Piste = tapahtuma · viiva = kirjattu kesto · pisteviiva = taustayhteys,
        ei syyvaikutus · lähennä nähdäksesi lisää
      </text>
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
            x={Math.min(1400, selectedPoint.x)}
            y={selectedPoint.y + 10}
            width="105"
            height="27"
            rx="5"
            fill="oklch(.18 .03 260)"
            stroke="currentColor"
            opacity=".9"
          />
          <text
            x={Math.min(1400, selectedPoint.x) + 8}
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
          x="90"
          y="105"
          width="570"
          height="260"
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
