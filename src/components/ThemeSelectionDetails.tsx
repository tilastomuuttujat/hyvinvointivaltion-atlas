import type { AtlasData } from "@/lib/atlas.functions";
import { catalogueFor, type Theme } from "@/lib/teema.system";

type Props = {
  data: AtlasData;
  theme: Theme;
  kind?: "theme" | "concept" | "conclusion" | "mechanism" | "path" | "insight";
  index?: number;
  label?: string;
};
/** Evidence is reached by stored IDs and current links, never by similarity. */
export function ThemeSelectionDetails({
  data,
  theme,
  kind = "theme",
  index = 0,
  label,
}: Props) {
  const r = data.evidence?.reasoning;
  const concept =
    kind === "concept"
      ? catalogueFor(data)
          .themes.flatMap((t) => t.concepts)
          .find((c) => c.t === label || c.id === label)
      : undefined;
  const conclusion =
    kind === "conclusion" ? theme.conclusions[index] : undefined;
  const mechanism = kind === "mechanism" ? theme.mechanisms[index] : undefined;
  const path = kind === "path" ? theme.paths[index] : undefined;
  const insight = kind === "insight" ? theme.insights[index] : undefined;
  const conceptIds = new Set(concept ? [concept.id] : (path?.conceptIds ?? []));
  const statements = new Set<string>();
  if (mechanism?.statementId) statements.add(mechanism.statementId);
  if (conclusion)
    r?.conclusionBridges
      .filter(
        (b) =>
          b.conclusionId === conclusion.id &&
          b.isCurrent &&
          b.reviewStatus !== "rejected",
      )
      .forEach((b) => statements.add(b.statementId));
  if (concept)
    r?.statementConcepts
      .filter((c) => c.conceptId === concept.id)
      .forEach((c) => statements.add(c.statementId));
  if (path)
    r?.paths
      .find((p) => p.id === path.id)
      ?.steps.forEach((s) => statements.add(s.statementId));
  const evidence =
    r?.evidenceLinks.filter(
      (e) =>
        statements.has(e.statementId) &&
        e.isCurrent &&
        e.reviewStatus !== "rejected",
    ) ?? [];
  const ids = new Set(evidence.map((e) => e.observationId));
  data.evidence?.links
    .filter((l) => conceptIds.has(l.conceptId) && l.reviewStatus !== "rejected")
    .forEach((l) => ids.add(l.observationId));
  const observations =
    data.evidence?.observations.filter((o) => ids.has(o.id)) ?? [];
  const title =
    concept?.t ??
    conclusion?.t ??
    mechanism?.t ??
    path?.t ??
    insight?.t ??
    label ??
    theme.label;
  const meaning =
    concept?.d ??
    conclusion?.d ??
    mechanism?.d ??
    insight?.d ??
    (path ? path.steps.join(" → ") : theme.conclusions[0]?.d);
  const limits =
    concept?.r ??
    conclusion?.limitations ??
    mechanism?.m ??
    path?.m ??
    insight?.limitations;
  const status =
    conclusion?.reviewStatus ??
    mechanism?.reviewStatus ??
    path?.reviewStatus ??
    insight?.reviewStatus ??
    "needs_review";
  return (
    <div className="theme-selection-details">
      <p className="ts-kicker">
        {theme.label} ·{" "}
        {status === "accepted"
          ? "Tarkistettu rajattu kytkentä"
          : status === "draft"
            ? "Luonnos"
            : "Tarkistettavana"}
      </p>
      <h3>{title}</h3>
      {meaning && <p>{meaning}</p>}
      {mechanism && (
        <p>
          <strong>Kirjattu mekanismi:</strong> {mechanism.from} → {mechanism.to}
        </p>
      )}
      {mechanism?.conditions && (
        <>
          <h4>Millä ehdoilla?</h4>
          <p>{mechanism.conditions}</p>
        </>
      )}
      {path && (
        <ol>
          {path.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {insight?.q && <blockquote>{insight.q}</blockquote>}
      {insight?.v && (
        <>
          <h4>Vastatapaus</h4>
          <p>{insight.v}</p>
        </>
      )}
      <h4>Tulkinnan rajat</h4>
      <p>
        {limits ||
          theme.gap[0] ||
          "Teemajäsenyys on toimituksellinen jäsennys. Se ei osoita vaikutusta."}
      </p>
      <p className="ts-muted">
        Nuoli näyttää kirjatun selitysehdotuksen. Lähde, kytkentä ja kausaalinen
        vahvistus arvioidaan erikseen.
      </p>
      {observations.length > 0 ? (
        <>
          <h4>
            Kirjattuihin yhteyksiin liittyvä aineisto ({observations.length})
          </h4>
          {observations.slice(0, 12).map((o) => (
            <details key={o.id}>
              <summary>
                {o.title}
                {o.start != null ? ` · ${o.start}` : ""}
              </summary>
              <p>{o.finding ?? `${o.value} ${o.unit ?? ""}`}</p>
              {o.design && <p>Asetelma: {o.design}</p>}
              <p>
                {o.limitations ??
                  "Tilastohavainto ei yksin osoita syy-yhteyttä."}
              </p>
              {evidence
                .filter((e) => e.observationId === o.id)
                .map((e) => (
                  <p key={e.id}>
                    Suhde: {e.relation} · {e.reviewStatus}. {e.limitations}
                  </p>
                ))}
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                Avaa alkuperäinen lähde
              </a>
            </details>
          ))}
          {observations.length > 12 && (
            <p>
              Ensimmäiset 12 havaintoa. Koko aineisto on sivun
              havaintohakemistossa.
            </p>
          )}
        </>
      ) : (
        <p>
          Tälle valinnalle ei ole tässä viennissä suoraa ajantasaista
          havaintokytkentää. Näytön puuttuminen tästä näkymästä ei osoita
          väitettä vääräksi.
        </p>
      )}
      {kind === "theme" && theme.findings.length > 0 && (
        <>
          <h4>Teeman tutkimuskonteksti</h4>
          <p>
            Toimituksellinen ryhmittely; nämä löydökset eivät automaattisesti
            tue jokaista teeman päätelmää.
          </p>
          {theme.findings.map((f) => (
            <details key={f.id}>
              <summary>{f.t}</summary>
              <p>{f.d}</p>
              <p>{f.design}</p>
              <p>{f.limitations}</p>
              {f.sourceUrl && (
                <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Avaa lähde
                </a>
              )}
            </details>
          ))}
        </>
      )}
      {kind === "theme" && (
        <>
          <h4>Aineiston rajat</h4>
          {theme.gap.map((g, i) => (
            <p key={i}>{g}</p>
          ))}
        </>
      )}
    </div>
  );
}
