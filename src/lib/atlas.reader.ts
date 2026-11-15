import type { AtlasData } from "./atlas.functions";
import type { ExploreStep } from "./atlas.explore";

/** Follow exact current references; no similarity, inferred population or causal upgrade. */
export function readerPath(data: AtlasData, steps: ExploreStep[]) {
  const r = data.evidence?.reasoning;
  const statements = new Map(
    (r?.statements ?? [])
      .filter((s) => s.reviewStatus !== "rejected")
      .map((s) => [s.id, s]),
  );
  const concepts = new Map(data.evidence?.concepts.map((c) => [c.id, c]) ?? []);
  const links = steps.slice(1).map((step, i) => {
    const before = steps[i]!;
    const m = r?.mechanisms.find(
      (m) =>
        m.id === step.via &&
        m.isCurrent &&
        m.reviewStatus !== "rejected" &&
        statements.has(m.statementId) &&
        ((m.from === before.id && m.to === step.id) ||
          (m.to === before.id && m.from === step.id)),
    );
    if (!m)
      return {
        step,
        before,
        mechanism: null,
        statement: null,
        evidence: [],
        alternatives: [],
      };
    const statement = statements.get(m.statementId)!;
    const evidence = (r?.evidenceLinks ?? [])
      .filter(
        (e) =>
          e.statementId === statement.id &&
          e.isCurrent &&
          e.reviewStatus !== "rejected",
      )
      .flatMap((e) => {
        const observation = data.evidence?.observations.find(
          (o) => o.id === e.observationId,
        );
        if (!observation) return [];
        const sources = (r?.observationSources ?? [])
          .filter(
            (s) =>
              s.observationId === observation.id &&
              s.isCurrent &&
              s.reviewStatus !== "rejected",
          )
          .flatMap((s) => {
            const source = r?.sources.find((x) => x.id === s.sourceId);
            return source ? [source] : [];
          });
        return [{ link: e, observation, sources }];
      });
    const alternatives = (r?.statementRelations ?? [])
      .filter(
        (x) =>
          x.isCurrent &&
          x.reviewStatus !== "rejected" &&
          (x.to === statement.id || x.from === statement.id),
      )
      .flatMap((relation) => {
        const other = statements.get(
          relation.to === statement.id ? relation.from : relation.to,
        );
        return other ? [{ relation, statement: other }] : [];
      });
    return { step, before, mechanism: m, statement, evidence, alternatives };
  });
  return {
    steps: steps.map((s) => ({
      ...s,
      label: concepts.get(s.id)?.label ?? s.id,
    })),
    links,
    populations: [
      ...new Set(
        links.flatMap((l) =>
          l.evidence.map((e) => e.observation.population).filter(Boolean),
        ),
      ),
    ],
    unknown: links.filter((l) => !l.mechanism).length,
  };
}
export function compareReaderPaths(a: ExploreStep[], b: ExploreStep[]) {
  let shared = 0;
  while (
    shared < a.length &&
    shared < b.length &&
    a[shared]!.id === b[shared]!.id &&
    a[shared]!.via === b[shared]!.via
  )
    shared++;
  return {
    shared,
    sameStart: !!a.length && !!b.length && a[0]!.id === b[0]!.id,
    sameEnd: !!a.length && !!b.length && a.at(-1)!.id === b.at(-1)!.id,
  };
}
