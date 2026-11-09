import { useState } from 'react';
import type { EvidenceBundle } from '@/lib/atlas.evidence';
const kinds:Record<string,string>={empirical_claim:'Tutkimusta koskeva väite',hypothesis:'Hypoteesi',synthesis:'Rajattu synteesi',evaluation:'Arviointiperiaate',scenario:'Skenaario'};
const review=(s:string)=>s==='accepted'?'hyväksytty':s==='rejected'?'hylätty':'tarkistamatta';
const basis:Record<string,string>={quasi_experimental:'kvasikokeellinen tutkimus',interpretive:'tulkinnan arviointi',descriptive:'kuvaileva tieto',observational:'havainnoiva tutkimus',experimental:'kokeellinen tutkimus',review:'tutkimuskatsaus'};
const sourceCheck=(s:string)=>s.includes('retrieval_403')?'Aiemman lähdekortin tieto; alkuperäislähteen avaaminen estyi':s.includes('primary_outcome_and_methods_rechecked')?'Alkuperäislähteen tulos ja menetelmä tarkistettu':s.includes('inherited')?'Peritty lähdetieto; ei uutta lähdetarkistusta':s;
const relations:Record<string,string>={supports:'Tukee',challenges:'Haastaa',limits:'Rajaa',context_for:'Taustoittaa',assumption_for:'Edellytys'};
export function ReasoningTrail({bundle,conceptId}:{bundle:EvidenceBundle;conceptId:string}) {
 const [step,setStep]=useState(0);
 const r=bundle.reasoning;if(!r)return null;
 const path=r.paths.find(p=>p.steps.some(s=>s.conceptId===conceptId));
 const statements=r.statements.filter(s=>r.statementConcepts.some(c=>c.statementId===s.id&&c.conceptId===conceptId));
 if(!statements.length&&!path)return null;
 const active=path?.steps[Math.min(step,path.steps.length-1)];
 const mechanism=r.mechanisms.find(m=>m.id===active?.viaMechanismId);
 return <section className="space-y-3 border-y border-border py-4" aria-label="Väitteet ja selityspolku">
  {path&&<><p className="text-xs uppercase tracking-wide text-primary">Selityspolku · {path.reviewStatus==='accepted'?'hyväksytty':'toimituksellinen luonnos, tarkistamatta'}</p><h3 className="font-display text-xl">{path.title}</h3><p className="text-sm">{path.introduction}</p>
   <nav aria-label="Selityspolun vaiheet" className="flex flex-wrap items-center gap-2">{path.steps.map((s,i)=><button type="button" key={s.order} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)} className={`rounded px-3 py-2 text-sm border ${i===step?'border-primary text-primary':'border-border'}`}>{s.order}. {bundle.concepts.find(c=>c.id===s.conceptId)?.label}</button>)}</nav>
   <p aria-live="polite">{active?.caption}</p>
   {mechanism&&<div className="text-sm space-y-1"><p><strong>{mechanism.label}</strong> · {mechanism.basis==='association'?'Tutkimuksessa havaittu yhteys; mekanismi tulkittava erikseen':mechanism.basis==='hypothesized'?'Ehdotettu mekanismi':'Hyväksytty kausaalinen yhteys'}</p><p>{mechanism.explanation}</p><p>Ehdot: {mechanism.conditions}</p><p className="text-muted-foreground">{mechanism.limitations} Tarkistustila: {review(mechanism.reviewStatus)}</p></div>}
   <p className="text-sm text-muted-foreground">{path.limitations}</p></>}
  {statements.map(s=><details key={s.id} className="text-sm"><summary className="cursor-pointer py-2">{kinds[s.kind]}: {s.title} · {s.reviewStatus==='accepted'?'hyväksytty':'tarkistamatta'}</summary><div className="space-y-2 pl-3"><p>{s.text}</p><p>Soveltamisala: {s.scope}</p><p>Ehdot: {s.conditions}</p><p className="text-muted-foreground">{s.limitations}</p>
   {r.evidenceLinks.filter(e=>e.statementId===s.id).map(e=>{const o=bundle.observations.find(o=>o.id===e.observationId);return <div key={e.id} className="border-l border-primary pl-3"><p><strong>{relations[e.relation]}</strong>: {e.rationale}</p><p>{o?.finding}</p><p>{e.applicability} {e.limitations}</p><p>Näytön arvio: {basis[e.assessmentBasis]||e.assessmentBasis} · {e.reviewStatus==='accepted'?'hyväksytty':'tarkistamatta'}. {e.causalEffectIdentified?'Kausaaliseksi arvioitu':'Ei hyväksyttyä kausaalipäätelmää.'}</p>{r.observationSources.filter(x=>x.observationId===e.observationId).map(x=>{const source=r.sources.find(z=>z.id===x.sourceId);return source&&<p key={source.id}><a href={source.url} target="_blank" rel="noreferrer" className="underline text-primary">{source.title}</a> · {x.locator}<br/>Lähteen tarkistus: {sourceCheck(source.verification)}{source.checkedOn?` (${source.checkedOn})`:""}; lähdekytkentä: {review(x.reviewStatus)}</p>})}</div>})}
   {r.statementRelations.filter(x=>x.to===s.id).map(x=><p key={x.from}>{relations[x.relation]}: {r.statements.find(a=>a.id===x.from)?.title}. {x.rationale} {x.limitations} ({review(x.reviewStatus)})</p>)}
   {r.conclusionBridges.filter(b=>b.statementId===s.id).map(b=><p key={b.conclusionId}>Yhteys päätelmään {b.conclusionId}: {relations[b.relation]}. {b.rationale} ({review(b.reviewStatus)})</p>)}
  </div></details>)}
 </section>;
}
