import { describe, expect, it } from 'vitest';
import snapshot from '../../public/data/atlas.json';
import type { AtlasData } from '@/lib/atlas.functions';
import { bridgedConclusions } from '@/lib/atlas.insights';
import { validateReasoning } from '@/lib/atlas.reasoning';
import { observationVisible } from '@/lib/atlas.navigation';

const data = { ...snapshot.atlas, evidence: snapshot.evidence } as unknown as AtlasData;
describe('static Atlas integration', () => {
  it('only the supplied explicit bridge highlights conclusion 25', () => {
    expect(bridgedConclusions(data, { level: 'concept', conceptId: 'labour_input_use' })).toEqual([25]);
    expect(bridgedConclusions(data, { level: 'concept', conceptId: 'benefit_receipt' })).toEqual([]);
  });
  it('never highlights rejected or superseded bridges', () => {
    const copy = structuredClone(data);
    const bridge = copy.evidence?.reasoning?.conclusionBridges[0];
    if (!bridge) throw new Error('Missing supplied bridge');
    bridge.reviewStatus = 'rejected';
    expect(bridgedConclusions(copy, { level: 'explanation', statementId: 'accommodation-participation' })).toEqual([]);
    bridge.reviewStatus = 'needs_review'; bridge.isCurrent = false;
    expect(bridgedConclusions(copy, { level: 'explanation', statementId: 'accommodation-participation' })).toEqual([]);
  });
  it('keeps undated observations out of a selected historical period by default', () => {
    const o = { start: null, end: null } as Parameters<typeof observationVisible>[0];
    expect(observationVisible(o, { start: 1850, end: 1916 })).toBe(false);
    expect(observationVisible(o, { start: 1850, end: 1916 }, true)).toBe(true);
  });
  it('validates every supplied reasoning reference without querying Neon', () => {
    if (!data.evidence) throw new Error('Missing evidence');
    expect(() => validateReasoning(data.evidence as NonNullable<AtlasData['evidence']>, new Set(data.conclusions.map(c => c.id)))).not.toThrow();
  });
});
