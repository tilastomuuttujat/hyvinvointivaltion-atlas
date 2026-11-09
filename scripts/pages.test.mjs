import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../public/data/atlas.json', import.meta.url), 'utf8'));
test('snapshot links reference existing conclusions and periods; aggregates match detail rows', () => {
  assert.equal(data.schemaVersion, 1);
  assert.ok(Number.isFinite(Date.parse(data.generatedAt)));
  assert.ok(data.atlas.articleCount > 0);
  const periods = new Set(data.atlas.periods.map(p => p.id));
  const conclusions = new Set(data.atlas.conclusions.map(c => c.id));
  const cells = new Map();
  for (const row of data.treatments) {
    assert.ok(periods.has(row.periodId)); assert.ok(conclusions.has(row.conclusionId));
    assert.ok(['direct', 'context', 'counterevidence'].includes(row.relation));
    assert.notEqual(row.reviewStatus, 'rejected'); assert.ok(row.articleTitle);
    const key = `${row.conclusionId}|${row.periodId}`;
    const c = cells.get(key) || { direct: 0, context: 0, counter: 0, articles: new Set() };
    c[row.relation === 'counterevidence' ? 'counter' : row.relation]++;
    c.articles.add(row.articleNo); cells.set(key, c);
  }
  assert.equal(data.atlas.cells.length, cells.size);
  for (const cell of data.atlas.cells) {
    const expected = cells.get(`${cell.c}|${cell.p}`);
    assert.ok(expected);
    for (const key of ['direct','context','counter']) assert.equal(cell[key], expected[key]);
    assert.equal(cell.articles, expected.articles.size);
  }
});
test('public snapshot contains no connection credentials or privileged configuration', () => {
  const text = JSON.stringify(data);
  assert.doesNotMatch(text, /postgres(?:ql)?:\/\/|LOVABLE_API_KEY|NEON_API_KEY|NEON_DATABASE_URL|neonQuery/);
});

test('observation layer preserves references, publication holds, months and research dates', async () => {
 const { conceptObservations, observationDate } = await import('../src/lib/atlas.evidence.ts');
 const { evidence:e } = JSON.parse(await readFile(new URL('../public/data/atlas.json',import.meta.url),'utf8'));
 assert.equal(e.concepts.length,13);
 assert.equal(e.observations.length,284);
 assert.equal(e.withheld,30);
 assert.equal(e.links.length,519);
 const ids=new Set(e.observations.map(o=>o.id)), concepts=new Set(e.concepts.map(c=>c.id));
 assert.equal(ids.size,e.observations.length);
 for(const l of e.links) { assert.ok(ids.has(l.observationId)); assert.ok(concepts.has(l.conceptId)); assert.notEqual(l.reviewStatus,'rejected'); }
 assert.equal(conceptObservations(e,'benefit_non_take_up').length,0);
 const months=e.observations.filter(o=>o.period);
 assert.ok(months.some(o=>o.period==='2024-12'));
 assert.ok(months.every(o=>observationDate(o)===o.period));
 const research=e.observations.filter(o=>o.kind==='research_finding');
 assert.equal(research.length,2);
 const approximate=research.find(o=>o.start===null);
 assert.ok(approximate); assert.match(observationDate(approximate),/ei tarkka havaintojakso/);
 assert.ok(e.articleRefs.every(r=>ids.has(r.observationId)&&!r.isCurrent&&r.reviewStatus==='needs_review'));
});
