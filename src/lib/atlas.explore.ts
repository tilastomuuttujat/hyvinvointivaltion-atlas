import type { AtlasData } from "./atlas.functions";
export type ExploreQuestion = "before" | "after" | "how" | "conditions";
export const EXPLORE_QUESTIONS: { id: ExploreQuestion; label: string }[] = [
  { id: "before", label: "Mikä tähän johti?" },
  { id: "after", label: "Mihin tämä vaikuttaa?" },
  { id: "how", label: "Miten vaikutus välittyy?" },
  { id: "conditions", label: "Millä ehdoilla?" },
];
export function exploreOptions(
  data: AtlasData,
  id: string,
  question: ExploreQuestion,
) {
  const concepts = new Map(data.evidence?.concepts.map((c) => [c.id, c]) ?? []);
  const statements = new Set(
    (data.evidence?.reasoning?.statements ?? [])
      .filter((s) => s.reviewStatus !== "rejected")
      .map((s) => s.id),
  );
  return (data.evidence?.reasoning?.mechanisms ?? [])
    .filter(
      (m) =>
        m.isCurrent &&
        statements.has(m.statementId) &&
        m.reviewStatus !== "rejected" &&
        concepts.has(m.from) &&
        concepts.has(m.to),
    )
    .filter((m) =>
      question === "before"
        ? m.to === id
        : question === "after"
          ? m.from === id
          : m.from === id || m.to === id,
    )
    .map((m) => ({
      mechanism: m,
      target: concepts.get(m.from === id ? m.to : m.from)!,
      incoming: m.to === id,
    }));
}
