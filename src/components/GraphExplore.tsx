import { assessMechanism, type ExploreContext } from "@/lib/atlas.context";
import { GraphEvidence } from "./GraphEvidence";
import {
  createContext,
  useEffect,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import {
  exploreOptions,
  exploreTransition,
  EMPTY_EXPLORATION,
  type ExploreHistory,
} from "@/lib/atlas.explore";
import { catalogueFor } from "@/lib/teema.system";
import "@/styles/graph-explore.css";

function useExplorationState(data: AtlasData) {
  const [history, setHistory] = useState<ExploreHistory>(EMPTY_EXPLORATION);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const [preview, setPreview] = useState<{
    target: string;
    via?: string;
  } | null>(null);
  useEffect(() => {
    if (!nextOpen) setPreview(null);
  }, [nextOpen]);
  const [context, setContext] = useState<ExploreContext>({});
  const [contextOpen, setContextOpen] = useState(false);
  const [scopeChoice, setScopeChoice] = useState<{
    id: string;
    via: string;
    messages: string[];
  } | null>(null);
  const [inspection, setInspection] = useState<{ kind: string; id: string }[]>(
    [],
  );
  const { steps, pending } = history;
  const current = steps.at(-1)?.id;
  const options = (current ? exploreOptions(data, current, "how") : []).map(
    (o) => ({
      ...o,
      assessment: assessMechanism(data, o.mechanism, context, steps),
    }),
  );
  const chosen = (id: string) => steps.some((s) => s.via === id);
  const candidate = (id: string) =>
    id !== current &&
    options.some(
      (o) => o.target.id === id && o.assessment.status !== "outside",
    ) &&
    !steps.some((s) => s.id === id);
  const pick = (id: string, via?: string, confirmScope = false) => {
    const next = exploreTransition(history, { type: "pick", id, via }, data);
    const appended =
      next.steps.length > steps.length ? next.steps.at(-1) : undefined;
    const option = appended?.via
      ? options.find((o) => o.mechanism.id === appended.via)
      : undefined;
    if (option?.assessment.status === "outside") {
      setScopeChoice({
        id,
        via: option.mechanism.id,
        messages: option.assessment.messages,
      });
      return false;
    }
    if (option?.assessment.status === "context_change" && !confirmScope) {
      setScopeChoice({
        id,
        via: option.mechanism.id,
        messages: option.assessment.messages,
      });
      return false;
    }
    if (option?.assessment.status === "context_change" && appended)
      appended.contextNote = option.assessment.messages.join(" ");
    setScopeChoice(null);
    setHistory(next);
    setPreview(null);
    return !next.pending && next !== history;
  };
  const navigate = (type: "back" | "forward") => {
    setHistory((h) => exploreTransition(h, { type }, data));
    setPreview(null);
  };
  const describe = (id: string) =>
    data.evidence?.reasoning?.mechanisms.find(
      (m) => m.id === id && m.isCurrent && m.reviewStatus !== "rejected",
    );
  const edgePreview = (id: string) =>
    !!preview &&
    options.some(
      (o) =>
        o.mechanism.id === id &&
        o.target.id === preview.target &&
        (!preview.via || preview.via === id),
    );
  return {
    steps,
    context,
    setContext,
    contextOpen,
    setContextOpen,
    scopeChoice,
    setScopeChoice,
    inspection,
    inspect: (kind: string, id: string) => {
      setInspection((previous) => {
        const at = previous.findIndex((x) => x.kind === kind && x.id === id);
        return at >= 0
          ? previous.slice(0, at + 1)
          : [...previous, { kind, id }];
      });
      setSummaryOpen(false);
      setNextOpen(false);
    },
    inspectBack: () => setInspection((p) => p.slice(0, -1)),
    closeInspection: () => setInspection([]),
    start: (id: string) => {
      if (!data.evidence?.concepts.some((c) => c.id === id)) return;
      setHistory((h) => ({
        steps: [{ id }],
        past: [...h.past, h.steps],
        future: [],
      }));
      setInspection([]);
    },
    load: (route: { id: string; via?: string }[]) => {
      if (!route.length) return;
      setHistory((h) => ({
        steps: route.map((s) => (s.via ? { id: s.id, via: s.via } : { id: s.id })),
        past: [...h.past, h.steps],
        future: [],
      }));
      setInspection([]);
      setPreview(null);
      setScopeChoice(null);
    },
    current,
    options,
    history,
    pending,
    summaryOpen,
    setSummaryOpen,
    nextOpen,
    setNextOpen,
    preview,
    setPreview,
    pick,
    chosen,
    candidate,
    describe,
    edgePreview,
    back: () => navigate("back"),
    forward: () => navigate("forward"),
    cancel: () => setHistory((h) => ({ ...h, pending: undefined })),
    clear: () => {
      setHistory((h) => exploreTransition(h, { type: "clear" }, data));
      setSummaryOpen(false);
      setNextOpen(false);
      setPreview(null);
      setScopeChoice(null);
      setInspection([]);
    },
    lit: (id: string) =>
      !current ||
      steps.some((s) => s.id === id) ||
      (preview ? preview.target === id : candidate(id)),
    edgeLit: (id: string) =>
      chosen(id) ||
      (preview
        ? edgePreview(id)
        : options.some(
            (o) => o.mechanism.id === id && o.assessment.status !== "outside",
          )),
    displayedMechanisms: [
      ...new Set([
        ...options.map((o) => o.mechanism.id),
        ...steps.flatMap((s) => (s.via ? [s.via] : [])),
      ]),
    ]
      .map(describe)
      .filter((m): m is NonNullable<typeof m> => !!m),
  };
}
const ExplorationContext = createContext<ReturnType<
  typeof useExplorationState
> | null>(null);
export function GraphExploreProvider({
  data,
  children,
}: {
  data: AtlasData;
  children: ReactNode;
}) {
  const value = useExplorationState(data);
  return (
    <ExplorationContext.Provider value={value}>
      {children}
    </ExplorationContext.Provider>
  );
}
export function useGraphExplore(_data: AtlasData) {
  const value = useContext(ExplorationContext);
  if (!value) throw new Error("GraphExploreProvider missing");
  return value;
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
  const causal =
    choices.length > 0 &&
    choices.every(
      (o) =>
        o.mechanism.basis === "causal" &&
        o.mechanism.reviewStatus === "accepted",
    );
  const nature = causal ? "kausaaliseksi arvioitu" : "selitysehdotus";
  const hint =
    incoming && outgoing
      ? "← Tausta / seuraus →"
      : incoming
        ? "← Mahdollinen taustatekijä"
        : "Mahdollinen seuraus →";
  // Once the reader has picked a first step, keep the guidance visible on the
  // map itself: ring, direction arrow and the nature of the connection.
  const guiding = next && e.steps.length > 0;
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
          <circle
            className={`graph-next-ring${guiding ? " guide" : ""}`}
            cx={x}
            cy={y}
            r={r + 5}
          />
          <text className="graph-next-mark" x={x + r + 8} y={y + 4}>
            {incoming && outgoing ? "↔" : incoming ? "←" : "→"}
          </text>
          <text
            className={`graph-point-hint${guiding ? " guide" : ""}`}
            x={x}
            y={y + r + 19}
            textAnchor="middle"
          >
            {guiding ? `${hint} · ${nature}` : hint}
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

/** Shared route controls with optional context and reader-opened evidence panels. */
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
  const nextId = useId();
  if (!e.current)
    return (
      <>
        <GraphEvidence data={data} exploration={e} />
        <button
          type="button"
          className="graph-catalogue-open"
          onClick={() => e.inspect("catalogue", "all")}
        >
          Tapaukset, palveluketjut ja aineisto
        </button>
        {e.history.future.length || e.history.past.length ? (
          <nav className="graph-trail" aria-label="Oma tutkimuspolku">
            <button
              type="button"
              onClick={e.history.future.length ? e.forward : e.back}
            >
              Palauta polku
            </button>
          </nav>
        ) : null}
      </>
    );
  const previous = e.steps.at(-2);
  const conceptLabel = (id: string) =>
    data.evidence?.concepts.find((c) => c.id === id)?.label ?? id;
  const themeOf = (mid: string) =>
    catalogueFor(data).themes.find((t) =>
      t.mechanisms.some((m) => m.id === mid),
    )?.label;
  const choices = e.options.filter(
    (o) => !e.steps.some((s) => s.id === o.target.id),
  );
  const short = (t?: string, n = 140) =>
    !t ? "" : t.length > n ? t.slice(0, n).trimEnd() + "…" : t;
  return (
    <>
      <GraphEvidence data={data} exploration={e} />
      <div className="graph-context-tools">
        <button
          type="button"
          aria-expanded={e.contextOpen}
          onClick={() => e.setContextOpen(!e.contextOpen)}
        >
          Rajaa tilannetta
        </button>
        <button type="button" onClick={() => e.inspect("catalogue", "all")}>
          Tapaukset ja aineisto
        </button>
      </div>
      {e.contextOpen && (
        <div
          className="graph-context-fields"
          role="group"
          aria-label="Polun tarkastelutilanne"
        >
          <label>
            Alkuvuosi
            <input
              type="number"
              min="1850"
              max="2050"
              value={e.context.start ?? 1850}
              onChange={(event) =>
                e.setContext({
                  ...e.context,
                  start: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </label>
          <label>
            Loppuvuosi
            <input
              type="number"
              min="1850"
              max="2050"
              value={e.context.end ?? 2050}
              onChange={(event) =>
                e.setContext({
                  ...e.context,
                  end: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </label>
          <label>
            Kohderyhmä
            <select
              value={e.context.population ?? ""}
              onChange={(event) =>
                e.setContext({
                  ...e.context,
                  population: event.target.value || undefined,
                })
              }
            >
              <option value="">Kaikki / ei rajausta</option>
              {[
                ...new Set(
                  data.evidence?.observations
                    .map((o) => o.population)
                    .filter(Boolean),
                ),
              ]
                .sort()
                .map((p) => (
                  <option value={p} key={p}>
                    {p}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tapaus
            <select
              value={e.context.caseId ?? ""}
              onChange={(event) =>
                e.setContext({
                  ...e.context,
                  caseId: event.target.value || undefined,
                })
              }
            >
              <option value="">Kaikki / ei tapausrajausta</option>
              {data.publication?.cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            Tekstimuotoisten ehtojen toteutumista ei päätellä automaattisesti.
            Avoimet ajoitukset merkitään.
          </p>
        </div>
      )}
      {e.scopeChoice && (
        <div
          className="graph-mechanism-choice"
          role="group"
          aria-label="Tarkastelutilanteen muutos"
        >
          <p>{e.scopeChoice.messages.join(" ")}</p>
          {e.options.find((o) => o.mechanism.id === e.scopeChoice?.via)
            ?.assessment.status !== "outside" && (
            <button
              type="button"
              onClick={() => {
                const s = e.scopeChoice!;
                if (e.pick(s.id, s.via, true)) onPick(s.id);
              }}
            >
              Jatka eri tarkastelutilanteeseen
            </button>
          )}
          <button type="button" onClick={() => e.setScopeChoice(null)}>
            Palaa valintaan
          </button>
        </div>
      )}
      {e.pending && (
        <div
          className="graph-mechanism-choice"
          role="group"
          aria-label="Valitse kirjattu yhteys"
        >
          <span>Samaan pisteeseen on useita yhteyksiä:</span>
          {e.options
            .filter((o) => o.target.id === e.pending)
            .map((o) => (
              <button
                type="button"
                key={o.mechanism.id}
                onMouseEnter={() =>
                  e.setPreview({ target: o.target.id, via: o.mechanism.id })
                }
                onMouseLeave={() => e.setPreview(null)}
                onFocus={() =>
                  e.setPreview({ target: o.target.id, via: o.mechanism.id })
                }
                onBlur={() => e.setPreview(null)}
                onClick={() => {
                  if (e.pick(o.target.id, o.mechanism.id)) onPick(o.target.id);
                }}
              >
                {o.mechanism.label}
              </button>
            ))}
          <button
            type="button"
            onClick={() => {
              e.cancel();
              e.setPreview(null);
            }}
          >
            Peruuta
          </button>
        </div>
      )}
      <button
        type="button"
        className="graph-next-open"
        hidden={e.nextOpen || e.summaryOpen}
        aria-expanded={e.nextOpen}
        aria-controls={nextId}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          e.setNextOpen(!e.nextOpen);
          if (!e.nextOpen) {
            e.setSummaryOpen(false);
            onOpenSummary();
          }
        }}
      >
        Seuraava askel {e.nextOpen ? "▸" : "◂"}
      </button>
      <section
        id={nextId}
        className={`graph-next${e.nextOpen ? " open" : ""}`}
        aria-label="Valitse seuraava askel"
        aria-hidden={!e.nextOpen}
        inert={!e.nextOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            e.setNextOpen(false);
          }
        }}
      >
        <header className="graph-next-bar">
          <button
            type="button"
            aria-label="Piilota etenemissuunnat"
            onClick={() => e.setNextOpen(false)}
          >
            ▸
          </button>
        </header>
        <p className="graph-next-head">
          <span>Askel {e.steps.length}</span>
          <strong>{conceptLabel(e.current)}</strong>
        </p>
        {choices.length === 0 ? (
          <p className="graph-next-empty">
            Tästä pisteestä ei ole kirjattua jatkoa. Palaa edelliseen tai
            valitse toinen aloituspiste.
          </p>
        ) : (
          <>
            <p className="graph-next-lead">
              {choices.length} kirjattua etenemissuuntaa – valitse seuraava
              askel:
            </p>
            <ul>
              {choices.map((o) => {
                const theme = themeOf(o.mechanism.id);
                return (
                  <li key={o.mechanism.id}>
                    <button
                      type="button"
                      disabled={o.assessment.status === "outside"}
                      onMouseEnter={() =>
                        e.setPreview({
                          target: o.target.id,
                          via: o.mechanism.id,
                        })
                      }
                      onMouseLeave={() => e.setPreview(null)}
                      onFocus={() =>
                        e.setPreview({
                          target: o.target.id,
                          via: o.mechanism.id,
                        })
                      }
                      onBlur={() => e.setPreview(null)}
                      onClick={() => {
                        if (e.pick(o.target.id, o.mechanism.id))
                          onPick(o.target.id);
                      }}
                    >
                      <span
                        className={`graph-next-dir ${o.incoming ? "back" : "fwd"}`}
                      >
                        {o.incoming
                          ? "← Taustatekijä: mikä johtaa tähän"
                          : "Seuraus: mihin tämä vaikuttaa →"}
                      </span>
                      <span className="graph-next-target">
                        {o.incoming
                          ? `${o.target.label} → ${conceptLabel(e.current!)}`
                          : `${conceptLabel(e.current!)} → ${o.target.label}`}
                      </span>
                      <span className="graph-next-mech">
                        {o.mechanism.label}
                        {o.mechanism.basis === "causal" &&
                        o.mechanism.reviewStatus === "accepted"
                          ? " · kausaaliseksi arvioitu"
                          : " · selitysehdotus"}
                      </span>
                      <span className="graph-context-status">
                        {o.assessment.status === "outside"
                          ? "Rajauksen ulkopuolella"
                          : o.assessment.status === "context_change"
                            ? "Tarkastelutilanne vaihtuu"
                            : o.assessment.status === "unknown"
                              ? "Soveltaminen tarkistettava"
                              : "Aikarajaus sopii"}
                      </span>
                      <span className="graph-next-why">
                        {short(o.mechanism.explanation)}
                      </span>
                      <span className="graph-next-where">
                        <em>Esiintyy tyypillisesti, kun:</em>{" "}
                        {short(o.mechanism.conditions, 160) ||
                          "tilannetta ei ole kirjattu."}
                        {theme && <> · Teema: {theme}</>}
                      </span>
                    </button>
                    <p className="graph-context-status">
                      {o.assessment.messages.join(" ")}
                    </p>
                    <button
                      type="button"
                      className="graph-evidence-link"
                      onClick={() => e.inspect("mechanism", o.mechanism.id)}
                    >
                      Tutki perustetta ja lähteitä
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
      <nav className="graph-trail" aria-label="Oma tutkimuspolku">
        <span aria-live="polite">
          {e.steps.length}{" "}
          {e.steps.length === 1 ? "valittu piste" : "valittua pistettä"} ·
          vihjeet ovat kirjattuja selitysehdotuksia
          {e.current &&
            (() => {
              const next = new Set(
                e.options
                  .map((o) => o.target.id)
                  .filter((id) => e.candidate(id)),
              ).size;
              return next === 0 ? (
                <strong className="graph-trail-end">
                  {" "}
                  · Tästä pisteestä ei ole kirjattuja jatkoaskelia – palaa
                  edelliseen tai aloita alusta
                </strong>
              ) : (
                ` · ${next} ${next === 1 ? "jatkoaskel näkyy" : "jatkoaskelta näkyy"} virtaavina viivoina ja sykkivinä renkaina`
              );
            })()}
        </span>
        {e.history.past.length > 0 && (
          <button
            type="button"
            aria-label={`Palaa: ${previous ? conceptLabel(previous.id) : "edellinen valinta"}`}
            onClick={e.back}
          >
            ← Edellinen
          </button>
        )}
        {e.history.future.length > 0 && (
          <button
            type="button"
            aria-label="Eteenpäin polulla"
            onClick={e.forward}
          >
            Eteenpäin →
          </button>
        )}
        <button type="button" onClick={e.clear}>
          Tyhjennä polku
        </button>
      </nav>
      <button
        type="button"
        className="graph-summary-open"
        hidden={e.nextOpen || e.summaryOpen}
        aria-expanded={e.summaryOpen}
        aria-controls={summaryId}
        onClick={() => {
          e.setSummaryOpen(!e.summaryOpen);
          if (!e.summaryOpen) {
            e.setNextOpen(false);
            onOpenSummary();
          }
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
        {e.steps.length > 1 && (
          <div className="graph-summary-synthesis">
            <h4>Mitä reitti kertoo?</h4>
            {(() => {
              const links = e.steps.slice(1).flatMap((s, i) => {
                const m = s.via ? e.describe(s.via) : undefined;
                return m ? [{ m, reverse: m.to === e.steps[i]?.id }] : [];
              });
              const reverse = links.filter((l) => l.reverse).length;
              const provisional = links.filter(
                (l) =>
                  l.m.basis !== "causal" || l.m.reviewStatus !== "accepted",
              ).length;
              const gaps = links.filter(
                ({ m }) =>
                  !(data.evidence?.reasoning?.evidenceLinks ?? []).some(
                    (l) =>
                      l.statementId === m.statementId &&
                      l.isCurrent &&
                      l.reviewStatus !== "rejected",
                  ),
              ).length;
              return (
                <>
                  <p>
                    {links.length - reverse} askelta mahdollisten seurausten
                    suuntaan ja {reverse} askelta taustatekijöihin päin.
                  </p>
                  <p>
                    {provisional} yhteyttä on selitysehdotuksia.{" "}
                    {gaps > 0
                      ? `${gaps} yhteydeltä puuttuu suora havaintokytkentä.`
                      : "Yhteyksien havaintoperusteet löytyvät vaiheiden lähdetiedoista."}
                  </p>
                </>
              );
            })()}
          </div>
        )}
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
                    <button
                      type="button"
                      className="graph-evidence-link"
                      onClick={() => e.inspect("mechanism", m.id)}
                    >
                      Avaa väite → havainnot → lähteet
                    </button>
                    {Object.keys(e.context).length > 0 && (
                      <p className="graph-context-status">
                        Nykyinen rajaus:{" "}
                        {assessMechanism(
                          data,
                          m,
                          e.context,
                          e.steps.slice(0, i),
                        ).messages.join(" ") || "Ajallinen rajaus sopii."}
                      </p>
                    )}
                    {s.contextNote && (
                      <p className="graph-context-status">
                        Tarkastelutilanne vaihtui: {s.contextNote}
                      </p>
                    )}
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
    description = e.edgePreview(id)
      ? flowLines(m.explanation, 42).slice(0, 2)
      : [];
  return (
    <g
      ref={ref}
      className={`graph-flow${chosen ? " graph-flow-chosen" : ""}${e.edgePreview(id) ? " graph-flow-preview" : ""}`}
      data-flow-mechanism={id}
    >
      <path className="graph-flow-line" d={d} markerEnd={`url(#${marker})`} />
      <path className="graph-flow-stream" d={d} />
      {(!chosen || e.edgePreview(id)) && (
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
