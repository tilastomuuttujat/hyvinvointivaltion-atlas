import { useId, useLayoutEffect, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import { exploreOptions } from "@/lib/atlas.explore";
import "@/styles/graph-explore.css";

export function useGraphExplore(data: AtlasData) {
  const [steps, setSteps] = useState<{ id: string; via?: string }[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const current = steps.at(-1)?.id;
  // Reveal adjacent recorded directions immediately, without a question dialog.
  const options = current ? exploreOptions(data, current, "how") : [];
  const chosen = (id: string) => steps.some((s) => s.via === id);
  const candidate = (id: string) =>
    id !== current &&
    options.some((o) => o.target.id === id) &&
    !steps.some((s) => s.id === id);
  const pick = (id: string) => {
    const existing = steps.findIndex((s) => s.id === id);
    const next = options.find((o) => o.target.id === id);
    setSteps((previous) =>
      existing >= 0
        ? previous.slice(0, existing + 1)
        : next
          ? [...previous, { id, via: next.mechanism.id }]
          : [{ id }],
    );
  };
  return {
    steps,
    summaryOpen,
    setSummaryOpen,
    describe: (id: string) =>
      data.evidence?.reasoning?.mechanisms.find(
        (m) => m.id === id && m.isCurrent && m.reviewStatus !== "rejected",
      ),
    current,
    options,
    pick,
    chosen,
    candidate,
    clear: () => {
      setSteps([]);
      setSummaryOpen(false);
    },
    lit: (id: string) =>
      !current || steps.some((s) => s.id === id) || candidate(id),
    edgeLit: (id: string) =>
      chosen(id) || options.some((o) => o.mechanism.id === id),
  };
}
export type GraphExploration = ReturnType<typeof useGraphExplore>;

/** Small inline SVG cues; no popup, no automatic focus or text panel. */
export function GraphPointHint({
  exploration: e,
  id,
  x,
  y,
  r = 7,
}: {
  exploration: GraphExploration;
  id: string;
  x: number;
  y: number;
  r?: number;
}) {
  const index = e.steps.findIndex((s) => s.id === id);
  const choices = e.options.filter((o) => o.target.id === id);
  const next = e.candidate(id);
  const incoming = choices.some((o) => o.incoming),
    outgoing = choices.some((o) => !o.incoming);
  const hint =
    incoming && outgoing
      ? "← Tausta / seuraus →"
      : incoming
        ? "← Mahdollinen taustatekijä"
        : "Mahdollinen seuraus →";
  return (
    <>
      {choices.length > 0 && (
        <title>
          {choices
            .map(
              (o) =>
                `${o.incoming ? "Edeltävä tekijä" : "Mahdollinen seuraus"}: ${o.mechanism.label}`,
            )
            .join("\n")}
        </title>
      )}
      {next && (
        <>
          <circle className="graph-next-ring" cx={x} cy={y} r={r + 5} />
          <text className="graph-next-mark" x={x + r + 8} y={y + 4}>
            {incoming && outgoing ? "↔" : incoming ? "←" : "→"}
          </text>
          <text
            className="graph-point-hint"
            x={x}
            y={y + r + 19}
            textAnchor="middle"
          >
            {hint}
          </text>
        </>
      )}
      {index >= 0 && (
        <text
          className="graph-step-number"
          x={x - r - 8}
          y={y + 4}
          textAnchor="end"
        >
          {index + 1}
        </text>
      )}
      {e.current === id &&
        !e.options.some((o) => !e.steps.some((s) => s.id === o.target.id)) && (
          <text
            className="graph-end-hint"
            x={x}
            y={y + r + 20}
            textAnchor="middle"
          >
            Ei kirjattua jatkoa
          </text>
        )}
    </>
  );
}

/** Only lightweight back/reset controls remain; the route itself lives in the graph. */
export function GraphExplore({
  data,
  exploration: e,
  onPick,
  onOpenSummary,
}: {
  data: AtlasData;
  exploration: GraphExploration;
  onPick: (id: string) => void;
  onOpenSummary: () => void;
}) {
  const summaryId = useId();
  if (!e.current) return null;
  const previous = e.steps.at(-2);
  return (
    <>
      <nav className="graph-trail" aria-label="Oma tutkimuspolku">
        <span aria-live="polite">
          {e.steps.length}{" "}
          {e.steps.length === 1 ? "valittu piste" : "valittua pistettä"} ·
          vihjeet ovat kirjattuja selitysehdotuksia
        </span>
        {previous && (
          <button
            type="button"
            onClick={() => {
              e.pick(previous.id);
              onPick(previous.id);
            }}
            aria-label={`Palaa: ${data.evidence?.concepts.find((c) => c.id === previous.id)?.label}`}
          >
            ← Edellinen
          </button>
        )}
        <button type="button" onClick={e.clear}>
          Tyhjennä polku
        </button>
      </nav>
      <button
        type="button"
        className="graph-summary-open"
        aria-expanded={e.summaryOpen}
        aria-controls={summaryId}
        onClick={() => {
          e.setSummaryOpen(!e.summaryOpen);
          if (!e.summaryOpen) onOpenSummary();
        }}
      >
        Oma polku ({e.steps.length}) {e.summaryOpen ? "▸" : "◂"}
      </button>
      <section
        id={summaryId}
        role="complementary"
        aria-label="Oman polun yhteenveto"
        className={`graph-summary${e.summaryOpen ? " open" : ""}`}
        aria-hidden={!e.summaryOpen}
        inert={!e.summaryOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            e.setSummaryOpen(false);
          }
        }}
      >
        <header>
          <h3>Oma tutkimuspolku</h3>
          <button
            type="button"
            aria-label="Piilota polun yhteenveto"
            onClick={() => e.setSummaryOpen(false)}
          >
            ▸
          </button>
        </header>
        <p>
          Aloitit käsitteestä{" "}
          <strong>
            {
              data.evidence?.concepts.find((c) => c.id === e.steps[0]?.id)
                ?.label
            }
          </strong>
          .{" "}
          {e.steps.length === 1
            ? "Valitse virtaavan viivan osoittama jatkopiste."
            : `Olet seurannut ${e.steps.length - 1} kirjattua yhteyttä.`}
        </p>
        <p className="graph-summary-note">
          Valintajärjestys on tutkimusreitti. Yhteyksien muodostama kokonaisuus
          ei itsessään osoita syy-seurausketjua.
        </p>
        <ol>
          {e.steps.map((s, i) => {
            const m = s.via ? e.describe(s.via) : undefined;
            const label = (id: string) =>
              data.evidence?.concepts.find((c) => c.id === id)?.label;
            return (
              <li
                key={`${i}:${s.id}`}
                aria-current={i === e.steps.length - 1 ? "step" : undefined}
              >
                <button
                  type="button"
                  className="graph-summary-step"
                  onClick={() => {
                    e.pick(s.id);
                    onPick(s.id);
                  }}
                >
                  {i + 1}. {label(s.id)}
                </button>
                {m && (
                  <>
                    <h4>{m.label}</h4>
                    <p>{m.explanation}</p>
                    <p className="graph-summary-note">
                      {m.to === e.steps[i - 1]?.id
                        ? "Tutkit vaikutusta taaksepäin. "
                        : ""}
                      Kirjattu suunta: {label(m.from)} → {label(m.to)} ·{" "}
                      {m.basis === "causal" && m.reviewStatus === "accepted"
                        ? "Kausaaliseksi arvioitu"
                        : "Selitysehdotus"}
                    </p>
                    <details>
                      <summary>Ehdot, rajat ja lähteet</summary>
                      <p>{m.conditions || "Ehtoja ei ole kirjattu."}</p>
                      <p>{m.limitations || "Rajauksia ei ole kirjattu."}</p>
                      {!(data.evidence?.reasoning?.evidenceLinks ?? []).some(
                        (l) =>
                          l.isCurrent &&
                          l.reviewStatus !== "rejected" &&
                          l.statementId === m.statementId,
                      ) && <p>Suoraa havaintoperustetta ei ole kirjattu.</p>}
                      {(data.evidence?.reasoning?.evidenceLinks ?? [])
                        .filter(
                          (l) =>
                            l.isCurrent &&
                            l.reviewStatus !== "rejected" &&
                            l.statementId === m.statementId,
                        )
                        .map((l) => {
                          const o = data.evidence?.observations.find(
                            (o) => o.id === l.observationId,
                          );
                          return o ? (
                            <p key={l.id}>
                              {
                                {
                                  supports: "Tukee",
                                  challenges: "Haastaa",
                                  limits: "Rajaa",
                                  context_for: "Taustoittaa",
                                }[l.relation]
                              }
                              :{" "}
                              {o.sourceUrl ? (
                                <a
                                  href={o.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {o.title} ↗
                                </a>
                              ) : (
                                o.title
                              )}
                              <br />
                              {l.rationale}
                            </p>
                          ) : null;
                        })}
                    </details>
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <p>
          Valitse aiempi vaihe palataksesi siihen ja kokeillaksesi toista
          haaraa.
        </p>
      </section>
    </>
  );
}

const flowLines = (text: string, limit = 36) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > limit && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
};
/** Flow follows the recorded effect direction, including when the reader explores backwards. */
export function GraphFlow({
  exploration: e,
  id,
  from: a,
  to: b,
  marker,
}: {
  exploration: GraphExploration;
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  marker: string;
}) {
  const ref = useRef<SVGGElement>(null);
  const [captionScale, setCaptionScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => {
      const m = ref.current?.getScreenCTM?.();
      if (!m) return;
      const k = Math.hypot(m.a, m.b);
      if (k > 0) {
        const next = Math.min(8, Math.max(0.35, 1 / k));
        setCaptionScale((previous) =>
          Math.abs(previous - next) > 0.01 ? next : previous,
        );
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  });
  const m = e.describe(id);
  if (!m || !e.edgeLit(id)) return null;
  const chosen = e.chosen(id),
    dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1;
  const bend = Math.min(42, length * 0.18),
    cx = (a.x + b.x) / 2 - (dy / length) * bend,
    cy = (a.y + b.y) / 2 + (dx / length) * bend;
  const d = `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`;
  const x = (a.x + 2 * cx + b.x) / 4,
    y = (a.y + 2 * cy + b.y) / 4;
  const label = flowLines(m.label, 34),
    description = flowLines(m.explanation, 42).slice(0, 2);
  return (
    <g
      ref={ref}
      className={`graph-flow${chosen ? " graph-flow-chosen" : ""}`}
      data-flow-mechanism={id}
    >
      <path className="graph-flow-line" d={d} markerEnd={`url(#${marker})`} />
      <path className="graph-flow-stream" d={d} />
      {!chosen && (
        <text
          className="graph-flow-caption"
          textAnchor="middle"
          transform={`translate(${x} ${y}) scale(${captionScale})`}
          x={0}
          y={-12 - (label.length + description.length - 1) * 12}
        >
          {label.map((line, i) => (
            <tspan
              className="graph-flow-title"
              x={0}
              dy={i ? 12 : 0}
              key={`l${i}`}
            >
              {line}
            </tspan>
          ))}
          {description.map((line, i) => (
            <tspan x={0} dy={12} key={`d${i}`}>
              {line}
              {i === description.length - 1 &&
              flowLines(m.explanation, 42).length > 2
                ? "…"
                : ""}
            </tspan>
          ))}
        </text>
      )}
    </g>
  );
}
