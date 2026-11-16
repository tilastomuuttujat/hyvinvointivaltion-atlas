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
import "@/styles/history-surfaces.css";
const history = raw as HistoryBundle;
validateHistory(history);
export function HistoryWall({
  data,
  mechanismIds,
  themeIds,
  onExplore,
}: {
  data: AtlasData;
  mechanismIds: string[];
  themeIds: string[];
  onExplore: (theme: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [details, setDetails] = useState(false),
    [scale, setScale] = useState(1);
  const root = useRef<SVGGElement>(null),
    left = useRef<HTMLDivElement>(null),
    right = useRef<HTMLDivElement>(null),
    drag = useRef<{
      id: number;
      y: number;
      start: number;
      moved: boolean;
    } | null>(null);
  const catalog = catalogueFor(data),
    themeOrder = catalog.themes.map((t) => t.id),
    layout = useMemo(() => corridorLayout(history, themeOrder), [catalog]);
  const connections = historyConnections(
      history,
      data,
      new Set(mechanismIds),
      new Set(themeIds),
    ),
    byId = new Map(connections.map((c) => [c.item.id, c]));
  const selectedPoint = layout.find((p) => p.item.id === selected),
    item = selectedPoint?.item,
    connection = item ? byId.get(item.id) : null;
  const color = (theme: string | undefined) =>
    theme ? `var(--rs-${themeOrder.indexOf(theme) + 1})` : "oklch(.8 .02 230)";
  useEffect(() => {
    const svg = root.current?.ownerSVGElement;
    if (!svg) return;
    const measure = () => {
      const r = svg.getBoundingClientRect();
      if (r.width && r.height)
        setScale(Math.min(r.width / 1600, r.height / 1000));
    };
    measure();
    const o =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    o?.observe(svg);
    window.addEventListener("resize", measure);
    return () => {
      o?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const contextKey = themeIds.join("|") + "::" + mechanismIds.join("|");
  useEffect(() => {
    for (const panel of [left.current, right.current]) {
      const target = panel?.querySelector<HTMLElement>(
        '[data-history-lit="true"]',
      );
      if (panel && target && typeof panel.scrollTo === "function")
        panel.scrollTo({
          top: Math.max(0, target.offsetTop - panel.clientHeight * 0.3),
          behavior: "auto",
        });
    }
  }, [contextKey]);
  return (
    <g
      ref={root}
      className="history-wall"
      data-history-count={history.items.length}
    >
      <g data-history-corridor="true" pointerEvents="none">
        <path
          d="M10 75L455 160L455 840L10 930Z"
          fill="oklch(.2 .025 250)"
          opacity=".18"
        />
        <path
          d="M1590 75L1145 160L1145 840L1590 930Z"
          fill="oklch(.2 .025 250)"
          opacity=".18"
        />
      </g>
      {(["left", "right"] as const).map((side) => (
        <foreignObject
          key={side}
          x={side === "left" ? 10 : 1140}
          y="100"
          width="450"
          height="800"
          data-history-surface={side}
        >
          <div
            className={`history-surface history-surface-${side}`}
            style={{ fontSize: Math.max(16, 16 / Math.max(0.1, scale)) }}
            onPointerDown={(event) => {
              event.stopPropagation();
              drag.current = {
                id: event.pointerId,
                y: event.clientY,
                start: event.clientY,
                moved: false,
              };
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              const d = drag.current;
              if (
                !d ||
                d.id !== event.pointerId ||
                event.pointerType !== "touch"
              )
                return;
              const panel = side === "left" ? left.current : right.current;
              if (panel) {
                const delta = (d.y - event.clientY) / Math.max(0.1, scale);
                panel.scrollTop += delta;
              }
              d.moved ||= Math.abs(event.clientY - d.start) > 6;
              d.y = event.clientY;
            }}
            onPointerUp={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="history-surface-plane">
              <header>
                <strong>
                  Ilmiöt · {side === "left" ? "vasen seinä" : "oikea seinä"}
                </strong>
                <span>1850–2050 · selaa pystysuunnassa</span>
              </header>
              <div
                className="history-surface-scroll"
                ref={side === "left" ? left : right}
                role="region"
                aria-label={
                  side === "left" ? "Vasen ilmiöseinä" : "Oikea ilmiöseinä"
                }
                tabIndex={0}
              >
                {layout
                  .filter((p) => p.side === side)
                  .map((p) => {
                    const c = byId.get(p.item.id),
                      light = c?.relation !== "none",
                      active = selected === p.item.id;
                    return (
                      <article
                        key={p.item.id}
                        className={`history-surface-row${light ? " lit" : ""}${active ? " selected" : ""}`}
                        style={
                          {
                            "--event-color": color(p.theme),
                          } as React.CSSProperties
                        }
                        data-history-item={p.item.id}
                        data-history-side={side}
                        data-history-lit={light}
                        data-history-context={c?.relation}
                        role="button"
                        tabIndex={0}
                        aria-label={`${p.item.title}, ${p.item.start}–${p.item.end}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (drag.current?.moved) return;
                          setSelected(p.item.id);
                          setDetails(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelected(p.item.id);
                            setDetails(false);
                          }
                        }}
                      >
                        <time>
                          {p.item.start === p.item.end
                            ? p.item.start
                            : `${p.item.start}–${p.item.end}`}
                          {p.item.kind === "tulevaisuusskenaario" ||
                          p.item.start > 2026
                            ? " · skenaario / tuleva jakso"
                            : ""}
                        </time>
                        <span className="history-title">{p.item.title}</span>
                        {active && (
                          <button
                            aria-label="Avaa historiallisen ilmiön lähteet"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetails(true);
                            }}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setDetails(true);
                              }
                            }}
                          >
                            Ajoitus ja lähteet
                          </button>
                        )}
                      </article>
                    );
                  })}
              </div>
              <footer>
                Valaistu = liittyvä taustakohde, ei syy-yhteyden vahvistus
              </footer>
            </div>
          </div>
        </foreignObject>
      ))}
      {item && details && (
        <foreignObject
          x={selectedPoint?.side === "right" ? 1140 : 10}
          y="100"
          width="450"
          height="800"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className="history-card"
            data-history-detail={item.id}
            style={{ fontSize: Math.max(16, 16 / Math.max(0.1, scale)) }}
          >
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
