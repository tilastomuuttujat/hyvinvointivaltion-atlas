import type { AtlasData } from "./atlas.functions";

/** Editorial theme areas covering every conclusion of the atlas (assignment by conclusion title). */
import { CATALOG, catalogueFor } from "./teema.system.ts";
export const THEMES = CATALOG.themes.map((t) => ({
  id: t.id,
  label: t.label,
  conclusions: t.conclusions.map((c) => c.id),
}));

export type ThemeConcept = {
  key: string;
  label: string;
  uses: number;
  x: number;
  y: number;
  home: number;
  conclusions: number[];
  articles: number[];
  periods: string[];
  anchor: boolean;
};
export type ThemeNode = {
  id: number;
  title: string;
  x: number;
  y: number;
  theme: string;
};
export type ThemeArea = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
};
export type ThemeMap = {
  width: number;
  height: number;
  themes: ThemeArea[];
  conclusions: ThemeNode[];
  concepts: ThemeConcept[];
};

const COLORS = [
  "var(--primary)",
  "var(--kind-hypo)",
  "var(--kind-principle)",
  "var(--kind-synth)",
  "var(--accent)",
  "var(--primary)",
  "var(--kind-hypo)",
];
const norm = (s: string) =>
  s.trim().toLocaleLowerCase("fi").replace(/\s+/g, " ");

/** Detail tier revealed at a relative zoom: themes+anchors → conclusions → every recorded concept. */
export function themeDetail(zoom: number): 0 | 1 | 2 {
  return zoom >= 2.4 ? 2 : zoom >= 1.5 ? 1 : 0;
}

export function buildThemeMap(data: AtlasData, anchorsPerTheme = 3): ThemeMap {
  const THEMES = catalogueFor(data).themes.map((t) => ({
    id: t.id,
    label: t.label,
    conclusions: t.conclusions.map((c) => c.id),
  }));
  const W = 1800,
    H = 1600,
    R = 165;
  const centres = THEMES.map((_, i) => [
    260 + (i % 4) * 425,
    300 + Math.floor(i / 4) * 490,
  ]);
  const titles = new Map(data.conclusions.map((c) => [c.id, c.title]));
  const themes: ThemeArea[] = THEMES.map((t, i) => ({
    id: t.id,
    label: t.label,
    x: centres[i]![0]!,
    y: centres[i]![1]!,
    r: R,
    color: COLORS[i % COLORS.length]!,
  }));
  const themeOf = new Map<number, string>();
  THEMES.forEach((t) => t.conclusions.forEach((c) => themeOf.set(c, t.id)));
  const conclusions: ThemeNode[] = [];
  THEMES.forEach((t, i) => {
    const a = themes[i]!;
    const list = t.conclusions.filter((c) => titles.has(c));
    list.forEach((c, k) => {
      const ang = (k / list.length) * Math.PI * 2 - Math.PI / 2;
      conclusions.push({
        id: c,
        title: titles.get(c)!,
        theme: t.id,
        x: a.x + Math.cos(ang) * R * 0.55,
        y: a.y + Math.sin(ang) * R * 0.55,
      });
    });
  });
  const byKey = new Map<string, ThemeConcept>();
  const catalogue = catalogueFor(data);
  const reasoning = data.evidence?.reasoning;
  for (const t of catalogue.themes)
    for (const item of t.concepts) {
      const related = new Set<number>();
      const statementIds = new Set(
        reasoning?.statementConcepts
          .filter((sc) => sc.conceptId === item.id)
          .map((sc) => sc.statementId) ?? [],
      );
      reasoning?.conclusionBridges
        .filter(
          (b) =>
            b.isCurrent &&
            b.reviewStatus !== "rejected" &&
            statementIds.has(b.statementId),
        )
        .forEach((b) => related.add(b.conclusionId));
      byKey.set(item.id, {
        key: item.id,
        label: item.t,
        uses:
          data.evidence?.links.filter(
            (l) => l.conceptId === item.id && l.reviewStatus !== "rejected",
          ).length ?? 0,
        x: 0,
        y: 0,
        home: t.conclusions[0]?.id ?? 0,
        conclusions: [...related],
        articles: [],
        periods: [],
        anchor: false,
      });
    }
  const concepts = [...byKey.values()].sort(
    (a, b) => b.uses - a.uses || a.key.localeCompare(b.key),
  );
  // A position inside an editorial theme is not a concept–conclusion evidence link.
  const orbit = new Map<number, number>();
  for (const c of concepts) {
    const n = conclusions.find((x) => x.id === c.home);
    if (!n) continue;
    const k = orbit.get(c.home) ?? 0;
    orbit.set(c.home, k + 1);
    const ang = k * 2.4,
      rad = 34 + 11 * Math.sqrt(k);
    c.x = n.x + Math.cos(ang) * rad;
    c.y = n.y + Math.sin(ang) * rad;
  }
  for (const t of THEMES) {
    concepts
      .filter((c) => themeOf.get(c.home) === t.id)
      .slice(0, anchorsPerTheme)
      .forEach((c) => (c.anchor = true));
  }
  return {
    width: W,
    height: H,
    themes,
    conclusions,
    concepts: concepts.filter((c) => conclusions.some((n) => n.id === c.home)),
  };
}
