import type { AtlasData } from "./atlas.functions";
import type { SpotlightRoute } from "./atlas.spotlight";
import { historyConnections, type HistoryBundle } from "./atlas.history.ts";
export type ReadingItem = {
  id: string;
  kind: "concept" | "phenomenon";
  sourceId?: string;
  title: string;
  meaning: string;
  context: string;
  theme: string;
  /** Role in the reasoning arc: background, a mechanism link, or the end point. */
  role?: "lähtökohta" | "mekanismi";
  /** Evidence status of a mechanism link, shown as a plain-language badge. */
  basis?: "arvioitu syy" | "kirjattu yhteys" | "selitysehdotus";
  inspection?: { kind: string; id: string };
};
export type ReadingFrame = {
  key: string;
  title: string;
  items: ReadingItem[];
  note: string;
  /** Plain-language conclusion assembled only from the recorded links above. */
  synthesis?: string;
};
type Theme = { id: string; label: string; concepts: { id: string }[] };
export function buildReadingFrame(
  data: AtlasData,
  route: SpotlightRoute | null,
  history: HistoryBundle,
  themes: Theme[],
): ReadingFrame | null {
  if (!route) return null;
  const r = data.evidence?.reasoning,
    concepts = new Map(data.evidence?.concepts.map((c) => [c.id, c]));
  const statements = new Map(
    (r?.statements ?? [])
      .filter((s) => s.reviewStatus !== "rejected")
      .map((s) => [s.id, s]),
  );
  const candidates = route.mechanisms.flatMap((id) => {
    const m = r?.mechanisms.find(
      (m) =>
        m.id === id &&
        m.isCurrent &&
        m.reviewStatus !== "rejected" &&
        statements.has(m.statementId) &&
        concepts.has(m.from) &&
        concepts.has(m.to),
    );
    return m ? [m] : [];
  });
  const reached = new Set([route.start]);
  const mechanisms: typeof candidates = [];
  for (const m of candidates)
    if (reached.has(m.from)) {
      reached.add(m.to);
      mechanisms.push(m);
    }
  const themeIds = themes
    .filter((t) => t.concepts.some((c) => c.id === route.start))
    .map((t) => t.id);
  if (!concepts.has(route.start)) return null;
  const items: ReadingItem[] = [];
  const highlights = historyConnections(
    history,
    data,
    new Set(mechanisms.map((m) => m.id)),
    new Set(themeIds),
  )
    .filter((c) => c.anchorEligible)
    .sort(
      (a, b) =>
        a.item.end - a.item.start - (b.item.end - b.item.start) ||
        a.item.id.localeCompare(b.item.id),
    )
    .slice(0, 3);
  const anchor = highlights[0];
  const periods = mechanisms.flatMap((m) => {
    const s = statements.get(m.statementId)!;
    return s.start != null && s.end != null
      ? [{ start: s.start, end: s.end }]
      : [];
  });
  const lo = periods.length ? Math.max(...periods.map((p) => p.start)) : null,
    hi = periods.length ? Math.min(...periods.map((p) => p.end)) : null;
  const disjoint = lo !== null && hi !== null && lo > hi;
  const year = anchor
    ? `${anchor.item.start}–${anchor.item.end}`
    : disjoint
      ? "Eri aikaikkunat"
      : periods.length && periods.length === mechanisms.length
        ? `${lo}–${hi}`
        : periods.length
          ? "Ajoitus osittain avoin"
          : "Ajoitus avoin";
  items.push({
    id: anchor?.item.id ?? route.start,
    kind: anchor ? "phenomenon" : "concept",
    title: `${year} · ${anchor?.item.title ?? concepts.get(route.start)!.label}`,
    meaning: anchor
      ? "Kirjattu tapauskonteksti kaikille ketjun yhteyksille; ei koko vaikutuksen vahvistus."
      : "Yleinen selitysketju. Historiallista tapauskytkentää ei ole varmistettu.",
    context: "",
    theme: themeIds[0] ?? "",
    role: "lähtökohta",
  });
  const shownLinks = mechanisms
    .filter((m) => reached.has(m.from) && reached.has(m.to))
    .slice(0, 3);
  const told = new Set<string>();
  for (const m of shownLinks) {
    const causal = m.basis === "causal" && m.reviewStatus === "accepted";
    let why = m.explanation?.trim();
    if (why && told.has(why)) why = "";
    if (why) told.add(why);
    items.push({
      id: m.id,
      sourceId: m.to,
      kind: "concept",
      title: `${concepts.get(m.from)!.label} → ${concepts.get(m.to)!.label}`,
      meaning: `${m.label}.${m.conditions?.trim() ? ` Ehto: ${m.conditions.trim()}` : why && why !== m.label ? ` ${why}` : ""}`,
      role: "mekanismi",
      basis: causal
        ? "arvioitu syy"
        : m.basis === "association"
          ? "kirjattu yhteys"
          : "selitysehdotus",
      context: "",
      theme:
        themes.find((t) => t.concepts.some((c) => c.id === m.to))?.id ?? "",
      inspection: { kind: "mechanism", id: m.id },
    });
  }
  return {
    key: `${data.generatedAt ?? ""}:${route.start}:${mechanisms.map((m) => m.id).join("|")}`,
    title: "Mitä tämä kokonaisuus avaa?",
    synthesis: shownLinks.length
      ? synthesise(
          shownLinks.map((m) => ({
            from: concepts.get(m.from)!.label,
            to: concepts.get(m.to)!.label,
            causal: m.basis === "causal" && m.reviewStatus === "accepted",
            conditional: !!m.conditions?.trim(),
          })),
          anchor?.item.title,
        ) +
        (!anchor
          ? " Yhteistä tapausta ja soveltamistilannetta ei ole varmistettu."
          : "") +
        (disjoint ? " Askelten aikaikkunat eivät kohtaa." : "")
      : undefined,
    items,
    note: anchor
      ? "Tapauskytkentä on kirjattu erikseen jokaiseen yhteyteen; koko ketjun syyvaikutusta ei ole osoitettu."
      : disjoint
        ? "Askelten aikaikkunat eroavat. Yhteinen välikäsite ei vahvista samaa historiallista tilannetta."
        : "Yleinen selitysketju: yhteinen tapaus, ajoitus ja soveltamistilanne jäävät varmistamatta.",
  };
}
/** Conclusion sentence built from recorded link endpoints and their evidence status only. */
export function synthesise(
  links: { from: string; to: string; causal: boolean; conditional: boolean }[],
  phenomenon?: string,
): string | undefined {
  if (!links.length) return undefined;
  const start = links[0]!.from;
  const chain = links.every((l, i) => i === 0 || l.from === links[i - 1]!.to);
  const ends = chain
    ? [links.at(-1)!.to]
    : [...new Set(links.map((l) => l.to))];
  const via =
    chain && links.length > 1
      ? ` välivaiheen ${links
          .slice(0, -1)
          .map((l) => l.to)
          .join(" → ")} kautta`
      : "";
  const causal = links.filter((l) => l.causal).length;
  const target =
    ends.length === 1
      ? ends[0]
      : `${ends.slice(0, -1).join(", ")} ja ${ends.at(-1)}`;
  const strength =
    causal === links.length
      ? "Kaikki yhteydet arvioitu syysuhteiksi."
      : causal === 0
        ? "Yhteydet ovat selitysehdotuksia, eivät todennettuja syitä."
        : `${causal}/${links.length} yhteydestä arvioitu syysuhteiksi, muut selitysehdotuksia.`;
  const cond = links.some((l) => l.conditional)
    ? " Vaikutus riippuu kirjatuista ehdoista."
    : "";
  const description = chain
    ? `${start} kytkeytyy${via} kohteeseen ${target}.`
    : `Kirjatut yhteydet: ${links.map((l) => `${l.from} → ${l.to}`).join("; ")}. Niitä ei yhdistetä yhdeksi suoraksi ketjuksi.`;
  return `${phenomenon ? `Kirjattu tapauskonteksti ${phenomenon}: ` : ""}${description} ${strength}${cond}`;
}
export const READING_TIMING = { settle: 2000, step: 1300, hold: 14000 };
export type ReadingState = {
  candidate: ReadingFrame | null;
  since: number;
  frame: ReadingFrame | null;
  shown: number;
  nextAt: number;
  holdUntil: number;
  pausedAt: number | null;
};
export const emptyReading: ReadingState = {
  candidate: null,
  since: 0,
  frame: null,
  shown: 0,
  nextAt: 0,
  holdUntil: 0,
  pausedAt: null,
};
export function offerReading(
  s: ReadingState,
  frame: ReadingFrame | null,
  now: number,
): ReadingState {
  return s.candidate?.key === frame?.key
    ? s
    : { ...s, candidate: frame, since: now };
}
export function tickReading(s: ReadingState, now: number): ReadingState {
  if (s.pausedAt !== null) return s;
  if (s.frame && s.shown < s.frame.items.length) {
    if (now < s.nextAt) return s;
    const shown = s.shown + 1;
    return {
      ...s,
      shown,
      nextAt: now + READING_TIMING.step,
      holdUntil: shown === s.frame.items.length ? now + READING_TIMING.hold : 0,
    };
  }
  if (s.frame && now < s.holdUntil) return s;
  if (now - s.since < READING_TIMING.settle) return s;
  if (!s.candidate) return s.frame ? { ...s, frame: null, shown: 0 } : s;
  if (s.frame?.key === s.candidate.key) return s;
  return {
    ...s,
    frame: s.candidate,
    shown: 1,
    nextAt: now + READING_TIMING.step,
    holdUntil: s.candidate.items.length === 1 ? now + READING_TIMING.hold : 0,
  };
}
export function pauseReading(
  s: ReadingState,
  pause: boolean,
  now: number,
): ReadingState {
  if (pause) return s.pausedAt !== null ? s : { ...s, pausedAt: now };
  if (s.pausedAt === null) return s;
  const delay = now - s.pausedAt;
  return {
    ...s,
    pausedAt: null,
    since: s.since + Math.max(0, now - Math.max(s.pausedAt, s.since)),
    nextAt: s.nextAt + delay,
    holdUntil: s.holdUntil ? s.holdUntil + delay : 0,
  };
}
