import type { AtlasData } from "./atlas.functions";
import type { ExploreStep } from "./atlas.explore";
import type { ReasoningBundle } from "./atlas.reasoning";
export type ExploreContext = {
  start?: number;
  end?: number;
  population?: string;
  caseId?: string;
};
type Mechanism = ReasoningBundle["mechanisms"][number];
export function assessMechanism(
  data: AtlasData,
  m: Mechanism,
  context: ExploreContext,
  steps: ExploreStep[] = [],
) {
  const r = data.evidence?.reasoning,
    s = r?.statements.find((s) => s.id === m.statementId);
  const messages: string[] = [];
  let status: "within" | "unknown" | "outside" | "context_change" = "within";
  const start = context.start ?? 1850,
    end = context.end ?? 2050;
  if (start > end) {
    status = "outside";
    messages.push("Aikarajauksen alku on loppua myöhemmin.");
  }
  if (s?.start != null && s.end != null) {
    if (s.end < start || s.start > end) {
      status = "outside";
      messages.push(
        `Väitteen kirjattu ajanjakso ${s.start}–${s.end} on valinnan ulkopuolella.`,
      );
    }
  } else {
    if (status !== "outside") status = "unknown";
    messages.push("Väitteen soveltamisajankohta on avoin.");
  }
  if (context.caseId) {
    const paths = new Set(
      data.publication?.caseRoutes
        .filter((x) => x.case_id === context.caseId)
        .map((x) => x.path_id),
    );
    const mechanisms = new Set(
      r?.paths
        .filter((p) => paths.has(p.id))
        .flatMap((p) =>
          p.steps.flatMap((s) => (s.viaMechanismId ? [s.viaMechanismId] : [])),
        ),
    );
    if (!mechanisms.has(m.id)) {
      status = "outside";
      messages.push(
        "Tätä mekanismia ei ole kirjattu valitun tapauksen julkaistuun reittiin.",
      );
    }
  }
  const evidenceIds = new Set(
    r?.evidenceLinks
      .filter(
        (l) =>
          l.statementId === m.statementId &&
          l.isCurrent &&
          l.reviewStatus !== "rejected",
      )
      .map((l) => l.observationId),
  );
  const observations =
    data.evidence?.observations.filter((o) => evidenceIds.has(o.id)) ?? [];
  const populations = [
    ...new Set(observations.map((o) => o.population).filter(Boolean)),
  ];
  if (context.population && !populations.includes(context.population)) {
    if (status !== "outside") status = "context_change";
    messages.push(
      "Valitusta kohderyhmästä ei ole tämän yhteyden suoraa havaintokytkentää. Vastaavuutta ei ole varmistettu.",
    );
  }
  let lo = -Infinity,
    hi = Infinity;
  for (const step of steps) {
    if (step.contextNote) {
      lo = -Infinity;
      hi = Infinity;
    }
    const old = r?.mechanisms.find((x) => x.id === step.via),
      statement = r?.statements.find((x) => x.id === old?.statementId);
    if (statement?.start != null && statement.end != null) {
      lo = Math.max(lo, statement.start);
      hi = Math.min(hi, statement.end);
    }
  }
  if (
    s?.start != null &&
    s.end != null &&
    (s.end < lo || s.start > hi) &&
    status !== "outside"
  ) {
    status = "context_change";
    messages.push(
      "Tämän väitteen ajanjakso ei leikkaa aiemman polun kirjattuja ajanjaksoja. Jatko vaihtaa tarkastelutilannetta.",
    );
  }
  if (m.conditions) {
    messages.push(`Soveltamisehdot: ${m.conditions}`);
    if (status === "within") status = "unknown";
  }
  if (!observations.length)
    messages.push("Suoraa havaintokytkentää ei ole kirjattu.");
  return {
    status,
    messages,
    populations,
    start: s?.start ?? null,
    end: s?.end ?? null,
    conditions: m.conditions,
    observationIds: [...evidenceIds],
  };
}
