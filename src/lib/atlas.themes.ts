import type { AtlasData } from "./atlas.functions";

/** Editorial theme areas covering every conclusion of the atlas (assignment by conclusion title). */
export const THEMES: { id: string; label: string; conclusions: number[] }[] = [
  { id: "valtio", label: "Valtio, oikeudet ja demokratia", conclusions: [5, 7, 14, 21, 22, 26, 27, 32, 34, 36, 40, 46, 48] },
  { id: "koulutus", label: "Koulutus ja osaaminen", conclusions: [1, 2, 17, 20, 39] },
  { id: "tyo", label: "Työ ja toimeentulo", conclusions: [13, 25, 28, 31, 38, 52, 53] },
  { id: "vaesto", label: "Väestö ja sukupolvet", conclusions: [8, 11, 12, 30, 35, 43, 45, 49] },
  { id: "talous", label: "Talous ja kasvu", conclusions: [3, 4, 18, 29, 37, 44] },
  { id: "kriisit", label: "Kriisit ja turvallisuus", conclusions: [6, 10, 15, 16, 23, 42, 51] },
  { id: "kestavyys", label: "Kestävyys ja tulevaisuus", conclusions: [9, 19, 24, 33, 41, 47, 50] },
];

export type ThemeConcept = {
  key: string; label: string; uses: number; x: number; y: number;
  home: number; conclusions: number[]; articles: number[]; periods: string[]; anchor: boolean;
};
export type ThemeNode = { id: number; title: string; x: number; y: number; theme: string };
export type ThemeArea = { id: string; label: string; x: number; y: number; r: number; color: string };
export type ThemeMap = { width: number; height: number; themes: ThemeArea[]; conclusions: ThemeNode[]; concepts: ThemeConcept[] };

const COLORS = ["var(--primary)", "var(--kind-hypo)", "var(--kind-principle)", "var(--kind-synth)", "var(--accent)", "var(--primary)", "var(--kind-hypo)"];
const norm = (s: string) => s.trim().toLocaleLowerCase("fi").replace(/\s+/g, " ");

/** Detail tier revealed at a relative zoom: themes+anchors → conclusions → every recorded concept. */
export function themeDetail(zoom: number): 0 | 1 | 2 {
  return zoom >= 2.4 ? 2 : zoom >= 1.5 ? 1 : 0;
}

export function buildThemeMap(data: AtlasData, anchorsPerTheme = 3): ThemeMap {
  const W = 1800, H = 1400, R = 200;
  const centres = [[900, 700], [900, 250], [1290, 475], [1290, 925], [900, 1150], [510, 925], [510, 475]];
  const titles = new Map(data.conclusions.map((c) => [c.id, c.title]));
  const themes: ThemeArea[] = THEMES.map((t, i) => ({ id: t.id, label: t.label, x: centres[i]![0]!, y: centres[i]![1]!, r: R, color: COLORS[i]! }));
  const themeOf = new Map<number, string>();
  THEMES.forEach((t) => t.conclusions.forEach((c) => themeOf.set(c, t.id)));
  const conclusions: ThemeNode[] = [];
  THEMES.forEach((t, i) => {
    const a = themes[i]!;
    const list = t.conclusions.filter((c) => titles.has(c));
    list.forEach((c, k) => {
      const ang = (k / list.length) * Math.PI * 2 - Math.PI / 2;
      conclusions.push({ id: c, title: titles.get(c)!, theme: t.id, x: a.x + Math.cos(ang) * R * 0.55, y: a.y + Math.sin(ang) * R * 0.55 });
    });
  });
  const byKey = new Map<string, ThemeConcept>();
  for (const r of data.evidenceIndex ?? []) {
    if (r.relation === "none" || r.reviewStatus === "rejected") continue;
    for (const raw of r.concepts) {
      const key = norm(raw);
      if (!key) continue;
      const c = byKey.get(key) ?? { key, label: raw.trim(), uses: 0, x: 0, y: 0, home: r.c, conclusions: [], articles: [], periods: [], anchor: false };
      c.uses++;
      if (!c.conclusions.includes(r.c)) c.conclusions.push(r.c);
      if (!c.articles.includes(r.articleNo)) c.articles.push(r.articleNo);
      if (!c.periods.includes(r.p)) c.periods.push(r.p);
      byKey.set(key, c);
    }
  }
  const concepts = [...byKey.values()].sort((a, b) => b.uses - a.uses || a.key.localeCompare(b.key));
  // Home = conclusion with most uses of the concept is approximated by first-seen; place in a small orbit around it.
  const orbit = new Map<number, number>();
  for (const c of concepts) {
    const n = conclusions.find((x) => x.id === c.home);
    if (!n) continue;
    const k = orbit.get(c.home) ?? 0;
    orbit.set(c.home, k + 1);
    const ang = k * 2.4, rad = 34 + 11 * Math.sqrt(k);
    c.x = n.x + Math.cos(ang) * rad;
    c.y = n.y + Math.sin(ang) * rad;
  }
  for (const t of THEMES) {
    concepts.filter((c) => themeOf.get(c.home) === t.id).slice(0, anchorsPerTheme).forEach((c) => (c.anchor = true));
  }
  return { width: W, height: H, themes, conclusions, concepts: concepts.filter((c) => conclusions.some((n) => n.id === c.home)) };
}
