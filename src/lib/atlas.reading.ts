import type { AtlasData } from "./atlas.functions";
import type { SpotlightRoute } from "./atlas.spotlight";
import { historyConnections, type HistoryBundle } from "./atlas.history.ts";
export type ReadingItem = {
  id: string;
  kind: "concept" | "phenomenon";
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
  const items: ReadingItem[] = route.nodes
    .filter((id) => reached.has(id) && concepts.has(id))
    .map((id) => {
      const c = concepts.get(id)!,
        incoming = mechanisms.filter((m) => m.to === id && reached.has(m.from)),
        m = incoming[0],
        s = m ? statements.get(m.statementId) : undefined;
      const context = m
        ? `${m.basis === "causal" && m.reviewStatus === "accepted" ? "Kausaaliseksi arvioitu yhteys" : m.basis === "association" ? "Kirjattu yhteys" : "Selitysehdotus"}: ${m.label}. ${m.explanation} ${s?.scope || ""} ${s?.start != null && s.end != null ? `Kirjattu ajoitus ${s.start}–${s.end}.` : "Ajoitus avoin."} ${m.conditions ? `Ehdot: ${m.conditions}` : ""}`
        : themes
            .filter((t) => t.concepts.some((c) => c.id === id))
            .map((t) => t.label)
            .join(" · ");
      return {
        id,
        kind: "concept",
        title: c.label,
        meaning: c.definition || "Määritelmää ei ole kirjattu.",
        context,
        theme:
          themes.find((t) => t.concepts.some((c) => c.id === id))?.id ?? "",
        inspection: { kind: m ? "mechanism" : "concept", id: m?.id ?? id },
      };
    });
  if (!items.length) return null;
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
  for (const h of highlights)
    items.push({
      id: h.item.id,
      kind: "phenomenon",
      title: h.item.title,
      meaning: `${h.item.start}–${h.item.end} · ${h.item.kind}`,
      context:
        h.relation === "recorded"
          ? "Kirjattu kontekstikytkentä; ei yksin kausaalivahvistus."
          : h.timed
            ? "Aihealue ja kirjattu aikaikkuna kohtaavat. Taustakonteksti, ei kausaalivahvistus."
            : "Sama aihealue. Yhteistä ajoitusta ei ole varmistettu; ei kausaalivahvistus.",
      theme: themeIds[0] ?? "",
    });
  return {
    key: `${data.generatedAt ?? ""}:${route.start}:${mechanisms.map((m) => m.id).join("|")}`,
    title: concepts.get(route.start)?.label ?? route.start,
    items,
    note: "Määritelmät, selitykset ja ajoitukset ovat kirjattua aineistoa. Kokonaisuus voi haarautua; listajärjestys ei muodosta uusia syy-yhteyksiä.",
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
