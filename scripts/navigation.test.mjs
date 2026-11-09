import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialNavigation,descend,returnTo,temporalStatus,observationsFor,mechanismsFor,evidenceFor,sceneFor,conceptTrail,validPaths } from '../src/lib/atlas.navigation.ts';
const {evidence:e}=JSON.parse(await readFile(new URL('../public/data/atlas.json',import.meta.url),'utf8'));
const current={start:2010,end:2025},past={start:1850,end:1916},future={start:2026,end:2050};
test('navigation preserves inquiry and true visited ancestry; repeated stops do not loop',()=>{
 let s={...initialNavigation,intent:'causes'};
 s=descend(s,{level:'domain',clusterId:'capacity'});s=descend(s,{level:'concept',conceptId:'work_ability'});
 assert.equal(s.intent,'causes');assert.equal(s.trail.length,3);
 assert.equal(returnTo(s,1).trail.length,2);assert.equal(returnTo(s,1).intent,'causes');
 assert.equal(descend(s,{level:'domain',clusterId:'capacity'}).trail.length,2);
 assert.deepEqual(initialNavigation.trail,[{level:'overview'}]);
 const trail=conceptTrail(e,'work_ability','participation');assert.equal(trail[1].clusterId,'participation');
 assert.equal(conceptTrail(e,'benefit_non_take_up')[1].clusterId,'livelihood');
});
test('temporal scope distinguishes overlapping, missing and non-overlapping dates',()=>{
 assert.equal(temporalStatus({start:2010,end:2013},current),'inside');
 assert.equal(temporalStatus({start:2025,end:2025},current),'inside');
 assert.equal(temporalStatus({start:null,end:null},current),'undated');
 assert.equal(temporalStatus({start:2010,end:2013},future),'outside');
 const exact=observationsFor(e,'employment',current),withUnknown=observationsFor(e,'employment',current,true);
 assert.ok(exact.every(o=>o.start!=null&&o.start<=2025&&o.end>=2010));
 assert.ok(withUnknown.some(o=>o.start===null));
 assert.ok(!exact.some(o=>o.start===null));
 assert.ok(observationsFor(e,'benefit_receipt',past).length===0);
});
test('cause/effect suggestions follow explicit direction and reject stale or rejected mechanisms',()=>{
 const outgoing=mechanismsFor(e,'work_accommodation','effects',current);
 assert.deepEqual(outgoing.map(m=>m.id),['accommodation-to-rtw']);
 assert.deepEqual(mechanismsFor(e,'sustained_return_to_work','causes',current).map(m=>m.id),['accommodation-to-rtw']);
 assert.equal(mechanismsFor(e,'work_accommodation','causes',current).length,0);
 assert.equal(mechanismsFor(e,'work_accommodation','effects',past).length,0);
 assert.equal(mechanismsFor(e,'work_accommodation','effects',future).length,0);
 const copy=structuredClone(e);copy.reasoning.mechanisms[0].isCurrent=false;
 assert.equal(mechanismsFor(copy,'work_accommodation','effects',current).length,0);
 copy.reasoning.mechanisms[0].isCurrent=true;copy.reasoning.mechanisms[0].reviewStatus='rejected';
 assert.equal(mechanismsFor(copy,'work_accommodation','effects',current).length,0);
 // No relationship is inferred from a shared era or matching free-text labels.
 assert.equal(mechanismsFor(e,'income_adequacy','effects',current).length,0);
});
test('evidential relevance retains limitations and contrary evidence, never upgrades causal status',()=>{
 const copy=structuredClone(e),edge=copy.reasoning.evidenceLinks.find(x=>x.relation==='limits');
 const links=evidenceFor(copy,edge.statementId,current);
 assert.equal(links.length,1);assert.equal(links[0].relation,'limits');assert.equal(links[0].causalEffectIdentified,false);
 copy.reasoning.evidenceLinks.push({...edge,id:'counter',relation:'challenges'});
 assert.ok(evidenceFor(copy,edge.statementId,current).some(x=>x.relation==='challenges'));
 copy.reasoning.evidenceLinks.find(x=>x.id===edge.id).isCurrent=false;
 assert.ok(!evidenceFor(copy,edge.statementId,current).some(x=>x.id===edge.id));
 assert.equal(evidenceFor(e,'rtw-study-result',future).length,0);
});
test('scenes show actual gaps and outside-window warnings without switching time',()=>{
 const gap=sceneFor(e,{level:'concept',conceptId:'benefit_non_take_up'},'evidence',current);
 assert.equal(gap.nodes.length,0);assert.ok(gap.notes.some(x=>x.includes('Havaintoaukko')));
 const research=e.observations.find(o=>o.id.includes('3664'));
 const obs=sceneFor(e,{level:'observation',observationId:research.id},'evidence',past);
 assert.ok(obs.notes.some(x=>x.includes('aikarajauksen ulkopuolella')));
 const source=sceneFor(e,obs.nodes[0].stop,'evidence',past);
 assert.equal(source.nodes[0].href,research.sourceUrl);
 const old=structuredClone(e);delete old.reasoning;
 assert.equal(sceneFor(old,{level:'overview'},'effects',null).nodes.length,0);
});
test('guided paths use explicit valid steps and omit broken paths',()=>{
 assert.equal(validPaths(e).length,1);
 const copy=structuredClone(e);copy.reasoning.paths[0].steps[1].conceptId='income_adequacy';
 assert.equal(validPaths(copy).length,0);
});
