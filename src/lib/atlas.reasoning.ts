import type { EvidenceBundle } from './atlas.evidence';
export type ReviewStatus = 'needs_review'|'accepted'|'rejected';
export type Statement = {id:string;title:string;text:string;kind:'empirical_claim'|'hypothesis'|'synthesis'|'evaluation'|'scenario';scope:string;conditions:string;limitations:string;start:number|null;end:number|null;revision:number;reviewStatus:ReviewStatus};
export type ReasoningBundle = {
 modelVersion:1;generatedAt:string;policy:string;
 clusters:{id:string;label:string;question:string;definition:string;reviewStatus:ReviewStatus}[];
 memberships:{conceptId:string;clusterId:string;rationale:string;reviewStatus:ReviewStatus}[];
 sources:{id:string;title:string;url:string;kind:string;version:string;publicationYear:number|null;verification:string;checkedOn:string|null;revision:number}[];
 observationSources:{observationId:string;sourceId:string;locator:string;verification:string;reviewStatus:ReviewStatus;isCurrent:boolean}[];
 statements:Statement[];
 statementConcepts:{statementId:string;conceptId:string;rationale:string}[];
 evidenceLinks:{id:string;observationId:string;statementId:string;relation:'supports'|'challenges'|'limits'|'context_for';rationale:string;applicability:string;limitations:string;assessmentBasis:string;causalEffectIdentified:boolean;reviewStatus:ReviewStatus;isCurrent:boolean}[];
 statementRelations:{from:string;to:string;relation:'supports'|'challenges'|'limits'|'assumption_for';rationale:string;limitations:string;reviewStatus:ReviewStatus;isCurrent:boolean}[];
 mechanisms:{id:string;from:string;to:string;label:string;explanation:string;conditions:string;limitations:string;basis:'hypothesized'|'association'|'causal';direction:string;statementId:string;reviewStatus:ReviewStatus;isCurrent:boolean}[];
 conclusionBridges:{statementId:string;conclusionId:number;relation:string;rationale:string;reviewStatus:ReviewStatus;isCurrent:boolean}[];
 paths:{id:string;title:string;introduction:string;limitations:string;reviewStatus:ReviewStatus;steps:{order:number;conceptId:string;statementId:string;viaMechanismId:string|null;caption:string}[]}[];
};
export function conceptsInCluster(bundle:EvidenceBundle,clusterId:string) {
 if(!clusterId||!bundle.reasoning) return bundle.concepts;
 const ids=new Set(bundle.reasoning.memberships.filter(m=>m.clusterId===clusterId&&m.reviewStatus!=='rejected').map(m=>m.conceptId));
 return bundle.concepts.filter(c=>ids.has(c.id));
}
// Validate public references before replacing the public snapshot. Older snapshots remain readable.
export function validateReasoning(bundle:EvidenceBundle,conclusionIds?:Set<number>) {
 const r=bundle.reasoning;if(!r)return;
 const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(`Invalid reasoning: ${message}`)};
 check(r.modelVersion===1,'model version');
 const conceptIds=new Set(bundle.concepts.map(c=>c.id)), observationIds=new Set(bundle.observations.map(o=>o.id));
 const sets={clusters:r.clusters,sources:r.sources,statements:r.statements,mechanisms:r.mechanisms,paths:r.paths,evidenceLinks:r.evidenceLinks};
 for(const [name,rows] of Object.entries(sets))check(new Set(rows.map(x=>x.id)).size===rows.length,`duplicate ${name}`);
 const clusters=new Set(r.clusters.map(c=>c.id)),sources=new Set(r.sources.map(s=>s.id)),statements=new Set(r.statements.map(s=>s.id));
 for(const m of r.memberships)check(conceptIds.has(m.conceptId)&&clusters.has(m.clusterId),'membership reference');
 for(const s of r.sources)check(/^https?:\/\//.test(s.url),'source URL');
 for(const s of r.observationSources)check(observationIds.has(s.observationId)&&sources.has(s.sourceId)&&s.isCurrent,'observation source reference');
 for(const s of r.statements)check((s.start===null&&s.end===null)||(s.start!==null&&s.end!==null&&s.start<=s.end),'statement interval');
 for(const c of r.statementConcepts)check(statements.has(c.statementId)&&conceptIds.has(c.conceptId),'statement concept reference');
 for(const e of r.evidenceLinks){check(observationIds.has(e.observationId)&&statements.has(e.statementId)&&e.isCurrent,'evidence reference');check(r.observationSources.some(x=>x.observationId===e.observationId&&x.isCurrent),'missing evidence source');check(!e.causalEffectIdentified||e.reviewStatus==='accepted','unreviewed causal evidence')}
 for(const s of r.statementRelations)check(statements.has(s.from)&&statements.has(s.to)&&s.from!==s.to&&s.isCurrent,'statement relation');
 for(const m of r.mechanisms){check(conceptIds.has(m.from)&&conceptIds.has(m.to)&&m.from!==m.to&&statements.has(m.statementId)&&m.isCurrent,'mechanism reference');check(m.basis!=='causal'||m.reviewStatus==='accepted','unreviewed causal mechanism')}
 for(const b of r.conclusionBridges)check(statements.has(b.statementId)&&b.isCurrent&&(!conclusionIds||conclusionIds.has(b.conclusionId)),'conclusion bridge');
 for(const p of r.paths){check(p.steps.length>0,'empty path');for(let i=0;i<p.steps.length;i++){
 const s=p.steps[i];check(s.order===i+1&&conceptIds.has(s.conceptId)&&statements.has(s.statementId),'path step');
 if(i===0)check(s.viaMechanismId===null,'first step mechanism');else{const m=r.mechanisms.find(m=>m.id===s.viaMechanismId);check(m&&m.from===p.steps[i-1].conceptId&&m.to===s.conceptId,'path continuity')}
 }}
}
