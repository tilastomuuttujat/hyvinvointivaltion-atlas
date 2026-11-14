import { useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import { exploreOptions } from "@/lib/atlas.explore";
import "@/styles/graph-explore.css";

export function useGraphExplore(data: AtlasData) {
  const [steps, setSteps] = useState<{ id: string; via?: string }[]>([]);
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
    current,
    options,
    pick,
    chosen,
    candidate,
    clear: () => setSteps([]),
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
}: {
  data: AtlasData;
  exploration: GraphExploration;
  onPick: (id: string) => void;
}) {
  if (!e.current) return null;
  const previous = e.steps.at(-2);
  return (
    <nav className="graph-trail" aria-label="Oma tutkimuspolku">
      <span aria-live="polite">
        {e.steps.length}{" "}
        {e.steps.length === 1 ? "valittu piste" : "valittua pistettä"} · vihjeet
        ovat kirjattuja selitysehdotuksia
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
  );
}
