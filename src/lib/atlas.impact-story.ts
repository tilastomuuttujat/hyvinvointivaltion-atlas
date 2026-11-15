import type { AtlasData } from "./atlas.functions";

type Reasoning = NonNullable<NonNullable<AtlasData["evidence"]>["reasoning"]>;
type Mechanism = Reasoning["mechanisms"][number];

export type RecordedRoute = {
  id: string;
  title: string;
  introduction: string;
  limitations: string;
  steps: { id: string; via?: string; caption: string }[];
  endLabel: string;
};
export type RouteFamily = { startId: string; startLabel: string; routes: RecordedRoute[] };

/** Recorded editorial paths grouped by their shared, explicitly recorded start concept. */
export function recordedRouteFamilies(data: AtlasData): RouteFamily[] {
  const r = data.evidence?.reasoning;
  const label = new Map(data.evidence?.concepts.map((c) => [c.id, c.label]) ?? []);
  const live = new Set(
    (r?.mechanisms ?? []).filter((m) => m.isCurrent && m.reviewStatus !== "rejected").map((m) => m.id),
  );
  const families = new Map<string, RouteFamily>();
  for (const p of r?.paths ?? []) {
    if (p.reviewStatus === "rejected" || !p.steps.length) continue;
    const steps = [...p.steps].sort((a, b) => a.order - b.order);
    if (steps.some((s, i) => i > 0 && (!s.viaMechanismId || !live.has(s.viaMechanismId)))) continue;
    const startId = steps[0]!.conceptId;
    const fam = families.get(startId) ?? { startId, startLabel: label.get(startId) ?? startId, routes: [] };
    fam.routes.push({
      id: p.id,
      title: p.title,
      introduction: p.introduction,
      limitations: p.limitations,
      steps: steps.map((s) => ({ id: s.conceptId, caption: s.caption, ...(s.viaMechanismId ? { via: s.viaMechanismId } : {}) })),
      endLabel: label.get(steps.at(-1)!.conceptId) ?? steps.at(-1)!.conceptId,
    });
    families.set(startId, fam);
  }
  return [...families.values()];
}

export type StoryLink = {
  mechanism: Mechanism;
  fromLabel: string;
  toLabel: string;
  start: number | null;
  end: number | null;
  causal: boolean;
};
export type ChainStory = {
  labels: string[];
  links: StoryLink[];
  causal: number;
  proposed: number;
  conditional: number;
  openTiming: number;
  overlap: { start: number; end: number } | null;
  disjoint: boolean;
  text: string;
};

/** Plain-language synthesis of the reader's chosen route; uses only recorded mechanisms. */
export function chainStory(data: AtlasData, steps: { id: string; via?: string }[]): ChainStory {
  const r = data.evidence?.reasoning;
  const label = new Map(data.evidence?.concepts.map((c) => [c.id, c.label]) ?? []);
  const name = (id: string) => label.get(id) ?? id;
  const links: StoryLink[] = [];
  for (let i = 1; i < steps.length; i++) {
    const m = r?.mechanisms.find((x) => x.id === steps[i]!.via);
    if (!m) continue;
    const s = r?.statements.find((x) => x.id === m.statementId);
    links.push({
      mechanism: m,
      fromLabel: name(m.from),
      toLabel: name(m.to),
      start: s?.start ?? null,
      end: s?.end ?? null,
      causal: m.basis === "causal" && m.reviewStatus === "accepted",
    });
  }
  const timed = links.filter((l) => l.start != null && l.end != null);
  let lo = -Infinity,
    hi = Infinity;
  for (const l of timed) {
    lo = Math.max(lo, l.start!);
    hi = Math.min(hi, l.end!);
  }
  const overlap = timed.length && lo <= hi ? { start: lo, end: hi } : null;
  const labels = steps.map((s) => name(s.id));
  const causal = links.filter((l) => l.causal).length;
  const conditional = links.filter((l) => l.mechanism.conditions?.trim()).length;
  const lines = [
    `Vaikutusketju: ${labels.join(" → ")}`,
    "",
    ...links.map(
      (l, i) =>
        `${i + 1}. ${l.fromLabel} → ${l.toLabel} (${l.causal ? "kausaaliseksi arvioitu" : "selitysehdotus"}): ${l.mechanism.explanation}${l.mechanism.conditions ? ` Ehto: ${l.mechanism.conditions}` : ""}`,
    ),
    "",
    `${causal}/${links.length} yhteyttä kausaaliseksi arvioituja. Ketju ei yksin todista kokonaisvaikutusta.`,
  ];
  return {
    labels,
    links,
    causal,
    proposed: links.length - causal,
    conditional,
    openTiming: links.length - timed.length,
    overlap,
    disjoint: timed.length > 1 && lo > hi,
    text: lines.join("\n"),
  };
}
