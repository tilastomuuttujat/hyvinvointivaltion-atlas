import type { EvidenceRef } from './atlas.relationships';

export function mapDetail(zoom: number): 'terrain' | 'conclusions' | 'concepts' | 'evidence' {
  return zoom < 1.25 ? 'terrain' : zoom < 1.75 ? 'conclusions' : zoom < 2.4 ? 'concepts' : 'evidence';
}

/** Exact recorded labels, never inferred semantic bridges. */
export function recordedMapDetails(index: EvidenceRef[], c: number, p: string) {
  const refs = index.filter(e => e.c === c && e.p === p && e.reviewStatus !== 'rejected');
  const concepts = new Map<string, Set<number>>();
  for (const ref of refs) for (const label of ref.concepts) {
    const articles = concepts.get(label) ?? new Set<number>();
    articles.add(ref.articleNo); concepts.set(label, articles);
  }
  return {
    concepts: [...concepts].map(([label, articles]) => ({ label, articles: [...articles].sort((a,b) => a-b) })),
    articles: [...new Set(refs.map(r => r.articleNo))].sort((a,b) => a-b),
  };
}
