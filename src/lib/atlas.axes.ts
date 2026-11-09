import type { AtlasData } from "./atlas.functions";

export type AxisKey = "year" | "direct" | "context" | "counter" | "articles" | "span" | "share";
export const AXES: { key: AxisKey; label: string }[] = [
  { key: "year", label: "Käsittelyn painopistevuosi" },
  { key: "direct", label: "Suorat kytkennät" },
  { key: "context", label: "Kontekstikytkennät" },
  { key: "counter", label: "Vastanäyttökytkennät" },
  { key: "articles", label: "Artikkelikäsittelyt (jaksoittain)" },
  { key: "span", label: "Aikakausien määrä" },
  { key: "share", label: "Suorien kytkentöjen osuus (%)" },
];

export type AxisPoint = { id: number; title: string; kind: string } & Record<AxisKey, number>;

/** Per-conclusion metrics derived only from recorded cells. */
export function axisPoints(data: AtlasData): AxisPoint[] {
  const mid = new Map(data.periods.map(p => [p.id, (p.start + p.end) / 2]));
  return data.conclusions.map(c => {
    const cells = data.cells.filter(x => x.c === c.id && x.direct + x.context + x.counter > 0);
    const sum = (k: "direct" | "context" | "counter" | "articles") => cells.reduce((n, x) => n + x[k], 0);
    const w = cells.reduce((n, x) => n + x.direct + x.context, 0);
    const year = w ? cells.reduce((n, x) => n + (mid.get(x.p) ?? 0) * (x.direct + x.context), 0) / w : NaN;
    const direct = sum("direct"), context = sum("context"), counter = sum("counter");
    const all = direct + context + counter;
    return { id: c.id, title: c.title, kind: c.kind, year, direct, context, counter, articles: sum("articles"), span: cells.length, share: all ? (direct / all) * 100 : 0 };
  }).filter(p => p.span > 0);
}

import { normalizeConcept } from "./atlas.relationships.ts";

export type ConceptUse = { key: string; label: string; conclusions: number[]; articles: number[]; periods: string[] };
export type AxisCluster = { id: string; label: string; members: number[] };

/** Recorded article concepts per normalised key (relation "none" excluded). */
export function conceptUses(data: AtlasData): Map<string, ConceptUse> {
  const out = new Map<string, ConceptUse & { c: Set<number>; a: Set<number>; p: Set<string> }>();
  for (const r of data.evidenceIndex ?? []) {
    if (r.reviewStatus === "rejected" || !["direct", "context", "counterevidence"].includes(r.relation)) continue;
    for (const raw of r.concepts) {
      const key = normalizeConcept(raw); if (!key) continue;
      const u = out.get(key) ?? { key, label: raw.trim(), conclusions: [], articles: [], periods: [], c: new Set(), a: new Set(), p: new Set() };
      u.c.add(r.c); u.a.add(r.articleNo); u.p.add(r.p); out.set(key, u);
    }
  }
  return new Map([...out].map(([k, u]) => [k, { key: k, label: u.label, conclusions: [...u.c].sort((a, b) => a - b), articles: [...u.a].sort((a, b) => a - b), periods: [...u.p].sort() }]));
}

/** Concepts of one conclusion, most distinguishing (used by fewest other conclusions) first. */
export function distinctiveConcepts(uses: Map<string, ConceptUse>, id: number): ConceptUse[] {
  return [...uses.values()].filter(u => u.conclusions.includes(id))
    .sort((a, b) => a.conclusions.length - b.conclusions.length || b.articles.length - a.articles.length || a.label.localeCompare(b.label, "fi"));
}

/** Groups each conclusion under the article recorded most often for it (ties: lowest article number). */
export function articleClusters(data: AtlasData, ids: number[]): AxisCluster[] {
  const counts = new Map<number, Map<number, number>>();
  for (const r of data.evidenceIndex ?? []) {
    if (r.reviewStatus === "rejected" || !["direct", "context", "counterevidence"].includes(r.relation)) continue;
    const m = counts.get(r.c) ?? new Map<number, number>(); m.set(r.articleNo, (m.get(r.articleNo) ?? 0) + 1); counts.set(r.c, m);
  }
  const groups = new Map<number, number[]>();
  for (const id of ids) {
    const m = counts.get(id); if (!m) continue;
    const home = [...m].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
    groups.set(home, [...(groups.get(home) ?? []), id]);
  }
  return [...groups].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
    .map(([no, members]) => ({ id: "a" + no, label: `Artikkeli ${no}`, members }));
}

