import type { AtlasData, Conclusion } from "./atlas.functions";
import type { EvidenceRef } from "./atlas.relationships";
import { temporalStatus } from "./atlas.navigation.ts";
export const COMPARISON_COLORS = [
  "var(--primary)",
  "var(--kind-hypo)",
  "var(--kind-principle)",
];
export const COMPARISON_PHASES = [
  "Yhteinen rakenne",
  "Olennaiset erot",
  "Mahdollinen yhteisvaikutus",
];
const normal = (s: string) =>
  s.normalize("NFC").trim().toLocaleLowerCase("fi-FI");
const usable = (r: EvidenceRef) =>
  r.reviewStatus !== "rejected" &&
  ["direct", "context", "counterevidence"].includes(r.relation);
export type ComparisonLink = {
  key: string;
  left: number;
  right: number;
  periodId: string;
  articles: number[];
  concepts: string[];
  allAccepted: boolean;
};
export type ComparisonProfile = {
  conclusion: Conclusion;
  letter: string;
  color: string;
  periodIds: string[];
  articles: number[];
  direct: number;
  context: number;
  counter: number;
  statementIds: string[];
  mechanismIds: string[];
  observationIds: string[];
  scopes: string[];
  distinctiveConcepts: string[];
};
export type ArgumentLink = {
  from: number;
  to: number;
  relation: string;
  rationale: string;
  limitations: string;
  reviewStatus: string;
};
export type ComparisonReport = {
  ids: number[];
  periodId: string | null;
  periodLabel: string;
  profiles: ComparisonProfile[];
  links: ComparisonLink[];
  commonAll: { periodId: string; articles: number[]; concepts: string[] }[];
  arguments: ArgumentLink[];
  stories: { title: string; text: string; limitation: string }[];
};
function intersection<T>(sets: Set<T>[]): T[] {
  if (!sets.length) return [];
  return [...sets[0]].filter((x) => sets.every((s) => s.has(x)));
}
function statementsFor(data: AtlasData, c: number) {
  const r = data.evidence?.reasoning;
  if (!r) return new Set<string>();
  const alive = new Set(
    r.statements.filter((s) => s.reviewStatus !== "rejected").map((s) => s.id),
  );
  const ids = new Set(
    r.conclusionBridges
      .filter(
        (b) =>
          b.conclusionId === c &&
          b.isCurrent &&
          b.reviewStatus !== "rejected" &&
          alive.has(b.statementId),
      )
      .map((b) => b.statementId),
  );
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of r.statementRelations) {
      if (!edge.isCurrent || edge.reviewStatus === "rejected") continue;
      const other =
        edge.from === id ? edge.to : edge.to === id ? edge.from : null;
      if (other && alive.has(other) && !ids.has(other)) {
        ids.add(other);
        queue.push(other);
      }
    }
  }
  return ids;
}
export function buildComparison(
  data: AtlasData,
  selected: number[],
  periodId: string | null = null,
): ComparisonReport {
  const ids = [...new Set(selected)];
  if (
    ids.length < 2 ||
    ids.length > 3 ||
    ids.some((id) => !data.conclusions.some((c) => c.id === id))
  )
    throw new Error("Valitse kaksi tai kolme eri päätelmää.");
  const period = periodId ? data.periods.find((p) => p.id === periodId) : null;
  if (periodId && !period) throw new Error("Tuntematon aikakausi.");
  const raw = (data.evidenceIndex ?? []).filter(
    (r) =>
      ids.includes(r.c) &&
      usable(r) &&
      data.periods.some((p) => p.id === r.p) &&
      (!periodId || r.p === periodId),
  );
  const unique = new Map<string, EvidenceRef>();
  for (const row of raw) {
    const key = `${row.c}:${row.p}:${row.articleNo}:${row.relation}`,
      old = unique.get(key);
    unique.set(
      key,
      old
        ? {
            ...old,
            concepts: [...new Set([...old.concepts, ...row.concepts])],
            reviewStatus:
              old.reviewStatus === "accepted" && row.reviewStatus === "accepted"
                ? "accepted"
                : "needs_review",
          }
        : row,
    );
  }
  const refs = [...unique.values()];
  const r = data.evidence?.reasoning;
  const profiles: ComparisonProfile[] = ids.map((id, i) => {
    const own = refs.filter((r) => r.c === id),
      statements = statementsFor(data, id);
    const visibleStatements = new Set(
      (r?.statements ?? [])
        .filter(
          (s) =>
            statements.has(s.id) &&
            temporalStatus(s, period ?? null) !== "outside",
        )
        .map((s) => s.id),
    );
    const obsIds = new Set(
      (r?.evidenceLinks ?? [])
        .filter(
          (e) =>
            e.isCurrent &&
            e.reviewStatus !== "rejected" &&
            visibleStatements.has(e.statementId) &&
            data.evidence?.observations.some(
              (o) =>
                o.id === e.observationId &&
                (temporalStatus(o, period ?? null) === "inside" ||
                  (!period && temporalStatus(o, null) === "undated")),
            ),
        )
        .map((e) => e.observationId),
    );
    return {
      conclusion: data.conclusions.find((c) => c.id === id)!,
      letter: String.fromCharCode(65 + i),
      color: COMPARISON_COLORS[i],
      periodIds: data.periods
        .filter((p) => own.some((r) => r.p === p.id))
        .map((p) => p.id),
      articles: [...new Set(own.map((r) => r.articleNo))].sort((a, b) => a - b),
      direct: own.filter((r) => r.relation === "direct").length,
      context: own.filter((r) => r.relation === "context").length,
      counter: own.filter((r) => r.relation === "counterevidence").length,
      statementIds: [...visibleStatements],
      mechanismIds: (r?.mechanisms ?? [])
        .filter(
          (m) =>
            m.isCurrent &&
            m.reviewStatus !== "rejected" &&
            visibleStatements.has(m.statementId),
        )
        .map((m) => m.id),
      observationIds: [...obsIds],
      distinctiveConcepts: [],
      scopes: (r?.statements ?? [])
        .filter((s) => visibleStatements.has(s.id))
        .map((s) => s.scope),
    };
  });
  for (const profile of profiles) {
    const other = new Set(
      refs
        .filter((row) => row.c !== profile.conclusion.id)
        .flatMap((row) => row.concepts.map(normal)),
    );
    const own = new Map<string, { label: string; count: number }>();
    for (const row of refs.filter((row) => row.c === profile.conclusion.id))
      for (const label of row.concepts) {
        const key = normal(label);
        if (!key || other.has(key)) continue;
        const previous = own.get(key);
        own.set(key, {
          label: label.trim(),
          count: (previous?.count ?? 0) + 1,
        });
      }
    profile.distinctiveConcepts = [...own.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fi"))
      .slice(0, 3)
      .map((x) => x.label);
  }
  const commonAll: ComparisonReport["commonAll"] = [],
    links: ComparisonLink[] = [];
  for (const p of data.periods.filter((p) => !periodId || p.id === periodId)) {
    const groups = ids.map((id) =>
      refs.filter((r) => r.c === id && r.p === p.id),
    );
    const articles = groups.map(
      (rows) => new Set(rows.map((r) => r.articleNo)),
    );
    const concepts = groups.map(
      (rows) =>
        new Set(rows.flatMap((r) => r.concepts.map(normal).filter(Boolean))),
    );
    const labels = new Map(
      groups
        .flat()
        .flatMap((r) => r.concepts.map((c) => [normal(c), c.trim()] as const)),
    );
    const sharedArticles = intersection(articles).sort((a, b) => a - b),
      sharedConcepts = intersection(concepts).map((k) => labels.get(k)!);
    if (sharedArticles.length || sharedConcepts.length)
      commonAll.push({
        periodId: p.id,
        articles: sharedArticles,
        concepts: sharedConcepts,
      });
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = intersection([articles[i], articles[j]]).sort(
            (a, b) => a - b,
          ),
          keys = intersection([concepts[i], concepts[j]]);
        if (!a.length && !keys.length) continue;
        const matches = (x: EvidenceRef, y: EvidenceRef) =>
          x.articleNo === y.articleNo ||
          x.concepts.some(
            (c) => normal(c) && y.concepts.some((d) => normal(c) === normal(d)),
          );
        // Both ends of every displayed matching basis must be accepted to label the aggregate accepted.
        const basisPairs = groups[i].flatMap((x) =>
          groups[j].filter((y) => matches(x, y)).map((y) => [x, y]),
        );
        links.push({
          key: `${ids[i]}:${ids[j]}:${p.id}`,
          left: ids[i],
          right: ids[j],
          periodId: p.id,
          articles: a,
          concepts: keys.map((k) => labels.get(k)!),
          allAccepted: basisPairs.every((pair) =>
            pair.every((x) => x.reviewStatus === "accepted"),
          ),
        });
      }
  }
  const argumentLinks: ArgumentLink[] = [];
  // Only direct registered statement bridges identify a cross-conclusion argument relation.
  // Do not turn navigation closure, concept overlap or co-occurrence into an effect chain.
  const direct = (id: number) =>
    (r?.conclusionBridges ?? [])
      .filter(
        (b) =>
          b.conclusionId === id &&
          b.isCurrent &&
          b.reviewStatus !== "rejected" &&
          r?.statements.some(
            (s) =>
              s.id === b.statementId &&
              s.reviewStatus !== "rejected" &&
              temporalStatus(s, period ?? null) !== "outside",
          ),
      )
      .map((b) => b.statementId);
  const directIds = new Map(ids.map((id) => [id, new Set(direct(id))]));
  const acceptedBridge = (conclusionId: number, statementId: string) => {
    if (!r) return false;
    return r.conclusionBridges.some(
      (bridge) =>
        bridge.conclusionId === conclusionId &&
        bridge.statementId === statementId &&
        bridge.isCurrent &&
        bridge.reviewStatus === "accepted",
    ) &&
    r.statements.some(
      (statement) =>
        statement.id === statementId && statement.reviewStatus === "accepted",
    );
  };
  for (const edge of r?.statementRelations ?? []) {
    if (!edge.isCurrent || edge.reviewStatus === "rejected") continue;
    for (const from of ids)
      for (const to of ids) {
        if (
          from === to ||
          !directIds.get(from)?.has(edge.from) ||
          !directIds.get(to)?.has(edge.to)
        )
          continue;
        argumentLinks.push({
          from,
          to,
          relation: edge.relation,
          rationale: edge.rationale,
          limitations: edge.limitations,
          reviewStatus:
            edge.reviewStatus === "accepted" &&
            acceptedBridge(from, edge.from) &&
            acceptedBridge(to, edge.to)
              ? "accepted"
              : "needs_review",
        });
      }
  }
  const pLabel = (id: string) =>
    data.periods.find((p) => p.id === id)?.label ?? id;
  const first = commonAll[0] ?? links[0];
  const example = first
    ? `Esimerkiksi jaksolla ${pLabel("periodId" in first ? first.periodId : "")} yhteys perustuu ${first.articles.length ? `yhteisiin artikkeleihin ${first.articles.join(", ")}` : ""}${first.articles.length && first.concepts.length ? " ja " : ""}${first.concepts.length ? `kirjattuihin käsitesanoihin ”${first.concepts.slice(0, 3).join("”, ”")}”` : ""}.`
    : "";
  const shared = commonAll.length
    ? `Kaikille ${ids.length} päätelmälle löytyy yhteistä kirjattua taustaa ${commonAll.length} aikakaudelta. ${example}`
    : links.length
      ? `Yhteyksiä löytyy pareittain ${links.length} kirjauksena, mutta kaikille valituille ei löydy yhtä yhteistä artikkeli- tai käsitepohjaa samalla aikakaudella. ${example}`
      : "Valitussa aikarajauksessa ei löydy yhteisiin artikkeleihin tai täsmälleen samoihin käsitesanoihin perustuvaa yhteyttä.";
  const temporalDifference = profiles.some(
    (p) => p.periodIds.join("|") !== profiles[0].periodIds.join("|"),
  );
  const kindsDiffer = new Set(profiles.map((p) => p.conclusion.kind)).size > 1;
  let differences = temporalDifference
    ? `Päätelmien ajallinen käsittely eroaa: ${profiles.map((p) => `${p.letter} esiintyy ${p.periodIds.length} aikakaudella`).join(", ")}. Aikajanasta näet, missä käsittely on yhteistä ja missä erillistä.`
    : kindsDiffer
      ? "Ajallinen käsittely on samankaltaista, mutta päätelmät ovat eri tyyppisiä väitteitä. Hypoteesia, synteesiä ja arviointiperiaatetta pitää arvioida eri kysymyksillä."
      : "Ajallinen käsittely on samankaltaista. Ratkaisevat sisällölliset erot löytyvät väitteiden sanamuodoista, soveltamisaloista ja mekanismeista — samankaltainen käsittely ei tee niistä samaa väitettä.";
  const distinctive = profiles
    .filter((p) => p.distinctiveConcepts.length)
    .map(
      (p) => `${p.letter}: ”${p.distinctiveConcepts.slice(0, 2).join("”, ”")}”`,
    );
  if (distinctive.length)
    differences += ` Muista erottuvia kirjattuja käsitesanoja ovat ${distinctive.join("; ")}. Nämä ovat artikkelikäsittelyn eroja, eivät erillisiä vaikutusarvioita.`;
  const interaction = argumentLinks.length
    ? `Valittujen päätelmien väitteiden välille on kirjattu ${argumentLinks.length} perustelusuhdetta. Ne kuvaavat argumentin rakennetta, eivät mitattua yhteisvaikutusta. Avaa perusteet nähdäksesi, tukeeko, rajaako vai haastaako yksi väite toista.`
    : "Näille päätelmille ei löydy nykyistä kirjattua yhteisvaikutusketjua. Yhteinen artikkeli, käsitesana tai aikakausi ei yksin osoita, että kehityskulut vahvistavat tai lieventävät toisiaan.";
  return {
    ids,
    periodId,
    periodLabel: period?.label ?? "Koko aikajana 1850–2050",
    profiles,
    links,
    commonAll,
    arguments: argumentLinks,
    stories: [
      {
        title: "Mikä yhdistää?",
        text: shared,
        limitation:
          "Yhteinen tausta on asiayhteys, ei näyttö syy-yhteydestä tai yhteisvaikutuksesta.",
      },
      {
        title: "Missä ne eroavat?",
        text: differences,
        limitation:
          "Artikkelien ja kytkentöjen määrät kuvaavat aineiston kattavuutta, eivät väitteiden totuutta tai ilmiöiden voimakkuutta. Puuttuva merkintä ei osoita ilmiön puuttumista.",
      },
      {
        title: "Miten ne voivat vaikuttaa yhdessä?",
        text: interaction,
        limitation:
          "Aineisto ei tarjoa näille valinnoille yhteismitallista numeerista vaikutusarviota. Vahvistuminen tai lieventyminen on perusteltava erikseen mekanismeilla, ehdoilla ja näytöllä.",
      },
    ],
  };
}
export function comparisonSegments(
  data: AtlasData,
  ids: number[],
  periodId: string | null,
) {
  return ids.map((c) => ({
    c,
    segments: data.periods.slice(1).flatMap((p, i) => {
      const previous = data.periods[i];
      const has = (id: string) =>
        data.cells.some(
          (cell) =>
            cell.c === c &&
            cell.p === id &&
            cell.direct + cell.context + cell.counter > 0,
        );
      return (!periodId || (previous.id === periodId && p.id === periodId)) &&
        has(previous.id) &&
        has(p.id)
        ? [[previous.id, p.id] as [string, string]]
        : [];
    }),
  }));
}
