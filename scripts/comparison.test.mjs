import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildComparison,comparisonSegments} from '../src/lib/atlas.comparison.ts';
const fixture=()=>({periods:[{id:'p1',label:'1850–1916',start:1850,end:1916},{id:'p2',label:'1917–1944',start:1917,end:1944},{id:'p3',label:'1945–1974',start:1945,end:1974}],conclusions:[1,2,3].map(id=>({id,title:`Väite ${id}`,claim:`Väitteen ${id} sisältö`,kind:'synteesi',limitations:'Rajaus'})),cells:[],articleCount:3,evidenceIndex:[]});
const ref=(c,p,articleNo,concepts=[],reviewStatus='needs_review',relation='context')=>({c,p,articleNo,concepts,reviewStatus,relation});
test('comparison requires two or three distinct existing conclusions',()=>{
 const d=fixture();assert.throws(()=>buildComparison(d,[1]),/kaksi tai kolme/);assert.throws(()=>buildComparison(d,[1,1]),/kaksi tai kolme/);assert.throws(()=>buildComparison(d,[1,8]),/kaksi tai kolme/);assert.throws(()=>buildComparison(d,[1,2],'missing'),/aikakausi/);
 assert.deepEqual(buildComparison(d,[2,1,2]).ids,[2,1]);
});
test('same era or article in a different era does not create a link',()=>{
 const d=fixture();d.evidenceIndex=[ref(1,'p1',1,['työ']),ref(2,'p1',2,['työttömyys']),ref(2,'p2',1,['työ'])];
 assert.equal(buildComparison(d,[1,2]).links.length,0);
});
test('only exact normalized recorded words or shared same-era articles match',()=>{
 const d=fixture();d.evidenceIndex=[ref(1,'p1',1,[' TyÖ ']),ref(2,'p1',2,['työ']),ref(1,'p2',3,[]),ref(2,'p2',3,[])];
 const result=buildComparison(d,[1,2]);assert.equal(result.links.length,2);assert.equal(result.links[0].concepts[0].toLowerCase(),'työ');assert.deepEqual(result.links[1].articles,[3]);
 assert.equal(buildComparison(d,[1,2],'p1').links.length,1);
});
test('pairwise connections are not reported as one shared three-conclusion chain',()=>{
 const d=fixture();d.evidenceIndex=[ref(1,'p1',1),ref(2,'p1',1),ref(3,'p1',3)];const result=buildComparison(d,[1,2,3]);
 assert.equal(result.links.length,1);assert.equal(result.commonAll.length,0);assert.match(result.stories[0].text,/pareittain/);assert.equal(result.arguments.length,0);assert.match(result.stories[2].text,/ei löydy/);
});
test('rejected entries are excluded and pending entries never become accepted evidence',()=>{
 const d=fixture();d.evidenceIndex=[ref(1,'p1',1,[],'accepted'),ref(2,'p1',1),ref(1,'p2',3,['x'],'rejected'),ref(2,'p2',3,['x'])];
 assert.equal(buildComparison(d,[1,2]).links.length,1);assert.equal(buildComparison(d,[1,2]).links[0].allAccepted,false);
 d.evidenceIndex[1].reviewStatus='accepted';assert.equal(buildComparison(d,[1,2]).links[0].allAccepted,true);
});
test('duplicate references do not inflate profile coverage and counterevidence is retained',()=>{
 const d=fixture();const row=ref(1,'p1',1,[],'needs_review','counterevidence');d.evidenceIndex=[row,row,ref(2,'p1',1)];
 const result=buildComparison(d,[1,2]);assert.equal(result.profiles[0].counter,1);assert.equal(result.profiles[0].articles.length,1);assert.equal(result.links.length,1);
});
test('argument links require explicit current bridges and current statement relations',()=>{
 const d=fixture();d.evidence={observations:[],reasoning:{statements:[{id:'a',reviewStatus:'needs_review',start:null,end:null,scope:'A'},{id:'b',reviewStatus:'needs_review',start:null,end:null,scope:'B'}],conclusionBridges:[{statementId:'a',conclusionId:1,isCurrent:true,reviewStatus:'needs_review'},{statementId:'b',conclusionId:2,isCurrent:true,reviewStatus:'needs_review'}],statementRelations:[{from:'a',to:'b',relation:'supports',isCurrent:true,reviewStatus:'needs_review',rationale:'Peruste',limitations:'Rajaus'}],mechanisms:[],evidenceLinks:[]}};
 assert.equal(buildComparison(d,[1,2]).arguments.length,1);assert.match(buildComparison(d,[1,2]).stories[2].text,/eivät mitattua yhteisvaikutusta/);
 d.evidence.reasoning.statementRelations[0].reviewStatus='accepted';assert.equal(buildComparison(d,[1,2]).arguments[0].reviewStatus,'needs_review');
 d.evidence.reasoning.conclusionBridges[0].isCurrent=false;assert.equal(buildComparison(d,[1,2]).arguments.length,0);
 d.evidence.reasoning.conclusionBridges[0].isCurrent=true;d.evidence.reasoning.statementRelations[0].reviewStatus='rejected';assert.equal(buildComparison(d,[1,2]).arguments.length,0);
});
test('comparison timelines do not bridge empty eras',()=>{
 const d=fixture();d.cells=[{c:1,p:'p1',direct:1,context:0,counter:0},{c:1,p:'p3',direct:1,context:0,counter:0}];
 assert.equal(comparisonSegments(d,[1],null)[0].segments.length,0);
 d.cells.push({c:1,p:'p2',direct:1,context:0,counter:0});assert.equal(comparisonSegments(d,[1],null)[0].segments.length,2);assert.equal(comparisonSegments(d,[1],'p2')[0].segments.length,0);
});
test('the published dataset supports comparison without inventing numerical effects',async()=>{
 const s=JSON.parse(await readFile(new URL('../public/data/atlas.json',import.meta.url),'utf8'));const d={...s.atlas,evidence:s.evidence,evidenceIndex:s.treatments.map(t=>({c:t.conclusionId,p:t.periodId,articleNo:t.articleNo,concepts:t.concepts??[],relation:t.relation,reviewStatus:t.reviewStatus}))};
 const result=buildComparison(d,[1,2,25]);assert.equal(result.profiles.length,3);assert.ok(result.links.length>0);assert.equal(result.arguments.length,0);assert.match(result.stories[2].limitation,/ei tarjoa.*numeerista/);
});
