import type { AtlasData } from "./atlas.functions";
export type HistoryItem = {
  id: string;
  title: string;
  start: number;
  end: number;
  kind: string;
  domains: string[];
  importance: number | null;
  confidence: string | null;
  sources: string[];
};
export type HistoryBundle = {
  schemaVersion: number;
  exportedAt: string;
  source: string;
  policy: string;
  items: HistoryItem[];
  mechanismLinks?: {
    itemId: string;
    mechanismId: string;
    relation: "documented_context";
    rationale: string;
    sourceUrl: string;
    reviewStatus: "accepted" | "needs_review" | "rejected";
  }[];
};
// Explicit editorial domain grouping for display, never a concept/mechanism bridge.
export const HISTORY_DOMAINS: Record<string, string[]> = {
  rights: [
    "oikeudet",
    "oikeus",
    "oikeusturva",
    "perusoikeudet",
    "yhdenvertaisuus",
    "tasa-arvo",
    "ihmisoikeudet",
    "sosiaaliset oikeudet",
    "oikeusvaltio",
    "saavutettavuus",
  ],
  work: [
    "työ",
    "työelämä",
    "työmarkkinat",
    "työllisyys",
    "työttömyys",
    "palkat",
    "tuottavuus",
    "työurat",
    "ammatit",
    "teollisuus",
  ],
  health: [
    "terveys",
    "terveydenhuolto",
    "kansanterveys",
    "kuntoutus",
    "mielenterveys",
    "vammaisuus",
  ],
  education: [
    "koulutus",
    "osaaminen",
    "korkeakoulutus",
    "elinikäinen oppiminen",
    "sivistys",
    "sosiaalinen liikkuvuus",
  ],
  livelihood: [
    "toimeentulo",
    "sosiaaliturva",
    "sosiaalivakuutus",
    "köyhyys",
    "köyhäinhoito",
    "asuminen",
    "asumisturva",
    "sosiaalipalvelut",
    "sosiaalihuolto",
    "palvelut",
  ],
  governance: [
    "hallinto",
    "julkinen hallinto",
    "julkishallinto",
    "julkinen valta",
    "kunnat",
    "kunta",
    "valtio",
    "lainsäädäntö",
    "instituutiot",
    "institutionaalinen valta",
  ],
  finance: [
    "talous",
    "julkinen talous",
    "talouspolitiikka",
    "rahoitus",
    "raha",
    "velka",
    "velkaantuminen",
    "pankit",
    "verotus",
    "tulonjako",
    "omistus",
    "omistaminen",
    "maaomistus",
    "maanomistus",
    "omistajuus",
    "omistajaohjaus",
    "valtio-omistus",
    "korot",
    "kauppa",
    "vienti",
    "yritykset",
  ],
  population: [
    "väestö",
    "perhe",
    "perheet",
    "vanhuus",
    "hoiva",
    "maahanmuutto",
    "muuttoliike",
    "siirtoväki",
    "lapset",
    "nuoret",
    "eläke",
    "eläkkeet",
    "vanhemmuus",
  ],
  information: [
    "tieto",
    "tieto ja valta",
    "kieli",
    "kielet",
    "media",
    "lehdistö",
    "data",
    "digitalisaatio",
    "digipalvelut",
    "tekoäly",
    "viestintä",
  ],
  democracy: [
    "demokratia",
    "luottamus",
    "osallisuus",
    "kansalaisyhteiskunta",
    "kansalaisuus",
    "järjestöt",
    "yhteisöllisyys",
    "järjestäytyminen",
    "politiikka",
    "kulttuuri",
    "sananvapaus",
    "vapaaehtoistoiminta",
    "yhteisö",
  ],
  security_environment: [
    "turvallisuus",
    "energia",
    "ilmasto",
    "ympäristö",
    "luonto",
    "luonnonvarat",
    "metsät",
    "huoltovarmuus",
    "puolustus",
    "ulkopolitiikka",
    "geopolitiikka",
    "poliisi",
    "rikollisuus",
    "väkivalta",
  ],
  renewal: [
    "alueet",
    "aluekehitys",
    "aluerakenne",
    "maaseutu",
    "kaupungistuminen",
    "kaupungit",
    "teknologia",
    "infrastruktuuri",
    "investoinnit",
    "rakennemuutos",
    "maatalous",
    "liikenne",
    "elinvoima",
    "kestävyys",
  ],
};
export function historyThemes(item: HistoryItem) {
  return Object.entries(HISTORY_DOMAINS)
    .filter(([, domains]) =>
      item.domains.some((d) => domains.includes(d.toLocaleLowerCase("fi"))),
    )
    .map(([id]) => id);
}
export function validateHistory(h: HistoryBundle) {
  if (h.schemaVersion !== 1 || !h.exportedAt || !Array.isArray(h.items))
    throw Error("Virheellinen historiallinen aineisto");
  const ids = new Set<string>();
  for (const i of h.items) {
    if (
      !i.id ||
      ids.has(i.id) ||
      !i.title ||
      !Number.isInteger(i.start) ||
      !Number.isInteger(i.end) ||
      i.start > i.end ||
      !Array.isArray(i.domains) ||
      !Array.isArray(i.sources)
    )
      throw Error("Virheellinen historiallinen kohde");
    ids.add(i.id);
  }
  for (const l of h.mechanismLinks ?? [])
    if (!ids.has(l.itemId) || !l.rationale || !/^https?:\/\//.test(l.sourceUrl))
      throw Error("Virheellinen historiakytkentä");
}
export function historyConnections(
  h: HistoryBundle,
  data: AtlasData,
  mechanismIds: Set<string>,
  themes: Set<string>,
) {
  const r = data.evidence?.reasoning,
    statements = new Map(
      (r?.statements ?? [])
        .filter((s) => s.reviewStatus !== "rejected")
        .map((s) => [s.id, s]),
    );
  const current = (r?.mechanisms ?? []).filter(
    (m) =>
      mechanismIds.has(m.id) &&
      m.isCurrent &&
      m.reviewStatus !== "rejected" &&
      statements.has(m.statementId),
  );
  const ids = new Set(current.map((m) => m.id)),
    periods = current.flatMap((m) => {
      const s = statements.get(m.statementId)!;
      return s.start != null && s.end != null
        ? [{ start: s.start, end: s.end }]
        : [];
    });
  return h.items.map((item) => {
    const explicit = (h.mechanismLinks ?? []).filter(
      (l) =>
        l.itemId === item.id &&
        l.reviewStatus === "accepted" &&
        ids.has(l.mechanismId),
    );
    const topical = historyThemes(item).some((t) => themes.has(t));
    const timed =
      periods.length > 0 &&
      periods.some((p) => p.start <= item.end && p.end >= item.start);
    return {
      item,
      relation: explicit.length
        ? "recorded"
        : topical && (!periods.length || timed)
          ? "context"
          : "none",
      explicit,
      timed,
      topical,
    } as const;
  });
}
/** Fixed date-based positions; zoom reveals detail, never changes chronology. */
export function historyLayout(h: HistoryBundle, themeOrder: string[]) {
  const hash = (s: string) =>
    [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return h.items
    .filter((i) => i.end >= 1850 && i.start <= 2050)
    .map((item) => {
      const theme = historyThemes(item).find((t) => themeOrder.includes(t)),
        row = theme ? themeOrder.indexOf(theme) : themeOrder.length;
      return {
        item,
        theme,
        row,
        x: 100 + (Math.max(1850, item.start) - 1850) * 7,
        y: 180 + row * 48 + ((hash(item.id) % 5) - 2) * 7,
        endX: 100 + (Math.min(2050, item.end) - 1850) * 7,
      };
    });
}

/** Corridor geometry: vanishing point at the centre, 1850 at the viewer, 2050 at the far horizon. */
export const CORRIDOR = { cx: 800, cy: 500, halfW: 780, halfH: 440, zFar: 3 };
export function corridorScale(year: number) {
  const t = (2050 - Math.max(1850, Math.min(2050, year))) / 200;
  return 1 / (CORRIDOR.zFar - (CORRIDOR.zFar - 1) * t);
}
/** Phenomena sit on the left/right corridor walls; their wall height is the theme lane. */
export function corridorLayout(h: HistoryBundle, themeOrder: string[]) {
  const points = historyLayout(h, themeOrder);
  const groups = new Map<string, typeof points>();
  for (const p of points) {
    const key = `${p.row % 2}:${Math.floor(Math.max(1850, p.item.start) / 10)}`;
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  for (const group of groups.values())
    group.sort(
      (a, b) =>
        a.row - b.row ||
        a.item.start - b.item.start ||
        a.item.id.localeCompare(b.item.id),
    );
  return points.map((p) => {
    const side = p.row % 2 === 0 ? "left" : "right";
    const lane = Math.floor(p.row / 2) % 7;
    const group = groups.get(
      `${p.row % 2}:${Math.floor(Math.max(1850, p.item.start) / 10)}`,
    )!;
    const ordinal = group.findIndex((q) => q.item.id === p.item.id);
    // Evenly cover the wall height within every decade, rather than piling
    // hundreds of contemporary phenomena into six theme-height lanes.
    const v = -0.88 + ((ordinal + 0.5) / group.length) * 1.76;
    const stride = Math.max(1, Math.ceil(group.length / 18));
    const labelled = ordinal % stride === 0;
    const sign = side === "left" ? -1 : 1;
    const position = (year: number) => {
      const s = corridorScale(year);
      return {
        x: CORRIDOR.cx + sign * CORRIDOR.halfW * s,
        y: CORRIDOR.cy + v * CORRIDOR.halfH * s,
        s,
      };
    };
    const start = position(p.item.start),
      end = position(p.item.end);
    return {
      ...p,
      side,
      lane,
      labelled,
      depth: start.s,
      x: start.x,
      y: start.y,
      endX: end.x,
      endY: end.y,
    };
  });
}
