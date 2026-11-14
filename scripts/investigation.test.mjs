// Fixed pilot fixture isolates navigation behaviour from additions to the public dataset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { explicitConclusions,fixedOffset,prepareInvestigation,zoomDepth,visibleTrail,zoomForStop,orderedNodes } from '../src/lib/atlas.investigation.ts';
import { conceptTrail,initialNavigation } from '../src/lib/atlas.navigation.ts';
const snapshot=JSON.parse(await readFile(new URL('./fixtures/pilot-atlas.json',import.meta.url),'utf8'));
const data={...snapshot.atlas,evidence:snapshot.evidence},e=data.evidence;
test('zoom uses hysteresis and retains the selected deep context when backing away',()=>{
 assert.equal(zoomDepth(1.26,0),0);assert.equal(zoomDepth(1.28,0),1);
 assert.equal(zoomDepth(1.24,1),1);assert.equal(zoomDepth(1.22,1),0);
 assert.equal(zoomDepth(2.9,0),5);assert.equal(zoomDepth(.6,5),0);
 const nav={intent:'effects',trail:[...conceptTrail(e,'work_accommodation'),{level:'explanation',statementId:'rtw-study-result'},{level:'observation',observationId:e.observations.find(o=>o.id.includes('3664')).id}]};
 assert.equal(visibleTrail(nav,2).at(-1).level,'concept');assert.equal(visibleTrail(nav,4).at(-1).level,'observation');
 assert.equal(nav.trail.length,5);assert.equal(zoomForStop(nav.trail.at(-1)),2.5);
});
test('map anchors follow explicit current argument paths, never label similarity',()=>{
 assert.deepEqual(explicitConclusions(data,{level:'concept',conceptId:'work_accommodation'}),[25]);
 assert.deepEqual(explicitConclusions(data,{level:'explanation',statementId:'rtw-study-result'}),[25]);
 assert.deepEqual(explicitConclusions(data,{level:'concept',conceptId:'benefit_receipt'}),[]);
 const copy=structuredClone(data);copy.evidence.reasoning.conclusionBridges[0].isCurrent=false;
 assert.deepEqual(explicitConclusions(copy,{level:'concept',conceptId:'work_accommodation'}),[]);
 copy.evidence.reasoning.conclusionBridges[0].isCurrent=true;copy.evidence.reasoning.conclusionBridges[0].reviewStatus='rejected';
 assert.deepEqual(explicitConclusions(copy,{level:'concept',conceptId:'work_accommodation'}),[]);
 const rejected=structuredClone(data);rejected.evidence.reasoning.statementRelations.forEach(x=>x.reviewStatus='rejected');
 assert.deepEqual(explicitConclusions(rejected,{level:'explanation',statementId:'rtw-study-result'}),[]);
});
test('fixed entity coordinates do not move with zoom, ranking or inquiry',()=>{
 assert.deepEqual(fixedOffset('concept:work_accommodation'),fixedOffset('concept:work_accommodation'));
 const nav={intent:'effects',trail:conceptTrail(e,'work_accommodation')};
 const low=prepareInvestigation(data,nav,2,'p6',25),high=prepareInvestigation(data,nav,5,'p6',25);
 for(const a of low.surfaces){const b=high.surfaces.find(b=>b.key===a.key);assert.ok(b);assert.equal(a.latOffset,b.latOffset);assert.equal(a.angOffset,b.angOffset)}
 assert.equal(high.stop.level,'concept');assert.ok(high.scene.notes.some(n=>n.includes('odottaa valintaa')));
});
test('missing bridges and temporal gaps are disclosed rather than assigned imaginary map positions',()=>{
 const missing=prepareInvestigation(data,initialNavigation,1,'p1',1);
 assert.equal(missing.missingRoot,true);assert.equal(missing.surfaces.length,0);
 const nav={intent:'evidence',trail:conceptTrail(e,'employment')};
 const withUnknown=prepareInvestigation(data,nav,2,'p6',25,true);
 const undated=withUnknown.scene.nodes.find(n=>n.stop?.level==='observation'&&e.observations.find(o=>o.id===n.stop.observationId)?.start===null);
 assert.ok(undated);assert.ok(withUnknown.unmapped.some(n=>n.id===undated.id));
 assert.ok(!withUnknown.surfaces.some(n=>n.id===undated.id));
 const past=prepareInvestigation(data,{intent:'effects',trail:conceptTrail(e,'work_accommodation')},3,'p1',25);
 assert.ok(!past.scene.nodes.some(n=>n.id==='accommodation-to-rtw'));
});
test('limiting and contrary evidence survives the map label priority',()=>{
 const nodes=[{key:'a',relation:'supports'},{key:'z',relation:'limits'},{key:'b',relation:'challenges'}];
 const sorted=orderedNodes(nodes);assert.equal(sorted[0].relation,'challenges');assert.equal(sorted[1].relation,'limits');
});
test('server reader uses canonical revision/rejection policy without credential exposure',async()=>{
 const source=await readFile(new URL('../src/lib/atlas.functions.ts',import.meta.url),'utf8');
 assert.ok(source.includes("../../scripts/export-atlas.sql?raw"));assert.ok(source.includes('neonQuery'));assert.ok(!source.includes('console.error'));
 const sql=await readFile(new URL('./export-atlas.sql',import.meta.url),'utf8');
 for(const guard of ['cp.based_on_article_revision=a.revision_no','cp.based_on_body_sha256=a.body_sha256','cp.based_on_conclusion_revision=c.revision_no',"cp.review_status<>'rejected'"])assert.ok(sql.includes(guard));
 assert.ok(!source.includes('NeonBatchResult'));
});

