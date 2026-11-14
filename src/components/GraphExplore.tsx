import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import {
  exploreOptions,
  EXPLORE_QUESTIONS,
  type ExploreQuestion,
} from "@/lib/atlas.explore";
import "@/styles/graph-explore.css";
export function useGraphExplore(data: AtlasData) {
  const [steps, setSteps] = useState<{ id: string; via?: string }[]>([]);
  const [question, setQuestion] = useState<ExploreQuestion | null>(null);
  const current = steps.at(-1)?.id;
  const options =
    current && question ? exploreOptions(data, current, question) : [];
  const pick = (id: string, via?: string) => {
    const existing = steps.findIndex((s) => s.id === id);
    const next = via
      ? options.find((o) => o.target.id === id && o.mechanism.id === via)
      : options.find((o) => o.target.id === id);
    setSteps((previous) =>
      existing >= 0
        ? previous.slice(0, existing + 1)
        : next
          ? [...previous, { id, via: next.mechanism.id }]
          : [{ id }],
    );
    setQuestion(null);
  };
  return {
    steps,
    current,
    question,
    setQuestion,
    options,
    pick,
    clear: () => {
      setSteps([]);
      setQuestion(null);
    },
    lit: (id: string) =>
      !current ||
      steps.some((s) => s.id === id) ||
      options.some((o) => o.target.id === id),
    edgeLit: (id: string) =>
      steps.some((s) => s.via === id) ||
      options.some((o) => o.mechanism.id === id),
  };
}
export type GraphExploration = ReturnType<typeof useGraphExplore>;
export function GraphExplore({
  data,
  exploration: e,
  onPick,
  start,
  onCloseStart,
}: {
  data: AtlasData;
  exploration: GraphExploration;
  onPick: (id: string) => void;
  start?: { label: string; ids: string[] };
  onCloseStart?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 72 });
  useLayoutEffect(() => {
    const place = () => {
      const root = ref.current?.parentElement;
      const anchor = root?.querySelector('[data-path-active="true"]');
      if (!root || !anchor || !ref.current) return;
      const box = root.getBoundingClientRect(),
        point = anchor.getBoundingClientRect();
      if (!box.width) return;
      const left = Math.max(
        8,
        Math.min(
          box.width - ref.current.offsetWidth - 8,
          point.right - box.left + 14,
        ),
      );
      const top = Math.max(
        64,
        Math.min(
          box.height - ref.current.offsetHeight - 70,
          point.top - box.top,
        ),
      );
      setPosition((p) =>
        p.left === left && p.top === top ? p : { left, top },
      );
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>(".graph-questions button")
      ?.focus({ preventScroll: true });
  }, [e.current]);
  const concepts = data.evidence?.concepts ?? [];
  const current = concepts.find((c) => c.id === e.current);
  if (!current && !start) return null;
  const select = (id: string, via?: string) => {
    e.pick(id, via);
    onPick(id);
  };
  return (
    <>
      <div
        className="graph-explore"
        ref={ref}
        style={position}
        role="region"
        aria-label="Tutki valittua käsitettä"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            e.clear();
            onCloseStart?.();
          }
        }}
      >
        <header>
          <strong>{current?.label ?? start?.label}</strong>
          <button
            type="button"
            aria-label="Sulje polun tutkiminen"
            onClick={() => {
              e.clear();
              onCloseStart?.();
            }}
          >
            ×
          </button>
        </header>
        {!current && start && (
          <>
            <p>
              Valitse, mistä käsitteestä haluat tietää lisää. Nämä ovat
              teemajäseniä, eivät syitä tai seurauksia.
            </p>
            <div className="graph-questions">
              {concepts
                .filter((c) => start.ids.includes(c.id))
                .map((c) => (
                  <button type="button" key={c.id} onClick={() => select(c.id)}>
                    {c.label}
                  </button>
                ))}
            </div>
          </>
        )}
        {current && (
          <>
            <p>{current.definition}</p>
            <p>Mitä haluat tietää lisää?</p>
            <div className="graph-questions">
              {EXPLORE_QUESTIONS.map((q) => (
                <button
                  type="button"
                  key={q.id}
                  aria-pressed={e.question === q.id}
                  onClick={() => e.setQuestion(q.id)}
                >
                  {q.label}
                </button>
              ))}
            </div>
            {e.question && (
              <div className="graph-options" aria-live="polite">
                {!e.options.length && (
                  <p>
                    Tähän suuntaan ei ole kirjattua vaikutusmekanismia. Voit
                    vaihtaa kysymystä tai valita uuden aloituspisteen.
                  </p>
                )}
                {e.options.map((o) => (
                  <article key={o.mechanism.id}>
                    <small>
                      {o.incoming
                        ? "Edeltävä tekijä → valittu käsite"
                        : "Valittu käsite → mahdollinen seuraus"}{" "}
                      ·{" "}
                      {o.mechanism.basis === "causal" &&
                      o.mechanism.reviewStatus === "accepted"
                        ? "Kausaaliseksi arvioitu"
                        : "Selitysehdotus"}
                    </small>
                    <button
                      type="button"
                      onClick={() => select(o.target.id, o.mechanism.id)}
                    >
                      {o.target.label} {o.incoming ? "←" : "→"}
                    </button>
                    <strong>{o.mechanism.label}</strong>
                    <p>
                      {e.question === "conditions"
                        ? o.mechanism.conditions || "Ehtoja ei ole kirjattu."
                        : o.mechanism.explanation ||
                          "Välitystapaa ei ole kuvattu."}
                    </p>
                    <details>
                      <summary>Ehdot, rajat ja perusteet</summary>
                      <p>
                        {o.mechanism.conditions || "Ehtoja ei ole kirjattu."}
                      </p>
                      <p>
                        {o.mechanism.limitations ||
                          "Rajauksia ei ole kirjattu."}
                      </p>
                      <p>
                        Kirjattu suunta:{" "}
                        {concepts.find((c) => c.id === o.mechanism.from)?.label}{" "}
                        → {concepts.find((c) => c.id === o.mechanism.to)?.label}
                      </p>
                      {!(data.evidence?.reasoning?.evidenceLinks ?? []).some(
                        (l) =>
                          l.isCurrent &&
                          l.reviewStatus !== "rejected" &&
                          l.statementId === o.mechanism.statementId,
                      ) && (
                        <p>
                          Suoraa havaintoperustetta ei ole kirjattu. Yhteys on
                          selitysehdotus.
                        </p>
                      )}
                      {(data.evidence?.reasoning?.evidenceLinks ?? [])
                        .filter(
                          (l) =>
                            l.isCurrent &&
                            l.reviewStatus !== "rejected" &&
                            l.statementId === o.mechanism.statementId,
                        )
                        .map((l) => {
                          const obs = data.evidence?.observations.find(
                            (x) => x.id === l.observationId,
                          );
                          return obs ? (
                            <p key={l.id}>
                              {obs.sourceUrl ? (
                                <a
                                  href={obs.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {obs.title} ↗
                                </a>
                              ) : (
                                obs.title
                              )}
                              <br />
                              {
                                {
                                  supports: "Tukee",
                                  challenges: "Haastaa",
                                  limits: "Rajaa",
                                  context_for: "Taustoittaa",
                                }[l.relation]
                              }
                              : {l.rationale}
                            </p>
                          ) : null;
                        })}
                    </details>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {!!e.steps.length && (
        <nav className="graph-trail" aria-label="Oma tutkimuspolku">
          <span>Tutkimuspolku · valintajärjestys</span>
          {e.steps.map((s, i) => (
            <button
              type="button"
              key={`${i}:${s.id}`}
              aria-current={i === e.steps.length - 1 ? "step" : undefined}
              onClick={() => select(s.id)}
            >
              {i + 1}. {concepts.find((c) => c.id === s.id)?.label}
            </button>
          ))}
          <button type="button" onClick={e.clear}>
            Tyhjennä polku
          </button>
        </nav>
      )}
    </>
  );
}
