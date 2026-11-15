import { useState } from "react";
import type { AtlasData } from "@/lib/atlas.functions";
import type { PublicRow } from "@/lib/atlas.publication";
import type { GraphExploration } from "./GraphExplore";
const relations: Record<string, string> = {
  supports: "Tukee",
  challenges: "Haastaa",
  limits: "Rajaa",
  context_for: "Taustoittaa",
  assumption_for: "On oletuksena",
};
const vocabulary: Record<string, string> = {
  empirical_claim: "Empiirinen väite",
  hypothesis: "Hypoteesi",
  synthesis: "Synteesi",
  evaluation: "Arvio",
  scenario: "Skenaario",
  needs_review: "Tarkistettavana",
  accepted: "Tarkistettu",
  draft: "Luonnos",
  not_collected: "Tietoa ei ole kerätty",
  aggregate_only: "Vain kokonaistaso",
  disaggregated: "Eritelty",
  not_assessed: "Ei arvioitu",
  not_available: "Ei saatavilla",
  automatic: "Automaattinen siirtymä",
  correct: "Korjaaminen",
  direct_access: "Suora pääsy",
  feedback: "Palaute",
  progress: "Eteneminen",
  resume: "Jatkaminen",
  hypothesized: "Selitysehdotus",
  association: "Tilastollinen yhteys",
  causal: "Kausaaliseksi arvioitu",
};
const text = (v: unknown): string =>
  typeof v === "string"
    ? (vocabulary[v] ?? v)
    : v == null
      ? "Ei kirjattu"
      : Array.isArray(v)
        ? v.map(text).join(", ")
        : typeof v === "object"
          ? Object.entries(v)
              .map(
                ([key, value]) => `${key.replaceAll("_", " ")}: ${text(value)}`,
              )
              .join("; ")
          : String(v);

export function GraphEvidence({
  data,
  exploration: e,
}: {
  data: AtlasData;
  exploration: GraphExploration;
}) {
  const selection = e.inspection.at(-1),
    r = data.evidence?.reasoning,
    p = data.publication;
  const [query, setQuery] = useState("");
  if (!selection) return null;
  const { kind, id } = selection;
  const inspect = (kind: string, id: string) => e.inspect(kind, id);
  const button = (label: string, kind: string, id: string) => (
    <button
      type="button"
      className="graph-evidence-link"
      onClick={() => inspect(kind, id)}
    >
      {label} →
    </button>
  );
  const label = (id: string) =>
    data.evidence?.concepts.find((c) => c.id === id)?.label ?? id;
  const sources = (statementId: string) =>
    (r?.evidenceLinks ?? []).filter(
      (l) =>
        l.statementId === statementId &&
        l.isCurrent &&
        l.reviewStatus !== "rejected",
    );
  const fields = (row: PublicRow, keys: [string, string][]) =>
    keys.map(([key, title]) =>
      row[key] != null && row[key] !== "" ? (
        <div key={key}>
          <h4>{title}</h4>
          <p>{text(row[key])}</p>
        </div>
      ) : null,
    );
  const caseButton = (c: PublicRow) => button(c.title, "case", c.case_id);
  const concept = data.evidence?.concepts.find((c) => c.id === id);
  const mechanism = r?.mechanisms.find((m) => m.id === id),
    statement = r?.statements.find((s) => s.id === id),
    observation = data.evidence?.observations.find((o) => o.id === id);
  const selectedCase = p?.cases.find((c) => c.case_id === id),
    framework = p?.frameworks.find((f) => f.framework_id === id),
    stage = p?.stages.find((s) => s.stage_id === id);
  const source: PublicRow | undefined =
    r?.sources.find((s) => s.id === id) ??
    p?.sources.find((s) => s.source_id === id);
  const sourceUrl =
    source?.url ?? (id.startsWith("url:") ? id.slice(4) : undefined);
  const titles: Record<string, string> = {
    catalogue: "Tapaukset ja aineiston rakenne",
    mechanism: mechanism?.label ?? id,
    statement: statement?.title ?? id,
    observation: observation?.title ?? id,
    source: source?.title ?? "Alkuperäinen lähde",
    case: selectedCase?.title ?? id,
    framework: framework?.title ?? id,
    stage: stage?.label_fi ?? id,
    concept: concept?.label ?? id,
    theme: p?.themes.find((t) => t.id === id)?.label ?? id,
    comparison: p?.comparisons.find((c) => c.comparison_id === id)?.title ?? id,
    comparisonRow: p?.comparisonRows.find((c) => c.row_id === id)?.title ?? id,
    gap: p?.evidenceGaps.find((g) => g.gap_id === id)?.title ?? id,
  };
  return (
    <section
      className="graph-summary graph-evidence open"
      role="complementary"
      aria-label="Perusteen ja lähteen tarkastelu"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          e.closeInspection();
        }
      }}
    >
      <header>
        <h3>{titles[kind] ?? id}</h3>
        <button
          type="button"
          aria-label="Sulje perusteen tarkastelu"
          onClick={e.closeInspection}
        >
          ×
        </button>
      </header>
      <nav aria-label="Perusteketjun sijainti">
        {e.inspection.length > 1 && (
          <button type="button" onClick={e.inspectBack}>
            ← Edellinen taso
          </button>
        )}
        <span>
          {kind === "mechanism"
            ? "Mekanismi"
            : kind === "statement"
              ? "Väite"
              : kind === "observation"
                ? "Havainto"
                : kind === "source"
                  ? "Lähde"
                  : "Tausta ja rajaukset"}
        </span>
      </nav>
      {kind === "catalogue" && (
        <>
          {!p ? (
            <p>
              Laajempi julkaisuaineisto tulee saataville seuraavassa
              Neon-viennissä. Nykyiset mekanismit, havainnot ja lähteet ovat
              edelleen tutkittavissa.
            </p>
          ) : (
            <>
              <p>
                Julkaisuversio {p.generatedAt}. {p.policy}
              </p>
              {p.exclusions && (
                <p>
                  {p.exclusions.caseRoutesNotPublishable} muuta tapausreittiä ja{" "}
                  {p.exclusions.serviceTransitionsNotPublishable}{" "}
                  palvelusiirtymää jäävät tämän viennin ulkopuolelle julkaisu-
                  tai ajantasaisuusrajojen vuoksi.
                </p>
              )}
              <h4>Dokumentoidut tapaukset ja käsitteelliset pilotit</h4>
              {p.cases.map((c) => (
                <p key={c.case_id}>
                  {caseButton(c)}
                  <small>
                    {c.case_kind === "conceptual_pilot"
                      ? "Käsitteellinen pilotti, ei havaittu tapaus"
                      : "Dokumentoitu tapaus"}{" "}
                    · {text(c.review_status)}
                  </small>
                </p>
              ))}
              <h4>Palvelu- ja korjausketjut</h4>
              {p.frameworks.map((f) => (
                <p key={f.framework_id}>
                  {button(f.title, "framework", f.framework_id)}
                </p>
              ))}
              <h4>Teemat</h4>
              {p.themes.map((t) => (
                <p key={t.id}>{button(t.label, "theme", t.id)}</p>
              ))}
              <h4>Vertailuasetelmat</h4>
              {p.comparisons.map((c) => (
                <p key={c.comparison_id}>
                  {button(c.title, "comparison", c.comparison_id)}
                </p>
              ))}
              <h4>Tutkimusnäytön vertailut</h4>
              {p.comparisonRows.map((c) => (
                <p key={c.row_id}>
                  {button(c.title, "comparisonRow", c.row_id)}
                </p>
              ))}
              <h4>Aineistoaukot</h4>
              {p.evidenceGaps.map((g) => (
                <p key={g.gap_id}>{button(g.title, "gap", g.gap_id)}</p>
              ))}
              <details>
                <summary>
                  Tilastosarjojen menetelmät ja ulottuvuudet (
                  {p.seriesMetadata.length})
                </summary>
                <input
                  aria-label="Hae sarjametadataa"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {p.seriesMetadata
                  .filter((m) =>
                    `${m.series_key} ${m.definition}`
                      .toLocaleLowerCase()
                      .includes(query.toLocaleLowerCase()),
                  )
                  .slice(0, 20)
                  .map((m) => (
                    <details key={m.series_key}>
                      <summary>{m.definition || m.series_key}</summary>
                      {fields(m, [
                        ["population", "Kohderyhmä"],
                        ["comparability", "Vertailukelpoisuus"],
                        ["method_breaks", "Menetelmäkatkot"],
                        ["missing_years", "Aineistoaukot"],
                      ])}
                      {p.seriesDimensions
                        .filter((d) => d.series_key === m.series_key)
                        .map((d) => (
                          <p key={`${d.series_key}:${d.dimension_id}`}>
                            {
                              p.dimensions.find(
                                (x) => x.dimension_id === d.dimension_id,
                              )?.label_fi
                            }
                            : {d.category_label || d.availability} ·{" "}
                            {d.comparability}
                          </p>
                        ))}
                    </details>
                  ))}
                <p>Näytetään enintään 20 hakutulosta kerrallaan.</p>
              </details>
            </>
          )}
        </>
      )}
      {kind === "concept" && concept && (
        <>
          <p>{concept.definition}</p>
          <p>{concept.limitations}</p>
          <button type="button" onClick={() => e.start(concept.id)}>
            Aloita polku tästä käsitteestä
          </button>
          <h4>Kirjatut väitteet</h4>
          {r?.statementConcepts
            .filter((sc) => sc.conceptId === id)
            .map((sc) => (
              <p key={sc.statementId}>
                {button(
                  r.statements.find((s) => s.id === sc.statementId)?.title ??
                    sc.statementId,
                  "statement",
                  sc.statementId,
                )}
              </p>
            ))}
          <h4>Kirjatut havainnot</h4>
          {[
            ...new Set(
              data.evidence?.links
                .filter(
                  (l) => l.conceptId === id && l.reviewStatus !== "rejected",
                )
                .map((l) => l.observationId),
            ),
          ]
            .slice(0, 40)
            .map((oid) => (
              <p key={oid}>
                {button(
                  data.evidence?.observations.find((o) => o.id === oid)
                    ?.title ?? oid,
                  "observation",
                  oid,
                )}
              </p>
            ))}
        </>
      )}
      {kind === "mechanism" && mechanism && (
        <>
          <p>
            {label(mechanism.from)} → {label(mechanism.to)}
          </p>
          <p>{mechanism.explanation}</p>
          <p>{mechanism.conditions}</p>
          <p>{mechanism.limitations}</p>
          <p>
            {text(mechanism.basis)} · {text(mechanism.reviewStatus)}
          </p>
          {button(
            "Tutki mekanismiin kirjattua väitettä",
            "statement",
            mechanism.statementId,
          )}
        </>
      )}
      {kind === "statement" && statement && (
        <>
          <p>{statement.text}</p>
          <p>
            Laji: {text(statement.kind)} · {text(statement.reviewStatus)}
          </p>
          <p>
            Ajanjakso: {statement.start ?? "avoin"} – {statement.end ?? "avoin"}
            . {statement.scope}
          </p>
          <h4>Soveltamisehdot</h4>
          <p>{statement.conditions || "Ei kirjattu"}</p>
          <h4>Rajaukset</h4>
          <p>{statement.limitations}</p>
          <h4>Tukeva, haastava ja rajaava näyttö</h4>
          {sources(id).length === 0 && (
            <p>Suoraa havaintokytkentää ei ole kirjattu.</p>
          )}
          {sources(id).map((l) => (
            <article key={l.id}>
              <h4>{relations[l.relation]}</h4>
              {button(
                data.evidence?.observations.find(
                  (o) => o.id === l.observationId,
                )?.title ?? l.observationId,
                "observation",
                l.observationId,
              )}
              <p>{l.rationale}</p>
              <p>
                {l.applicability} {l.limitations}
              </p>
              <p>
                {l.assessmentBasis} ·{" "}
                {l.causalEffectIdentified
                  ? "Kausaalinen vaikutus arvioitu"
                  : "Ei yksin kausaalisen vaikutuksen vahvistus"}
              </p>
            </article>
          ))}
          <h4>Väitteiden väliset argumenttisuhteet</h4>
          {r?.statementRelations
            .filter(
              (l) =>
                (l.from === id || l.to === id) &&
                l.isCurrent &&
                l.reviewStatus !== "rejected",
            )
            .map((l, i) => (
              <p key={i}>
                {relations[l.relation] ?? l.relation}:{" "}
                {button(
                  r.statements.find(
                    (s) => s.id === (l.from === id ? l.to : l.from),
                  )?.title ?? "Väite",
                  "statement",
                  l.from === id ? l.to : l.from,
                )}
                {l.rationale} {l.limitations}
              </p>
            ))}
        </>
      )}
      {kind === "observation" && observation && (
        <>
          <p>
            {observation.finding ??
              `${observation.value} ${observation.unit ?? ""}`}
          </p>
          <p>
            Havaintojakso {observation.start ?? "avoin"}–
            {observation.end ?? "avoin"}. Julkaisuvuosi{" "}
            {observation.publicationYear ?? "ei kirjattu"}.
          </p>
          <p>Kohderyhmä: {observation.population}</p>
          <p>Tutkimusasetelma: {observation.design ?? "Tilastohavainto"}</p>
          <p>{observation.limitations}</p>
          <p>
            {observation.verification} · {observation.valueKind}
          </p>
          {r?.observationSources
            .filter(
              (s) =>
                s.observationId === id &&
                s.isCurrent &&
                s.reviewStatus !== "rejected",
            )
            .map((s) => (
              <p key={s.sourceId}>
                {button(
                  r.sources.find((x) => x.id === s.sourceId)?.title ??
                    "Lähdekortti",
                  "source",
                  s.sourceId,
                )}
                {s.locator}
              </p>
            ))}
          {!r?.observationSources.some((s) => s.observationId === id) &&
            button(
              "Tutki alkuperäistä lähdeosoitetta",
              "source",
              `url:${observation.sourceUrl}`,
            )}
          {observation.seriesKey &&
            (() => {
              const m = p?.seriesMetadata.find(
                (m) => m.series_key === observation.seriesKey,
              );
              return m ? (
                <>
                  <h4>Sarjan menetelmät</h4>
                  {fields(m, [
                    ["definition", "Määritelmä"],
                    ["population", "Kohderyhmä"],
                    ["price_basis", "Hintaperusta"],
                    ["comparability", "Vertailukelpoisuus"],
                    ["method_breaks", "Menetelmäkatkot"],
                    ["missing_years", "Puuttuvat vuodet"],
                  ])}
                  {p?.comparisons
                    .filter((c) =>
                      c.series_keys.includes(observation.seriesKey),
                    )
                    .map((c) => (
                      <p key={c.comparison_id}>
                        {button(c.title, "comparison", c.comparison_id)}
                      </p>
                    ))}
                </>
              ) : null;
            })()}
        </>
      )}
      {kind === "source" && (
        <>
          <p>{source?.version ?? source?.source_version}</p>
          <p>{source?.verification}</p>
          {sourceUrl && /^https?:\/\//.test(sourceUrl) ? (
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              Avaa alkuperäinen lähde ↗
            </a>
          ) : (
            <p>Julkaistua lähdeosoitetta ei ole.</p>
          )}
        </>
      )}
      {kind === "case" && selectedCase && (
        <>
          <p>
            {selectedCase.case_kind === "conceptual_pilot"
              ? "Käsitteellinen pilotti, ei havaittu tapaus."
              : "Dokumentoitu tapaus; ei välttämättä seurattu yksilötapaus."}{" "}
            · {text(selectedCase.review_status)}
          </p>
          {fields(selectedCase, [
            ["decision_or_practice", "Päätös tai toimintatapa"],
            ["goal", "Tavoite"],
            ["decision_actors", "Toimijat"],
            ["influence_conditions", "Vaikutusmahdollisuuksien ehdot"],
            ["beneficiaries", "Mahdolliset hyötyjät"],
            ["cost_bearers", "Kustannusten kantajat"],
            ["time_horizon", "Ajallinen rajaus"],
            ["evidence_summary", "Näyttö"],
            ["alternative_explanation", "Vaihtoehtoinen selitys"],
            ["limitations", "Tulkinnan rajat"],
            ["repair_responsibility", "Korjausvastuu"],
          ])}
          <h4>Julkaistut tapausreitit</h4>
          {!p?.caseRoutes.some((c) => c.case_id === id) && (
            <p>
              Tälle tapaukselle ei ole tässä viennissä julkaistavaa
              mekanismireittiä. Palvelukuvaus ei korvaa puuttuvaa
              vaikutusketjua.
            </p>
          )}
          {p?.caseRoutes
            .filter((c) => c.case_id === id)
            .map((c) => {
              const path = r?.paths.find((p) => p.id === c.path_id);
              return (
                <article key={c.path_id}>
                  <h4>{path?.title}</h4>
                  <p>
                    {c.route_kind}: {c.branch_conditions}
                  </p>
                  {path && (
                    <>
                      <p>{path.introduction}</p>
                      <ol>
                        {path.steps.map((s) => (
                          <li key={s.order}>
                            {label(s.conceptId)}: {s.caption}
                          </li>
                        ))}
                      </ol>
                      <p>{path.limitations}</p>
                      <button
                        type="button"
                        onClick={() => {
                          e.setContext({ ...e.context, caseId: id });
                          e.start(path.steps[0]!.conceptId);
                        }}
                      >
                        Aloita tämän reitin tutkiminen
                      </button>
                    </>
                  )}
                </article>
              );
            })}
          {p?.caseReferences
            .filter((x) => x.case_id === id)
            .map((ref) => (
              <p key={ref.reference_id}>
                {button(ref.title, "source", ref.source_id)}
                {ref.relation_type}: {ref.scope_note}
              </p>
            ))}
          {p?.caseEvidence
            .filter((x) => x.case_id === id)
            .map((x) => (
              <p key={`${x.stage_id}:${x.observation_id}`}>
                {x.evidence_role}:{" "}
                {button(
                  data.evidence?.observations.find(
                    (o) => o.id === x.observation_id,
                  )?.title ?? x.observation_id,
                  "observation",
                  x.observation_id,
                )}
                {x.rationale} {x.limitations}
              </p>
            ))}
          <h4>Mittarimääritelmät — eivät mitattuja tuloksia</h4>
          {p?.caseMetrics
            .filter((x) => x.case_id === id)
            .map((m) => (
              <details key={m.metric_id}>
                <summary>
                  {m.label_fi} · {text(m.data_status)}
                </summary>
                {fields(m, [
                  ["operational_definition", "Määritelmä"],
                  ["denominator", "Nimittäjä"],
                  ["required_breakdowns", "Tarvittavat erittelyt"],
                  ["collection_plan", "Keruu"],
                  ["limitations", "Rajaukset"],
                ])}
              </details>
            ))}
          {p?.frameworkCaseLinks
            .filter((x) => x.case_id === id)
            .map((x) => (
              <p key={x.framework_id}>
                {button(
                  p.frameworks.find((f) => f.framework_id === x.framework_id)
                    ?.title ?? x.framework_id,
                  "framework",
                  x.framework_id,
                )}
                {x.applicability} {x.limitations}
              </p>
            ))}
        </>
      )}
      {kind === "framework" && framework && (
        <>
          <p>{framework.principle}</p>
          <p>{framework.scope_note}</p>
          <p>
            Menettelyvaiheet ja niiden siirtymät; eivät automaattisesti
            kausaalisia vaikutuksia.
          </p>
          <ol>
            {p?.stages
              .filter((s) => s.framework_id === id)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((s) => (
                <li key={s.stage_id}>
                  {button(s.label_fi, "stage", s.stage_id)}
                  <p>{s.definition}</p>
                </li>
              ))}
          </ol>
          <h4>Mittarimääritelmät</h4>
          {p?.metrics
            .filter((m) => m.framework_id === id)
            .map((m) => (
              <details key={m.metric_id}>
                <summary>
                  {m.label_fi} · {text(m.data_status)}
                </summary>
                {fields(m, [
                  ["operational_definition", "Määritelmä"],
                  ["numerator", "Osoittaja"],
                  ["denominator", "Nimittäjä"],
                  ["non_user_coverage", "Palvelun ulkopuolelle jääneet"],
                  ["missing_data_rule", "Puuttuvan tiedon käsittely"],
                  ["limitations", "Rajaukset"],
                ])}
              </details>
            ))}
        </>
      )}
      {kind === "stage" && stage && (
        <>
          <p>{stage.definition}</p>
          <h4>Kirjatut menettelysiirtymät</h4>
          {p?.transitions
            .filter((t) => t.from_stage_id === id)
            .map((t) => (
              <article key={t.transition_id}>
                {button(
                  p.stages.find((s) => s.stage_id === t.to_stage_id)
                    ?.label_fi ?? t.to_stage_id,
                  "stage",
                  t.to_stage_id,
                )}
                <p>
                  {text(t.transition_kind)}: {t.condition_text}
                </p>
                <p>{t.observability_note}</p>
              </article>
            ))}
          <h4>Tapauksiin kirjatut vastuut</h4>
          {p?.caseRoles
            .filter(
              (x) =>
                x.stage_id === id &&
                (!e.context.caseId || x.case_id === e.context.caseId),
            )
            .map((x, i) => (
              <details key={i}>
                <summary>
                  {p.cases.find((c) => c.case_id === x.case_id)?.title} ·{" "}
                  {x.actor_label}
                </summary>
                {fields(x, [
                  ["role_kind", "Rooli"],
                  ["responsibility_scope", "Vastuun rajaus"],
                  ["authority_scope", "Toimivalta"],
                  ["resource_conditions", "Voimavarat"],
                  ["legal_basis", "Oikeusperusta"],
                  ["validity_start", "Voimassa alkaen"],
                  ["validity_end", "Voimassa päättyen"],
                  ["limitations", "Rajaukset"],
                ])}
                {x.source_id && button("Vastuun lähde", "source", x.source_id)}
              </details>
            ))}
        </>
      )}
      {kind === "theme" && p && (
        <>
          <p>{p.themes.find((t) => t.id === id)?.description}</p>
          <p>
            Toimituksellinen teemaluokitus. Teemajäsenyys ei osoita vaikutusta.
          </p>
          {p.memberships
            .filter((m) => m.themeId === id)
            .map((m) => (
              <p key={m.conceptId}>
                {button(label(m.conceptId), "concept", m.conceptId)}
                {m.rationale} · {text(m.reviewStatus)}
              </p>
            ))}
          <h4>Teeman aineistoaukot</h4>
          {p.evidenceGaps
            .filter((g) => g.theme_id === id)
            .map((g) => (
              <p key={g.gap_id}>{button(g.title, "gap", g.gap_id)}</p>
            ))}
        </>
      )}
      {kind === "gap" &&
        p &&
        (() => {
          const g = p.evidenceGaps.find((g) => g.gap_id === id);
          return g ? (
            <>
              {fields(g, [
                ["required_evidence", "Tarvittava näyttö"],
                [
                  "candidate_sources",
                  "Mahdolliset lähteet — ei vahvistettua näyttöä",
                ],
                ["limitations", "Rajaukset"],
              ])}
              <p>Tila: {g.status}</p>
            </>
          ) : null;
        })()}
      {kind === "comparison" &&
        p &&
        (() => {
          const c = p.comparisons.find((c) => c.comparison_id === id);
          return c ? (
            <>
              {fields(c, [
                ["indicator_definition", "Indikaattorin määritelmä"],
                ["included_geographies", "Mukana olevat alueet"],
                ["desired_geographies", "Tavoiteltu kattavuus"],
                ["comparability", "Vertailukelpoisuus"],
                ["limitations", "Rajaukset"],
              ])}
            </>
          ) : null;
        })()}
      {kind === "comparisonRow" &&
        p &&
        (() => {
          const c = p.comparisonRows.find((c) => c.row_id === id);
          return c ? (
            <>
              {fields(c, [
                ["population_and_time", "Väestö ja aika"],
                ["outcomes", "Tulokset"],
                ["limitations", "Rajaukset"],
              ])}
              {c.evidence_link_ids.map((eid: string) => {
                const l = r?.evidenceLinks.find((l) => l.id === eid);
                return l ? (
                  <p key={eid}>
                    {button(
                      data.evidence?.observations.find(
                        (o) => o.id === l.observationId,
                      )?.title ?? l.observationId,
                      "observation",
                      l.observationId,
                    )}
                  </p>
                ) : null;
              })}
            </>
          ) : null;
        })()}
    </section>
  );
}
