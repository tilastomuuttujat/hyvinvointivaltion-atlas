import type { EvidenceBundle, Observation } from './atlas.evidence';
import type { ReasoningBundle, Statement } from './atlas.reasoning';
export type Window = {start:number;end:number};
export type Intent = 'causes'|'effects'|'evidence';
export type Stop = {level:'overview'}|{level:'domain';clusterId:string}|{level:'concept';conceptId:string}|{level:'explanation';statementId:string;mechanismId?:string}|{level:'observation';observationId:string}|{level:'source';sourceId:string;observationId:string};
export type Navigation = {trail:Stop[];intent:Intent};
export const initialNavigation:Navigation={trail:[{level:'overview'}],intent:'effects'};
export const LEVELS={overview:'Kokonaiskuva',domain:'Ilmiöalue',concept:'Avainkäsite',explanation:'Selitys',observation:'Havainto',source:'Lähde'};
export function descend(state:Navigation,stop:Stop):Navigation {const seen=state.trail.findIndex(s=>JSON.stringify(s)===JSON.stringify(stop));return {...state,trail:seen<0?[...state.trail,stop]:state.trail.slice(0,seen+1)}}
export function returnTo(state:Navigation,index:number):Navigation {return {...state,trail:state.trail.slice(0,Math.max(0,index)+1)}}
export function temporalStatus(o:{start:number|null;end:number|null},period:Window|null):'inside'|'outside'|'undated' {
 if(o.start==null||o.end==null)return 'undated';
 return !period||o.start<=period.end&&o.end>=period.start?'inside':'outside';
}
export function observationVisible(o:Observation,period:Window|null,includeUndated=false) {
 const status=temporalStatus(o,period);return status==='inside'||status==='undated'&&(!period||includeUndated);
}
export function observationsFor(bundle:EvidenceBundle,conceptId:string,period:Window|null,includeUndated=false) {
 const ids=new Set(bundle.links.filter(l=>l.conceptId===conceptId&&l.reviewStatus!=='rejected').map(l=>l.observationId));
 return bundle.observations.filter(o=>ids.has(o.id)&&observationVisible(o,period,includeUndated)).sort((a,b)=>(b.start??-1)-(a.start??-1)||a.id.localeCompare(b.id));
}
export function evidenceFor(bundle:EvidenceBundle,statementId:string,period:Window|null,includeUndated=false) {
 return (bundle.reasoning?.evidenceLinks??[]).filter(e=>e.statementId===statementId&&e.isCurrent&&e.reviewStatus!=='rejected'&&bundle.observations.some(o=>o.id===e.observationId&&observationVisible(o,period,includeUndated)));
}
export function statementVisible(s:Statement,period:Window|null) {return s.reviewStatus!=='rejected'&&temporalStatus(s,period)!=='outside'}
export function mechanismsFor(bundle:EvidenceBundle,conceptId:string,intent:Intent,period:Window|null) {
 const r=bundle.reasoning;if(!r||intent==='evidence')return [];
 return r.mechanisms.filter(m=>m.isCurrent&&m.reviewStatus!=='rejected'&&(intent==='causes'?m.to===conceptId:m.from===conceptId)&&r.statements.some(s=>s.id===m.statementId&&statementVisible(s,period)))
 .sort((a,b)=>{
  const sa=r.statements.find(s=>s.id===a.statementId)!,sb=r.statements.find(s=>s.id===b.statementId)!;
  // Temporal relevance and review state only; node size/count is never impact strength.
  return Number(temporalStatus(sa,period)==='undated')-Number(temporalStatus(sb,period)==='undated')||Number(b.reviewStatus==='accepted')-Number(a.reviewStatus==='accepted')||a.id.localeCompare(b.id);
 });
}
export function sourceRefsFor(bundle:EvidenceBundle,observationId:string) {
 return (bundle.reasoning?.observationSources??[]).filter(x=>x.observationId===observationId&&x.isCurrent&&x.reviewStatus!=='rejected'&&bundle.reasoning?.sources.some(s=>s.id===x.sourceId));
}
export function conceptTrail(bundle:EvidenceBundle,conceptId:string,preferredCluster?:string):Stop[] {
 const r=bundle.reasoning;const memberships=r?.memberships.filter(m=>m.conceptId===conceptId&&m.reviewStatus!=='rejected'&&r.clusters.some(c=>c.id===m.clusterId&&c.reviewStatus!=='rejected'))??[];
 const cluster=memberships.find(m=>m.clusterId===preferredCluster)??memberships[0];
 return [{level:'overview'},...(cluster?[{level:'domain' as const,clusterId:cluster.clusterId}]:[]),{level:'concept',conceptId}];
}
export function stopLabel(stop:Stop,bundle:EvidenceBundle) {
 const r=bundle.reasoning;
 switch(stop.level){
 case 'overview':return 'Kokonaiskuva';
 case 'domain':return r?.clusters.find(c=>c.id===stop.clusterId)?.label??'Ilmiöalue';
 case 'concept':return bundle.concepts.find(c=>c.id===stop.conceptId)?.label??'Avainkäsite';
 case 'explanation':return r?.statements.find(s=>s.id===stop.statementId)?.title??'Selitys';
 case 'observation':return 'Havainto';
 case 'source':return 'Alkuperäislähde';
 }
}
export const relationLabel:Record<string,string>={supports:'Tukee',challenges:'Haastaa',limits:'Rajaa',context_for:'Taustoittaa',assumption_for:'Edellytys',measures:'Mittaa käsitettä',component_of:'Osatekijä'};
export const reviewLabel=(s:string)=>s==='accepted'?'hyväksytty':s==='rejected'?'hylätty':'tarkistamatta';
export function sourceCheck(s:string) {return s.includes('retrieval_403')?'Alkuperäislähteen avaaminen estyi; tieto on peritty lähdekortista':s.includes('primary_outcome_and_methods_rechecked')?'Alkuperäislähteen tulos ja menetelmä tarkistettu':s.includes('inherited')?'Peritty lähdetieto; ei uutta lähdetarkistusta':s||'Tarkistustietoa ei ole ilmoitettu'}
export function validPaths(bundle:EvidenceBundle):ReasoningBundle['paths'] {
 const r=bundle.reasoning;if(!r)return [];
 return r.paths.filter(p=>p.reviewStatus!=='rejected'&&p.steps.length>0&&p.steps.every((s,i)=>s.order===i+1&&bundle.concepts.some(c=>c.id===s.conceptId)&&r.statements.some(c=>c.id===s.statementId&&c.reviewStatus!=='rejected')&&(i===0?s.viaMechanismId===null:r.mechanisms.some(m=>m.id===s.viaMechanismId&&m.isCurrent&&m.reviewStatus!=='rejected'&&m.from===p.steps[i-1].conceptId&&m.to===s.conceptId))));
}
export type NavNode={id:string;label:string;kind:'cluster'|'concept'|'mechanism'|'evidence'|'statement'|'source';reason:string;badge:string;stop?:Stop;href?:string;basis?:string;relation?:string};
export type Scene={title:string;question:string;summary:string;nodes:NavNode[];notes:string[];anchor?:string};
export function sceneFor(bundle:EvidenceBundle,stop:Stop,intent:Intent,period:Window|null,includeUndated=false):Scene {
 const r=bundle.reasoning;
 const scene:Scene={title:stopLabel(stop,bundle),question:'Mitä tässä tarkastellaan?',summary:'',nodes:[],notes:[]};
 if(!r){scene.summary='Tämä aineistoversio ei sisällä selitysrakennetta.';return scene;}
 const name=(id:string)=>bundle.concepts.find(c=>c.id===id)?.label??id;
 const date=(o:Observation)=>o.period||((o.start!=null&&o.end!=null)?o.start===o.end?String(o.start):`${o.start}–${o.end}`:'Epätarkka havaintojakso');
 const obsLabel=(o:Observation)=>o.kind==='research_finding'?'Tutkimustulos':`${Number(o.value).toLocaleString('fi-FI')} ${o.unit}`;
 const obsReason=(o:Observation)=>`${date(o)} · ${o.population}. ${o.finding||o.title}`;
 const statementNode=(s:Statement,reason:string):NavNode=>({id:`statement:${s.id}`,label:s.title,kind:'statement',badge:`${s.kind==='hypothesis'?'Hypoteesi':s.kind==='synthesis'?'Synteesi':'Väite'} · ${reviewLabel(s.reviewStatus)}`,reason,stop:{level:'explanation',statementId:s.id}});
 if(stop.level==='overview'){
  scene.title='Yhteiskunta avautuu tasoittain';scene.question='Mitä haluat ymmärtää?';
  scene.summary='Valitse ilmiöalue pallon pinnalta. Lähentyessäsi kysymys tarkentuu käsitteestä selitykseen ja sen perusteisiin.';
  scene.nodes=r.clusters.filter(c=>c.reviewStatus!=='rejected').map(c=>{
   const ids=new Set(r.memberships.filter(m=>m.clusterId===c.id&&m.reviewStatus!=='rejected').map(m=>m.conceptId));
   const observations=new Set([...ids].flatMap(id=>observationsFor(bundle,id,period,includeUndated).map(o=>o.id)));
   return {id:c.id,label:c.label,kind:'cluster',badge:`${ids.size} käsitettä · ${observations.size} havaintoa`,reason:`${c.question} ${c.definition} Ryhmittely on ${reviewLabel(c.reviewStatus)}.`,stop:{level:'domain',clusterId:c.id}};
  });
  scene.notes=['Kartta kattaa nykyisen havaintosanaston, ei vielä kaikkia artikkelien aiheita. Alueiden sijainti ja koko ovat navigointia, eivät mitattua yhteiskunnallista vaikutusta.'];
 }else if(stop.level==='domain'){
  const cluster=r.clusters.find(c=>c.id===stop.clusterId);scene.question=cluster?.question??'Mistä ilmiö koostuu?';scene.summary=cluster?.definition??'';
  const ids=new Set(r.memberships.filter(m=>m.clusterId===stop.clusterId&&m.reviewStatus!=='rejected').map(m=>m.conceptId));
  scene.nodes=bundle.concepts.filter(c=>ids.has(c.id)).map(c=>({id:c.id,label:c.label,kind:'concept',badge:`${observationsFor(bundle,c.id,period,includeUndated).length} havaintoa rajauksessa`,reason:`${c.definition} ${c.limitations}`,stop:{level:'concept',conceptId:c.id}}));
  scene.notes=['Sama käsite voi kuulua useaan ilmiöalueeseen. Ryhmäjäsenyys ei ole syy-yhteys.'];
 }else if(stop.level==='concept'){
  const concept=bundle.concepts.find(c=>c.id===stop.conceptId);scene.summary=concept?.definition??'';scene.anchor=concept?.label;
  scene.question=intent==='causes'?'Mistä tämä voi johtua?':intent==='effects'?'Mihin tämä voi vaikuttaa?':'Mihin tieto perustuu?';
  scene.notes=[concept?.limitations??''];
  if(intent==='evidence'){
   scene.nodes=observationsFor(bundle,stop.conceptId,period,includeUndated).map(o=>{
    const links=bundle.links.filter(l=>l.observationId===o.id&&l.conceptId===stop.conceptId&&l.reviewStatus!=='rejected');
    return {id:o.id,label:obsLabel(o),kind:'evidence',badge:date(o),reason:`${obsReason(o)} ${links.map(l=>`${relationLabel[l.relation]||l.relation}: ${l.rationale} (${reviewLabel(l.reviewStatus)}).`).join(' ')}`,stop:{level:'observation',observationId:o.id}};
   });
   if(period){const unknown=observationsFor(bundle,stop.conceptId,null).filter(o=>temporalStatus(o,period)==='undated').length;if(unknown)scene.notes.push(`${unknown} havaintoa on epätarkasti ajoitettu. Niitä ei sijoiteta automaattisesti valittuun aikakauteen.`)}
  }else{
   scene.nodes=mechanismsFor(bundle,stop.conceptId,intent,period).map(m=>{
    const s=r.statements.find(s=>s.id===m.statementId)!;
    return {id:m.id,label:name(intent==='causes'?m.from:m.to),kind:'mechanism',badge:m.basis==='causal'?'Kausaaliseksi arvioitu':m.basis==='association'?'Yhteys; mekanismi avoin':'Ehdotettu mekanismi',basis:m.basis,
    reason:`Näytetään, koska ${intent==='causes'?'yhteys suuntautuu valittuun käsitteeseen':'yhteys lähtee valitusta käsitteestä'}. ${m.explanation} Ehdot: ${m.conditions} ${m.limitations} Tulkinta: ${reviewLabel(m.reviewStatus)}.${temporalStatus(s,period)==='undated'?' Ajallinen soveltamisala on avoin.':''}`,
    stop:{level:'explanation',statementId:m.statementId,mechanismId:m.id}};
   });
   if(!scene.nodes.length)scene.notes.push('Valittuun suuntaan ei ole kirjattua mekanismia tässä aikarajauksessa. Mahdolliset muut väitteet liittyvät aiheeseen, mutta eivät osoita syytä tai seurausta.');
   // Associated claims are separately labelled; they are never drawn as causal arrows.
   const represented=new Set(scene.nodes.flatMap(n=>n.stop?.level==='explanation'?[n.stop.statementId]:[]));
   const ids=new Set(r.statementConcepts.filter(c=>c.conceptId===stop.conceptId).map(c=>c.statementId));
   scene.nodes.push(...r.statements.filter(s=>ids.has(s.id)&&!represented.has(s.id)&&statementVisible(s,period)).map(s=>statementNode(s,`Liittyy käsitteeseen kirjattuna väitteenä, ei osoitettuna ${intent==='causes'?'syynä':'seurauksena'}. ${s.text} ${s.limitations}`)));
   scene.notes.push('Nuoli kertoo ehdotetun vaikutussuunnan. Katkoviiva merkitsee, ettei tätä mekanismia ole hyväksytty kausaaliseksi selitykseksi.');
  }
  if(!scene.nodes.length)scene.notes.push(intent==='evidence'?'Havaintoaukko: valitulle käsitteelle ei ole tässä aikarajauksessa julkaistavaa havaintoa.':'Tähän suuntaan ja aikarajaukseen ei ole kirjattua selitystä. Voit tarkastaa havainnot tai vaihtaa kysymystä.');
 }else if(stop.level==='explanation'){
  const s=r.statements.find(s=>s.id===stop.statementId);scene.question='Mikä perustelee tämän selityksen?';
  if(!s){scene.summary='Väitettä ei löydy tästä aineistoversiosta.';return scene;}
  scene.summary=s.text;
  const m=r.mechanisms.find(m=>m.id===stop.mechanismId&&m.isCurrent&&m.reviewStatus!=='rejected');
  scene.notes=[`Tulkinta: ${reviewLabel(s.reviewStatus)}. Soveltamisala: ${s.scope}`,`Ehdot: ${s.conditions}`,s.limitations];
  if(m)scene.notes.unshift(`${m.label}: ${m.explanation} ${m.limitations}`);
  if(temporalStatus(s,period)==='outside')scene.notes.unshift('Valittu väite on nykyisen aikarajauksen ulkopuolella. Aikarajaus säilyy; sitä ei vaihdeta automaattisesti.');
  if(temporalStatus(s,period)==='undated')scene.notes.push('Väitteen ajallinen soveltamisala on avoin. Näkyvä väite ei tarkoita näyttöä juuri valitusta aikakaudesta.');
  scene.nodes=evidenceFor(bundle,s.id,period,includeUndated).map(e=>{
   const o=bundle.observations.find(o=>o.id===e.observationId)!;
   return {id:e.id,label:`${relationLabel[e.relation]}: ${obsLabel(o)}`,kind:'evidence',relation:e.relation,badge:`${date(o)} · ${reviewLabel(e.reviewStatus)}`,reason:`${e.rationale} ${e.applicability} ${e.limitations} ${obsReason(o)}`,stop:{level:'observation',observationId:o.id}};
  });
  scene.nodes.push(...r.statementRelations.filter(x=>x.to===s.id&&x.isCurrent&&x.reviewStatus!=='rejected').flatMap(x=>{
   const from=r.statements.find(y=>y.id===x.from&&statementVisible(y,period));return from?[{...statementNode(from,`${relationLabel[x.relation]}: ${x.rationale} ${x.limitations} (${reviewLabel(x.reviewStatus)}).`),relation:x.relation}]:[];
  }));
  if(!scene.nodes.length)scene.notes.push('Tälle väitteelle ei ole tässä rajauksessa nykyistä havaintonäyttöä tai kirjattua perustelua. Tämä on näytön aukko, ei väitteen kumoutuminen.');
 }else if(stop.level==='observation'){
  const o=bundle.observations.find(o=>o.id===stop.observationId);scene.question='Mitä havaittiin ja miten tieto tuotettiin?';
  if(!o){scene.summary='Havaintoa ei löydy julkaistusta aineistosta.';return scene;}
  scene.title=o.kind==='research_finding'?'Tutkimuksessa havaittu tulos':`${date(o)} · ${obsLabel(o)}`;
  scene.summary=o.finding||o.title;
  scene.notes=[`Havaintojakso: ${date(o)}. Kohderyhmä: ${o.population}.`,o.design?`Tutkimusasetelma: ${o.design}`:o.valueKind==='estimate'?'Luku on estimaatti.':'Tilastoluku; ei itsessään syyvaikutuksen mittaus.',o.limitations||'',sourceCheck(o.verification)];
  if(o.publicationYear)scene.notes.push(`Julkaisuvuosi ${o.publicationYear} on eri asia kuin havaintojakso.`);
  if(o.start==null&&o.placementPeriod?.length)scene.notes.push(`Arvioitu sijoittuminen ${o.placementPeriod.join('–')}; ei tarkka havaintojakso.`);
  if(temporalStatus(o,period)==='outside')scene.notes.unshift('Valittu havainto on aikarajauksen ulkopuolella. Voit palata tai muuttaa aikarajausta.');
  if(temporalStatus(o,period)==='undated')scene.notes.unshift('Havainnon tarkka ajoitus on avoin; sitä ei tulkita valitun aikakauden havainnoksi.');
  const contexts=r.evidenceLinks.filter(e=>e.observationId===o.id&&e.isCurrent&&e.reviewStatus!=='rejected');
  scene.notes.push(...contexts.map(e=>`${relationLabel[e.relation]} väitettä ”${r.statements.find(s=>s.id===e.statementId)?.title}”: ${e.rationale} ${e.limitations} (${reviewLabel(e.reviewStatus)}).`));
  scene.nodes=sourceRefsFor(bundle,o.id).map(ref=>{const source=r.sources.find(s=>s.id===ref.sourceId)!;return {id:source.id,label:source.title===source.url?'Tilaston alkuperäislähde':source.title,kind:'source',badge:`Lähdeviite · ${reviewLabel(ref.reviewStatus)}`,reason:`Lähdekohta: ${ref.locator}. ${sourceCheck(source.verification)}`,stop:{level:'source',sourceId:source.id,observationId:o.id}}});
  if(!scene.nodes.length)scene.notes.push('Nykyiseen lähdeversioon vahvistettu viite puuttuu. Havaintoa ei tästä syystä pidä käsitellä tarkistettuna näyttönä.');
 }else if(stop.level==='source'){
  const source=r.sources.find(s=>s.id===stop.sourceId),ref=sourceRefsFor(bundle,stop.observationId).find(x=>x.sourceId===stop.sourceId);scene.question='Mihin alkuperäiseen kohtaan tieto perustuu?';
  if(!source||!ref){scene.summary='Nykyistä lähdeviitettä ei löydy.';return scene;}
  scene.title=source.title===source.url?'Alkuperäinen tilastolähde':source.title;scene.summary=ref.locator;
  scene.notes=[sourceCheck(source.verification),`Lähdeviitteen tarkistus: ${reviewLabel(ref.reviewStatus)}.`,source.checkedOn?`Tarkistuspäivä: ${source.checkedOn}`:'Tarkistuspäivää ei ole kirjattu.',source.version?`Lähdeversio: ${source.version}`:'', 'Lähteen luotettavuus ja sen merkitys väitteelle arvioidaan erikseen.'];
  if(/^https?:\/\//.test(source.url))scene.nodes=[{id:source.id,label:'Avaa alkuperäislähde',kind:'source',badge:source.publicationYear?`Julkaistu ${source.publicationYear}`:'Lähdepalvelu',reason:source.url,href:source.url}];
 }
 return scene;
}
