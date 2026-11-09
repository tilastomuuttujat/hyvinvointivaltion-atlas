import type { AtlasData } from './atlas.functions';
import type { Stop, Navigation, NavNode } from './atlas.navigation';
import { LEVELS, sceneFor, temporalStatus } from './atlas.navigation.ts';
export const DEPTHS:Stop['level'][]=['overview','domain','concept','explanation','observation','source'];
export const ZOOMS=[1,1.4,1.8,2.15,2.5,2.85];
const BOUNDS=[1.25,1.6,1.95,2.3,2.65];
export function zoomDepth(zoom:number,previous=0) {
 let next=previous;
 // Hysteresis prevents trackpad jitter from flickering between information layers.
 while(next<5&&zoom>=BOUNDS[next]+.025)next++;
 while(next>0&&zoom<BOUNDS[next-1]-.025)next--;
 return next;
}
export function visibleTrail(navigation:Navigation,depth:number) {
 const trail=navigation.trail.filter(s=>DEPTHS.indexOf(s.level)<=depth);
 return trail.length?trail:[{level:'overview'} as Stop];
}
export function zoomForStop(stop:Stop) {return ZOOMS[DEPTHS.indexOf(stop.level)]}
export function entityKey(stop:Stop):string {
 switch(stop.level){case 'overview':return 'overview';case 'domain':return `cluster:${stop.clusterId}`;case 'concept':return `concept:${stop.conceptId}`;case 'explanation':return `statement:${stop.statementId}`;case 'observation':return `observation:${stop.observationId}`;case 'source':return `source:${stop.sourceId}`}
}
export function stopStatements(data:AtlasData,stop:Stop):Set<string> {
 const r=data.evidence?.reasoning;if(!r)return new Set();
 const alive=new Set(r.statements.filter(s=>s.reviewStatus!=='rejected').map(s=>s.id));
 let ids:string[]=[];
 if(stop.level==='explanation')ids=[stop.statementId];
 if(stop.level==='observation'||stop.level==='source')ids=r.evidenceLinks.filter(e=>e.observationId===stop.observationId&&e.isCurrent&&e.reviewStatus!=='rejected').map(e=>e.statementId);
 if(stop.level==='concept'||stop.level==='domain'){
  const concepts=new Set(stop.level==='concept'?[stop.conceptId]:r.memberships.filter(m=>m.clusterId===stop.clusterId&&m.reviewStatus!=='rejected').map(m=>m.conceptId));
  ids=r.statementConcepts.filter(s=>concepts.has(s.conceptId)).map(s=>s.statementId);
 }
 const seen=new Set(ids.filter(id=>alive.has(id))),queue=[...seen];
 // Traverse explicit argument relations for navigation context, never as inferred causal proof.
 while(queue.length){const id=queue.shift()!;for(const edge of r.statementRelations){if(!edge.isCurrent||edge.reviewStatus==='rejected')continue;const other=edge.from===id?edge.to:edge.to===id?edge.from:null;if(other&&alive.has(other)&&!seen.has(other)){seen.add(other);queue.push(other)}}}
 return seen;
}
export function explicitConclusions(data:AtlasData,stop:Stop):number[] {
 const statements=stopStatements(data,stop),r=data.evidence?.reasoning;
 return [...new Set((r?.conclusionBridges??[]).filter(b=>b.isCurrent&&b.reviewStatus!=='rejected'&&statements.has(b.statementId)&&data.conclusions.some(c=>c.id===b.conclusionId)).map(b=>b.conclusionId))].sort((a,b)=>a-b);
}
export type SurfaceNode=NavNode&{key:string;c:number;p:string;latOffset:number;angOffset:number;selection:Stop};
export function fixedOffset(key:string) {
 let hash=2166136261;for(const ch of key){hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;}
 const angle=(hash%360)*Math.PI/180,radius=.10+((hash>>>9)%5)*.035;
 return {latOffset:Math.sin(angle)*radius,angOffset:Math.cos(angle)*radius};
}
export function prepareInvestigation(data:AtlasData,navigation:Navigation,depth:number,periodId:string|null,selected:number|null,includeUndated=false) {
 const e=data.evidence,trail=visibleTrail(navigation,depth),stop=trail[trail.length-1];
 if(!e)return null;
 const period=data.periods.find(p=>p.id===periodId)??null;
 const scene=sceneFor(e,stop,navigation.intent,period,includeUndated);
 // At the map root, retain the selected conclusion as the question's context.
 const rootContext=stop.level==='overview';
 const nodes=rootContext&&selected!=null?scene.nodes.filter(n=>n.stop&&explicitConclusions(data,n.stop).includes(selected)):scene.nodes;
 const surfaces:SurfaceNode[]=[],unmapped:NavNode[]=[];
 for(const node of nodes){
  const selection=node.stop??stop;
  const observation=selection.level==='observation'||selection.level==='source'?e.observations.find(o=>o.id===selection.observationId):undefined;
  const candidates=explicitConclusions(data,selection);
  const c=candidates.find(id=>data.cells.some(cell=>cell.c===id&&cell.p===periodId&&cell.direct+cell.context+cell.counter>0));
  // Undated observations stay off the chronological surface, even when explicitly listed.
  if(c==null||!periodId||observation&&temporalStatus(observation,period)!=='inside'){unmapped.push(node);continue;}
  const key=entityKey(selection);
  surfaces.push({...node,key,selection,c,p:periodId,...fixedOffset(key)});
 }
 const missingRoot=rootContext&&scene.nodes.length>0&&nodes.length===0;
 const notes=[...scene.notes];
 if(missingRoot)notes.unshift('Tähän päätelmään ei ole nykyistä määritellyn käsitesanaston kytkentää. Pallon artikkelimerkinnät ovat eri sanasto.');
 if(unmapped.length)notes.push(`${unmapped.length} kohdetta ei sijoiteta pallon aikapinnalle ilman nykyistä päätelmäkytkentää ja sopivaa ajoitusta. Ne ovat avattavissa tietokentästä.`);
 if(depth>DEPTHS.indexOf(stop.level))notes.unshift(`Lähikuva odottaa valintaa: valitse ensin ${stop.level==='overview'?'ilmiöalue':stop.level==='domain'?'avainkäsite':'seuraava perustelu'}. Zoomaus ei valitse väitettä puolestasi.`);
 return {scene:{...scene,nodes,notes},trail,stop,surfaces,unmapped,missingRoot,depthLabel:LEVELS[stop.level]};
}
export function orderedNodes(nodes:SurfaceNode[]) {
 // Keep challenges and limitations alongside supporting results, including under a label budget.
 const polarity=(n:SurfaceNode)=>n.relation==='challenges'||n.relation==='limits'?0:n.kind==='mechanism'?1:n.kind==='evidence'?2:n.kind==='concept'||n.kind==='cluster'?3:n.kind==='statement'?4:5;
 return [...nodes].sort((a,b)=>polarity(a)-polarity(b)||a.key.localeCompare(b.key));
}
