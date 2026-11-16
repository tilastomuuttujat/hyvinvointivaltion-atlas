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
  inspection?: { kind: string; id: string };
};
export type ReadingFrame = {
  key: string;
  title: string;
  items: ReadingItem[];
  note: string;
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
  const mechanisms = route.mechanisms.flatMap((id) => {
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
  for (const m of mechanisms) if (reached.has(m.from)) reached.add(m.to);
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
    .filter((c) => c.relation !== "none")
    .sort(
      (a, b) =>
        (b.relation === "recorded" ? 10 : 0) -
          (a.relation === "recorded" ? 10 : 0) ||
        (b.item.importance ?? 0) - (a.item.importance ?? 0) ||
        a.item.start - b.item.start,
    )
    .slice(0, 3);
  const anchor = highlights[0];
  const firstStatement = mechanisms[0]
    ? statements.get(mechanisms[0].statementId)
    : undefined;
  const year = anchor
    ? `${anchor.item.start}–${anchor.item.end}`
    : firstStatement?.start != null && firstStatement.end != null
      ? `${firstStatement.start}–${firstStatement.end}`
      : "Ajoitus avoin";
  items.push({
    id: anchor?.item.id ?? route.start,
    kind: anchor ? "phenomenon" : "concept",
    title: `${year} · ${anchor?.item.title ?? concepts.get(route.start)!.label}`,
    meaning: anchor ? "" : "Ilmiökytkentää ei ole kirjattu.",
    context: "",
    theme: themeIds[0] ?? "",
  });
  for (const m of mechanisms
    .filter((m) => reached.has(m.from) && reached.has(m.to))
    .slice(0, 3)) {
    items.push({
      id: m.id,
      sourceId: m.to,
      kind: "concept",
      title: `${concepts.get(m.from)!.label} → ${concepts.get(m.to)!.label}`,
      meaning: `${m.basis === "causal" && m.reviewStatus === "accepted" ? "" : m.basis === "association" ? "Kirjattu yhteys: " : "Selitysehdotus: "}${m.label}`,
      context: "",
      theme:
        themes.find((t) => t.concepts.some((c) => c.id === m.to))?.id ?? "",
      inspection: { kind: "mechanism", id: m.id },
    });
  }
  return {
    key: `${data.generatedAt ?? ""}:${route.start}:${mechanisms.map((m) => m.id).join("|")}`,
    title: "Mitä tämä kokonaisuus avaa?",
    items,
    note: anchor
      ? "Ilmiö on taustakonteksti. Yhteydet voivat haarautua; koko ketjun syyvaikutusta ei ole osoitettu."
      : "Ajoitus ja ilmiökytkentä jäävät avoimiksi.",
  };
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
