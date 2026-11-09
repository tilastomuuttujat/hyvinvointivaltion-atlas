export const normalizeConcept = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase('fi').replace(/\s+/g, ' ');
export type EvidenceRef = {
  c: number; p: string; articleNo: number; concepts: string[];
  relation: string; reviewStatus?: string;
};
export type RelatedConnection = {
  c: number; p: string; articles: number[]; concepts: string[];
};
const normal = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('fi-FI');
const usable = (r: EvidenceRef) => r.reviewStatus !== 'rejected' && ['direct', 'context', 'counterevidence'].includes(r.relation);
// Co-occurrence is context, never causal evidence. Era alone is not a match.
export function relatedConnections(index: EvidenceRef[], selected: number): RelatedConnection[] {
  const mine = index.filter(r => r.c === selected && usable(r));
  const result = new Map<string, RelatedConnection>();
  for (const other of index) {
    if (other.c === selected || !usable(other)) continue;
    for (const own of mine) {
      if (own.p !== other.p) continue;
      const articles = own.articleNo === other.articleNo ? [own.articleNo] : [];
      const concepts = own.concepts.filter(a => normal(a) && other.concepts.some(b => normal(a) === normal(b)));
      if (!articles.length && !concepts.length) continue;
      const key = `${other.c}:${other.p}`;
      const row = result.get(key) || { c: other.c, p: other.p, articles: [], concepts: [] };
      row.articles = [...new Set([...row.articles, ...articles])].sort((a,b)=>a-b);
      row.concepts = [...new Map([...row.concepts,...concepts].map(c=>[normal(c),c])).values()];
      result.set(key, row);
    }
  }
  return [...result.values()].sort((a,b) => b.articles.length-a.articles.length || b.concepts.length-a.concepts.length || a.c-b.c || a.p.localeCompare(b.p));
}
export function timelineSegments<T extends { hasData: boolean }>(timeline: T[]): [T,T][] {
  return timeline.slice(1).flatMap((t,i)=>timeline[i].hasData && t.hasData ? [[timeline[i],t] as [T,T]] : []);
}
