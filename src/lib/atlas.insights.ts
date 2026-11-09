import type { AtlasData } from './atlas.functions';
import type { Stop } from './atlas.navigation';

/** Only explicit, current editorial bridges connect the two vocabularies. */
export function bridgedConclusions(data: AtlasData, stop: Stop): number[] {
  const bundle = data.evidence, r = bundle?.reasoning;
  if (!bundle || !r) return [];
  const concepts = new Set(stop.level === 'concept' ? [stop.conceptId] : stop.level === 'domain'
    ? r.memberships.filter(m => m.clusterId === stop.clusterId && m.reviewStatus !== 'rejected').map(m => m.conceptId) : []);
  const statements = new Set(stop.level === 'explanation' ? [stop.statementId]
    : r.statementConcepts.filter(s => concepts.has(s.conceptId)).map(s => s.statementId));
  return [...new Set(r.conclusionBridges.filter(b => b.isCurrent && b.reviewStatus !== 'rejected' && statements.has(b.statementId)).map(b => b.conclusionId))];
}

/** Editorial reading order, not a ranking of proven causal effects. */
export const ERA_STORIES = [
  { title: 'Oikeuksien pohja', id: 1 },
  { title: 'Itsenäisyys ja toimintavara', id: 10 },
  { title: 'Koulutuksen lupaus', id: 2 },
  { title: 'Turva oikeutena', id: 13 },
  { title: 'Kriisi ja suunnanmuutos', id: 16 },
  { title: 'Eritahtinen yhteiskunta', id: 17 },
  { title: 'Tulevaisuus haarautuu', id: 9 },
];
