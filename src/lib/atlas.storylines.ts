import type { Cell, Period } from "./atlas.functions";
import { relatedConnections, type EvidenceRef } from "./atlas.relationships";

export type Storyline = { id: string; label: string; lead: string; conclusions: number[] };

/** Editorial theme paths: each lists conclusion ids from atlas_editing.conclusions. */
export const STORYLINES: Storyline[] = [
  { id: "demografia", label: "Huoltosuhde & demografia", lead: "Ikääntyminen, alueelliset väestötilanteet ja maahanmuutto muuttavat sitä, mitä huoltosuhde kantaa.", conclusions: [11, 12, 30, 35, 42, 43, 49] },
  { id: "koulutus", label: "Koulutuslupauksen murros", lead: "Oikeus koulutukseen laajeni nopeasti — sen käyttämisen edellytykset ja perustaidot eivät pysyneet tahdissa.", conclusions: [2, 39, 1, 8, 17] },
  { id: "vastuukuilu", label: "Valtion vastuukuilu & velkaantuminen", lead: "Omistajasta ehtojen asettajaksi: päätösvalta hajautuu ja velka siirtää sitä ajassa.", conclusions: [7, 22, 29, 46, 27] },
  { id: "kriisit", label: "Kriisit ja oppiminen", lead: "Aiemmat kriisit synnyttivät siirtymiä; menestys voi myös lukita.", conclusions: [6, 16, 23, 19, 24] },
];

const hasData = (c: Cell) => c.direct + c.context + c.counter > 0;

/** Turning points: periods (in order) where at least one storyline conclusion has evidence. */
export function storylineStops(periods: Period[], cells: Cell[], ids: number[]): string[] {
  const set = new Set(ids);
  return periods.filter((p) => cells.some((c) => c.p === p.id && set.has(c.c) && hasData(c))).map((p) => p.id);
}

/** Periods treated as the documented past a 2026–2050 scenario grows from (overlapping 1970–2025). */
export const pastWindow = (periods: Period[]) => periods.filter((p) => p.end >= 1970 && p.start < 2026);
export const futurePeriods = (periods: Period[]) => periods.filter((p) => p.start >= 2026);

export type Backcast = { c: number; p: string; via: "same" | "linked"; articles: number[]; concepts: string[] };

/**
 * Back-cast for a future scenario conclusion: its own documented 1970–2025 evidence, plus other
 * conclusions that share an article or exact key concept with it in those same past periods.
 */
export function backcast(periods: Period[], cells: Cell[], index: EvidenceRef[], scenario: number): Backcast[] {
  const past = new Set(pastWindow(periods).map((p) => p.id));
  const own: Backcast[] = cells
    .filter((c) => c.c === scenario && past.has(c.p) && hasData(c))
    .map((c) => ({ c: c.c, p: c.p, via: "same", articles: [], concepts: [] }));
  const linked: Backcast[] = relatedConnections(index, scenario)
    .filter((r) => past.has(r.p))
    .map((r) => ({ ...r, via: "linked" }));
  return [...own, ...linked];
}

/** Period containing a given year (clamped to the first/last period). */
export function periodAt(periods: Period[], year: number): Period | undefined {
  return periods.find((p) => year >= p.start && year <= p.end) ?? (year < (periods[0]?.start ?? 0) ? periods[0] : periods[periods.length - 1]);
}
