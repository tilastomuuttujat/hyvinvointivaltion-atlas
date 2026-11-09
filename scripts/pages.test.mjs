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


test('reasoning graph is traceable, clustered and explicitly provisional', async () => {
 const { validateReasoning,conceptsInCluster }=await import('../src/lib/atlas.reasoning.ts');
 const e=data.evidence,r=e.reasoning;
 validateReasoning(e,new Set(data.atlas.conclusions.map(c=>c.id)));
 assert.equal(r.clusters.length,4);
 assert.equal(r.memberships.length,16);
 assert.equal(new Set(r.memberships.map(m=>m.conceptId)).size,e.concepts.length);
 assert.ok(conceptsInCluster(e,'participation').some(c=>c.id==='work_ability'));
 assert.ok(conceptsInCluster(e,'capacity').some(c=>c.id==='work_ability'));
 assert.equal(r.observationSources.length,e.observations.length);
 assert.equal(r.statements.length,3);
 assert.equal(r.evidenceLinks.length,2);
 assert.equal(r.mechanisms.length,2);
 assert.equal(r.paths.length,1);
 assert.ok(r.evidenceLinks.every(x=>x.reviewStatus==='needs_review'&&!x.causalEffectIdentified));
 assert.ok(r.mechanisms.every(x=>x.reviewStatus==='needs_review'&&x.basis!=='causal'));
 const fiscal=r.statements.find(s=>s.id==='accommodation-fiscal-hypothesis');
 assert.equal(fiscal.kind,'hypothesis');
 assert.ok(r.evidenceLinks.some(x=>x.statementId===fiscal.id&&x.relation==='limits'));
 assert.ok(!r.evidenceLinks.some(x=>x.statementId===fiscal.id&&x.relation==='supports'));
 assert.equal(r.conclusionBridges[0].relation,'context_for');
 assert.ok(r.sources.some(s=>s.verification.includes('retrieval_403')));
});

test('reasoning validator rejects broken references and false causal approvals', async () => {
 const { validateReasoning }=await import('../src/lib/atlas.reasoning.ts');
 for(const change of [
  e=>{e.reasoning.evidenceLinks[0].observationId='withheld-or-missing'},
  e=>{e.reasoning.evidenceLinks[0].isCurrent=false},
  e=>{e.reasoning.evidenceLinks[0].causalEffectIdentified=true},
  e=>{e.reasoning.mechanisms[0].basis='causal'},
  e=>{e.reasoning.paths[0].steps[1].conceptId='income_adequacy'},
  e=>{e.reasoning.observationSources=[]},
 ]) {const e=structuredClone(data.evidence);change(e);assert.throws(()=>validateReasoning(e),/Invalid reasoning/)}
 const old=structuredClone(data.evidence);delete old.reasoning;assert.doesNotThrow(()=>validateReasoning(old));
});

test('shared SQL export includes canonical reasoning fragment', async () => {
 const combined=await readFile(new URL('./export-atlas.sql',import.meta.url),'utf8');
 const fragment=await readFile(new URL('./export-reasoning.sql',import.meta.url),'utf8');
 assert.ok(combined.includes(fragment.trim().replace(/;$/,'')));
});
