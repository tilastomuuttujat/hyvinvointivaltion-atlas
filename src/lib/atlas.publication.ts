import type { AtlasData } from "./atlas.functions";
export type PublicRow = { [key: string]: any };
export type PublicationBundle = {
  exclusions?: {
    caseRoutesNotPublishable: number;
    serviceTransitionsNotPublishable: number;
  };
  modelVersion: 1;
  generatedAt: string;
  policy: string;
  themes: {
    id: string;
    label: string;
    description: string;
    namespace: string;
    reviewStatus: string;
  }[];
  memberships: {
    conceptId: string;
    themeId: string;
    rationale: string;
    reviewStatus: string;
  }[];
  suppressedConceptIds: string[];
  cases: PublicRow[];
  caseRoutes: PublicRow[];
  caseReferences: PublicRow[];
  caseEvidence: PublicRow[];
  caseRoles: PublicRow[];
  frameworks: PublicRow[];
  stages: PublicRow[];
  transitions: PublicRow[];
  frameworkCaseLinks: PublicRow[];
  frameworkThemeLinks: PublicRow[];
  metrics: PublicRow[];
  caseMetrics: PublicRow[];
  metricCaseLinks: PublicRow[];
  metricStageLinks: PublicRow[];
  seriesMetadata: PublicRow[];
  dimensions: PublicRow[];
  seriesDimensions: PublicRow[];
  seriesThemes: PublicRow[];
  comparisons: PublicRow[];
  comparisonRows: PublicRow[];
  evidenceGaps: PublicRow[];
  sources: PublicRow[];
};
export function publicationManifest(snapshot: {
  atlas: AtlasData;
  evidence: NonNullable<AtlasData["evidence"]>;
}) {
  const e = snapshot.evidence,
    r = e.reasoning;
  return {
    concepts: e.concepts.map((c) => c.id),
    observations: e.observations.map((o) => o.id),
    paths: r?.paths.map((p) => p.id) ?? [],
    statements: r?.statements.map((s) => s.id) ?? [],
    evidenceLinks: r?.evidenceLinks.map((l) => l.id) ?? [],
    conclusions: snapshot.atlas.conclusions.map((c) => c.id),
  };
}
export function validatePublication(p: PublicationBundle, data: AtlasData) {
  const check = (ok: unknown, msg: string) => {
    if (!ok) throw new Error(`Invalid publication: ${msg}`);
  };
  check(p.modelVersion === 1 && !!p.generatedAt, "version");
  if (data.generatedAt)
    check(p.generatedAt === data.generatedAt, "mixed snapshot versions");
  for (const key of [
    "themes",
    "memberships",
    "suppressedConceptIds",
    "cases",
    "caseRoutes",
    "caseReferences",
    "caseEvidence",
    "caseRoles",
    "frameworks",
    "stages",
    "transitions",
    "frameworkCaseLinks",
    "frameworkThemeLinks",
    "metrics",
    "caseMetrics",
    "metricCaseLinks",
    "metricStageLinks",
    "seriesMetadata",
    "dimensions",
    "seriesDimensions",
    "seriesThemes",
    "comparisons",
    "comparisonRows",
    "evidenceGaps",
    "sources",
  ] as const)
    check(Array.isArray(p[key]), key);
  const ids = (rows: PublicRow[], key: string) =>
    new Set(rows.map((r) => r[key]));
  const themes = ids(p.themes, "id"),
    cases = ids(p.cases, "case_id"),
    stages = ids(p.stages, "stage_id"),
    frameworks = ids(p.frameworks, "framework_id"),
    sources = ids(p.sources, "source_id");
  const concepts = new Set(data.evidence?.concepts.map((c) => c.id)),
    obs = new Set(data.evidence?.observations.map((o) => o.id)),
    paths = new Set(data.evidence?.reasoning?.paths.map((p) => p.id));
  for (const m of p.memberships)
    check(
      themes.has(m.themeId) &&
        concepts.has(m.conceptId) &&
        m.reviewStatus !== "rejected",
      "theme membership",
    );
  for (const r of p.caseRoutes)
    check(cases.has(r.case_id) && paths.has(r.path_id), "case route");
  for (const r of p.caseEvidence)
    check(
      cases.has(r.case_id) &&
        stages.has(r.stage_id) &&
        obs.has(r.observation_id),
      "case observation",
    );
  for (const r of p.caseReferences)
    check(
      cases.has(r.case_id) &&
        sources.has(r.source_id) &&
        /^https?:\/\//.test(r.url),
      "case source",
    );
  for (const r of p.stages)
    check(frameworks.has(r.framework_id), "stage framework");
  for (const r of p.transitions)
    check(
      stages.has(r.from_stage_id) &&
        stages.has(r.to_stage_id) &&
        r.review_status !== "rejected",
      "service transition",
    );
  for (const x of p.frameworkCaseLinks)
    check(
      cases.has(x.case_id) &&
        frameworks.has(x.framework_id) &&
        x.review_status !== "rejected",
      "framework case",
    );
  for (const x of p.frameworkThemeLinks)
    check(
      themes.has(x.theme_id) && frameworks.has(x.framework_id),
      "framework theme",
    );
  for (const x of p.caseRoles)
    check(
      cases.has(x.case_id) &&
        stages.has(x.stage_id) &&
        (!x.source_id || sources.has(x.source_id)),
      "case role",
    );
  for (const x of p.seriesThemes)
    check(
      themes.has(x.theme_id) &&
        p.seriesMetadata.some((m) => m.series_key === x.series_key),
      "series theme",
    );
  for (const x of p.comparisonRows)
    check(
      Array.isArray(x.evidence_link_ids) &&
        x.evidence_link_ids.length > 0 &&
        x.evidence_link_ids.every((id: string) =>
          data.evidence?.reasoning?.evidenceLinks.some(
            (e) => e.id === id && e.isCurrent && e.reviewStatus !== "rejected",
          ),
        ),
      "comparison evidence",
    );
  for (const s of p.sources) check(/^https?:\/\//.test(s.url), "source URL");
  for (const s of p.seriesDimensions)
    check(
      p.seriesMetadata.some((m) => m.series_key === s.series_key),
      "series dimension",
    );
  for (const rows of [
    p.cases,
    p.transitions,
    p.metrics,
    p.caseMetrics,
    p.comparisons,
    p.comparisonRows,
    p.caseEvidence,
    p.caseRoles,
    p.caseReferences,
  ])
    for (const r of rows) check(r.review_status !== "rejected", "rejected row");
  const forbidden =
    /("(?:body|body_text|body_markdown|body_html|password|connection_string|auth_token|raw_payload)"\s*:)/i;
  check(!forbidden.test(JSON.stringify(p)), "private fields");
  return p;
}
