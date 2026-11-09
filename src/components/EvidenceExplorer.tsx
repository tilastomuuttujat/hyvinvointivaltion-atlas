import { conceptsInCluster } from '@/lib/atlas.reasoning';
import { ReasoningTrail } from './ReasoningTrail';
import { useState } from 'react';
import { conceptObservations, observationDate, type EvidenceBundle } from '@/lib/atlas.evidence';
const relationLabel:Record<string,string>={measures:'Mittaa käsitettä',component_of:'Osatekijä',context_for:'Taustayhteys'};
export function EvidenceExplorer({bundle}:{bundle?:EvidenceBundle}) {
 const [open,setOpen]=useState(false),[concept,setConcept]=useState(''),[kind,setKind]=useState('all'),[limit,setLimit]=useState(12);
 const [cluster,setCluster]=useState('');
 const selected=bundle?.concepts.find(c=>c.id===concept);
 const rows=bundle&&selected?conceptObservations(bundle,selected.id,kind):[];
 return <section className="border-b border-border px-6 py-4 md:px-10">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="rounded border border-border px-4 py-2 text-sm">{open?'Sulje havaintoaineisto':'Tutki havaintoja avainkäsitteittäin'}</button>
  {open&&(!bundle?<p className="mt-4">Tämä aineistoversio ei sisällä havaintokerrosta.</p>:<div className="mt-5 space-y-4">
   <h2 className="font-display text-2xl">Mihin käsitteet perustuvat?</h2>
   <p className="max-w-3xl text-sm text-muted-foreground">{bundle.concepts.length} määriteltyä avainkäsitettä · {bundle.observations.length} julkaistavaa havaintoa · {bundle.withheld} havaintoa odottaa lähdetarkistusta eikä niiden arvoja julkaista. Tämä luettelo kattaa koko havaintoaineiston; pallon aikakausivalinta ei rajaa sitä.</p>
   <p className="max-w-3xl text-sm text-muted-foreground">Avainkäsitteet ovat oma määritelty sanastonsa. Pallon artikkeliteksteistä poimitut käsitteet eivät muodosta niihin automaattista kytkentää. Havaintokytkentä ei osoita syyvaikutusta.</p>
   <div className="flex flex-wrap gap-4">
    {bundle.reasoning&&<label className="text-sm">Käsiteklusteri<select className="ml-2 rounded border border-border bg-background p-2" value={cluster} onChange={e=>{setCluster(e.target.value);setConcept('');setLimit(12)}}><option value="">Kaikki klusterit</option>{bundle.reasoning.clusters.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
    <label className="text-sm">Avainkäsite<select className="ml-2 rounded border border-border bg-background p-2" value={concept} onChange={e=>{setConcept(e.target.value);setLimit(12)}}><option value="">Valitse käsite</option>{conceptsInCluster(bundle,cluster).map(c=><option key={c.id} value={c.id}>{c.label} ({conceptObservations(bundle,c.id).length})</option>)}</select></label>
    <label className="text-sm">Havaintotyyppi<select className="ml-2 rounded border border-border bg-background p-2" value={kind} onChange={e=>{setKind(e.target.value);setLimit(12)}}><option value="all">Kaikki</option><option value="statistical">Tilastohavainnot</option><option value="research_finding">Tutkimustulokset</option></select></label>
   </div>
   {cluster&&<p className="text-sm text-muted-foreground">{bundle.reasoning?.clusters.find(c=>c.id===cluster)?.question} Ryhmittely on toimituksellinen, tarkistusta odottava. Sama käsite voi kuulua useaan ryhmään.</p>}
   {selected&&<><h3 className="font-display text-xl">{selected.label}</h3><p>{selected.definition}</p><p className="text-sm text-muted-foreground">{selected.limitations}</p><p role="status" className="text-sm">{rows.length} havaintoa valituilla rajauksilla. {bundle.links.filter(l=>l.conceptId===selected.id&&l.relation==='measures').length} suoraa mittauskytkentää koko aineistossa.</p>{!rows.length&&<p>Havaintoaukko: tällä rajauksella ei ole julkaistavaa havaintoa. Käsitteen määrittely ei vielä tarkoita sen mittaamista.</p>}</>}
   {selected&&<ReasoningTrail key={selected.id} bundle={bundle} conceptId={selected.id}/>}
   <div className="grid gap-4 xl:grid-cols-2">{rows.slice(0,limit).map(o=><article key={o.id} className="rounded-lg border border-border p-4 space-y-2">
    <p className="text-xs uppercase tracking-wide text-primary">{o.kind==='statistical'?'Tilastohavainto':'Tutkimustulos'} · {observationDate(o)}</p>
    <h4 className="font-semibold">{o.title}</h4><p className="text-sm">{o.population}</p>
    {o.kind==='statistical'?<p className="text-xl">{Number(o.value).toLocaleString('fi-FI')} {o.unit} <span className="text-xs">({o.valueKind==='estimate'?'estimaatti':o.valueKind==='observed'?'havaittu':o.valueKind})</span></p>:<><p>{o.finding}</p><p className="text-sm">Tutkimusasetelma: {o.design}</p><p className="text-sm">Julkaistu {o.publicationYear}; julkaisuvuosi ei ole havaintovuosi.</p></>}
    {bundle.links.filter(l=>l.observationId===o.id&&l.conceptId===concept).map(l=><div key={l.relation} className="border-l-2 border-border pl-3 text-sm"><p>{relationLabel[l.relation]||l.relation} · Tarkistustila: {l.reviewStatus}</p><p>{l.rationale}</p><p className="text-muted-foreground">{l.limitations}</p></div>)}
    {o.limitations&&<p className="text-sm text-muted-foreground">{o.limitations}</p>}
    <p className="text-xs break-words">Lähteen tarkistus: {o.verification||'ei ilmoitettu'}{o.sourceVersion?` · Versio: ${o.sourceVersion}`:''}</p>
    {/^https?:\/\//.test(o.sourceUrl)&&<a className="text-sm underline text-primary" href={o.sourceUrl} target="_blank" rel="noreferrer">Avaa lähde</a>}
    {bundle.articleRefs.filter(r=>r.observationId===o.id).map((r,i)=><p key={i} className="text-xs text-muted-foreground">Lähdekorttiviite: artikkeli {r.articleNo} · {r.reviewStatus==='accepted'?'hyväksytty':'tarkistamatta'} · {r.isCurrent?'nykyiseen revisioon':'ei vahvistettu nykyiseen artikkelirevisioon'}. Viite ei ole päätelmän näyttökytkentä.</p>)}
   </article>)}</div>
   {rows.length>limit&&<button type="button" className="rounded border border-border px-4 py-2" onClick={()=>setLimit(limit+12)}>Näytä seuraavat 12</button>}
  </div>)}
 </section>;
}

