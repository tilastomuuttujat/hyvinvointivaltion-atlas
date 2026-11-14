import type { AtlasData } from "./atlas.functions";
import type { Theme, ThemeCatalog } from "./teema.system";

/** A theme assignment is editorial membership, never evidence for a causal claim. */
export function validateThemeCatalog(catalog: ThemeCatalog, data: AtlasData) {
  const unique = (rows: string[], label: string) => {
    if (new Set(rows).size !== rows.length)
      throw new Error(`Duplicate catalogue ${label}`);
  };
  unique(
    catalog.themes.map((t) => t.id),
    "themes",
  );
  const conclusions = catalog.themes.flatMap((t) =>
    t.conclusions.map((c) => c.id),
  );
  unique(conclusions.map(String), "conclusions");
  if (
    conclusions.length !== data.conclusions.length ||
    conclusions.some((id) => !data.conclusions.some((c) => c.id === id))
  )
    throw new Error("Catalogue conclusion coverage differs from snapshot");
  const concepts = catalog.themes.flatMap((t) => t.concepts.map((c) => c.id));
  unique(concepts, "concepts");
  if (
    data.evidence &&
    (concepts.length !== data.evidence.concepts.length ||
      concepts.some((id) => !data.evidence!.concepts.some((c) => c.id === id)))
  )
    throw new Error("Catalogue concept coverage differs from snapshot");
  for (const key of ["mechanisms", "paths"] as const) {
    const assigned = catalog.themes.flatMap((t) => t[key].map((x) => x.id));
    unique(assigned, key);
    const current = data.evidence?.reasoning?.[key] ?? [];
    if (
      assigned.length !== current.length ||
      assigned.some((id) => !current.some((x) => x.id === id))
    )
      throw new Error(`Catalogue ${key} coverage differs from snapshot`);
  }
  return catalog;
}

/** Refresh content by stable IDs; the template supplies only explicit editorial assignments. */
export function buildThemeCatalog(
  data: AtlasData,
  template: ThemeCatalog,
  generatedAt: string,
  editorial?: {
    insights: {
      insight_id: string;
      title: string;
      insight_text: string;
      reader_question: string;
      counterexample: string;
      limitations: string;
      editorial_status: string;
    }[];
  },
): ThemeCatalog {
  const r = data.evidence?.reasoning;
  const themes: Theme[] = template.themes.map((t) => ({
    ...t,
    conclusions: t.conclusions.flatMap((c) => {
      const x = data.conclusions.find((x) => x.id === c.id);
      return x
        ? [
            {
              ...c,
              t: x.title,
              d: x.claim,
              limitations: x.limitations ?? "",
              reviewStatus: x.reviewStatus ?? "draft",
            },
          ]
        : [];
    }),
    concepts: t.concepts.flatMap((c) => {
      const x = data.evidence?.concepts.find((x) => x.id === c.id);
      return x
        ? [{ id: x.id, t: x.label, d: x.definition, r: x.limitations }]
        : [];
    }),
    mechanisms: t.mechanisms.flatMap((m) => {
      const x = r?.mechanisms.find(
        (x) => x.id === m.id && x.isCurrent && x.reviewStatus !== "rejected",
      );
      if (!x) return [];
      const label = (id: string) =>
        data.evidence?.concepts.find((c) => c.id === id)?.label ?? id;
      return [
        {
          id: x.id,
          t: x.label,
          from: label(x.from),
          to: label(x.to),
          fromId: x.from,
          toId: x.to,
          d: x.explanation,
          m: x.limitations,
          conditions: x.conditions,
          reviewStatus: x.reviewStatus,
          statementId: x.statementId,
        },
      ];
    }),
    paths: t.paths.flatMap((p) => {
      const x = r?.paths.find(
        (x) => x.id === p.id && x.reviewStatus !== "rejected",
      );
      return x
        ? [
            {
              id: x.id,
              t: x.title,
              steps: x.steps.map(
                (s) =>
                  data.evidence?.concepts.find((c) => c.id === s.conceptId)
                    ?.label ?? s.conceptId,
              ),
              conceptIds: x.steps.map((s) => s.conceptId),
              m: x.limitations,
              reviewStatus: x.reviewStatus,
            },
          ]
        : [];
    }),
    findings: t.findings.flatMap((f) => {
      const x = data.evidence?.observations.find((o) => o.id === f.id);
      return x
        ? [
            {
              id: x.id,
              t: x.title,
              d: x.finding ?? "",
              sourceUrl: x.sourceUrl,
              limitations: x.limitations ?? "",
              design: x.design ?? "",
              verification: x.verification,
              valueKind:
                x.valueKind ?? (x.result?.value_kind as string | undefined),
            },
          ]
        : [];
    }),
    insights: t.insights.flatMap((i) => {
      const x = editorial?.insights.find((x) => x.insight_id === i.id);
      return editorial
        ? x && x.editorial_status !== "rejected"
          ? [
              {
                ...i,
                t: x.title,
                d: x.insight_text,
                q: x.reader_question,
                v: x.counterexample,
                limitations: x.limitations,
                reviewStatus: x.editorial_status,
              },
            ]
          : []
        : [i];
    }),
  }));
  if (
    editorial &&
    themes.reduce((n, t) => n + t.insights.length, 0) !==
      editorial.insights.filter((i) => i.editorial_status !== "rejected").length
  )
    throw new Error("Catalogue insight coverage differs from source");
  return validateThemeCatalog(
    {
      schemaVersion: 1,
      date: new Date(generatedAt).toLocaleDateString("fi-FI", {
        timeZone: "Europe/Helsinki",
      }),
      generatedAt,
      themes,
    },
    data,
  );
}
