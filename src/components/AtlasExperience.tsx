import {ConclusionPicker,ComparisonNarrative} from './ConclusionComparison';
import {buildComparison} from '@/lib/atlas.comparison';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AtlasSphere } from './AtlasSphere';
import type { AtlasData } from '@/lib/atlas.functions';
import { ERA_STORIES } from '@/lib/atlas.insights';
import { relatedConnections } from '@/lib/atlas.relationships';
import { useQuery } from '@tanstack/react-query';
import { getTreatments } from '@/lib/atlas.static';
import { periodAt } from '@/lib/atlas.storylines';
import { conceptTrail, descend, initialNavigation, LEVELS, returnTo, stopLabel, validPaths, type Intent, type Navigation, type NavNode, type Stop } from '@/lib/atlas.navigation';
import { prepareInvestigation, zoomDepth, zoomForStop, type SurfaceNode } from '@/lib/atlas.investigation';
const QUESTIONS:{id:Intent;label:string}[]=[{id:'causes',label:'Mistä tämä johtuu?'},{id:'effects',label:'Mihin tämä vaikuttaa?'},{id:'evidence',label:'Mihin tieto perustuu?'}];
export function AtlasExperience({ data, active: visible=true }: { data: AtlasData; active?:boolean }) {
 const [selected,setSelected]=useState<number|null>(1),[period,setPeriod]=useState<string|null>('p1');
 const [story,setStory]=useState<number|null>(0),[lensOpen,setLensOpen]=useState(false),[year,setYear]=useState(1850);
 const [mapFocus,setMapFocus]=useState<{c:number;p:string;label:string;articles:number[]}|null>(null);
 const [navigation,setNavigation]=useState<Navigation>(initialNavigation),[depth,setDepth]=useState(0),[zoom,setZoom]=useState(1),[manual,setManual]=useState(false);
 const [includeUndated,setIncludeUndated]=useState(false),[allAreas,setAllAreas]=useState(false),[preview,setPreview]=useState<NavNode|null>(null),[listLimit,setListLimit]=useState(8);
 const [zoomRequest,setZoomRequest]=useState<{id:number;zoom:number;anchor?:{x:number;y:number};focus?:{c:number;p:string}}>();
 const [comparisonDraft,setComparisonDraft]=useState<number[]>([]),[comparisonIds,setComparisonIds]=useState<number[]>([]),[comparisonOn,setComparisonOn]=useState(false),[comparisonPicker,setComparisonPicker]=useState(false);
 const [comparisonPhase,setComparisonPhase]=useState(0),[comparisonPeriod,setComparisonPeriod]=useState<string|null>(null),[comparisonFocus,setComparisonFocus]=useState<{c?:number;pair?:string;p:string}|null>(null);
 const comparison=useMemo(()=>comparisonOn?buildComparison(data,comparisonIds,comparisonPeriod):null,[data,comparisonOn,comparisonIds,comparisonPeriod]);
 const comparisonSurface=useMemo(()=>comparison?{ids:comparison.ids,phase:comparisonPhase,periodId:comparisonPeriod,links:comparison.links}:undefined,[comparison,comparisonPhase,comparisonPeriod]);
 const closeComparison=useCallback(()=>setComparisonOn(false),[]);
 const comparePick=useCallback((c:number,p:string)=>setComparisonFocus({c,p}),[]);
 const kinds=useMemo(()=>new Set(data.conclusions.map(c=>c.kind)),[data]);
 const era=data.periods.find(p=>p.id===period),chapter=story==null?undefined:ERA_STORIES[story];
 const top=data.cells.filter(c=>c.p===period).sort((a,b)=>b.articles-a.articles)[0];
 const conclusion=data.conclusions.find(c=>c.id===(selected??chapter?.id??top?.c));
 const connections=conclusion?relatedConnections(data.evidenceIndex??[],conclusion.id).filter(c=>!period||c.p===period):[];
 const {data:treatments=[],isLoading:treatmentsLoading,error:treatmentsError}=useQuery({queryKey:['static-treatments',conclusion?.id],enabled:!!conclusion,queryFn:()=>conclusion?getTreatments({data:{conclusionId:conclusion.id}}):Promise.resolve([])});
 const shown=treatments.filter(t=>(!period||t.periodId===period)&&t.reviewStatus!=='rejected');
 const prepared=useMemo(()=>prepareInvestigation(data,navigation,depth,period,allAreas?null:selected,includeUndated),[data,navigation,depth,period,allAreas,selected,includeUndated]);
 const active=(manual||depth>0)&&!!prepared;
 const paths=useMemo(()=>data.evidence?validPaths(data.evidence):[],[data.evidence]);
 const reportZoom=useCallback((value:number)=>{setZoom(value);setDepth(previous=>zoomDepth(value,previous))},[]);
 const requestZoom=useCallback((value:number,anchor?:{x:number;y:number},focus?:{c:number;p:string})=>setZoomRequest(previous=>({id:(previous?.id??0)+1,zoom:value,anchor,focus})),[]);
 const move=useCallback((node:NavNode,anchor?:{x:number;y:number})=>{
  if(!node.stop)return;
  setNavigation(previous=>descend(previous,node.stop!));setManual(true);setPreview(null);setMapFocus(null);requestZoom(zoomForStop(node.stop),anchor);
 },[requestZoom]);
 const pickSurface=useCallback((node:SurfaceNode,anchor:{x:number;y:number})=>move(node,anchor),[move]);
 const goBack=(index:number)=>{const trail=prepared?.trail??navigation.trail;const next=returnTo({...navigation,trail},index);setNavigation(next);setManual(true);setPreview(null);requestZoom(zoomForStop(next.trail[next.trail.length-1]))};
 const changeTime=useCallback((nextPeriod:string|null,nextYear:number)=>{setPeriod(nextPeriod);setYear(nextYear);setStory(null);setMapFocus(null);setPreview(null)},[]);
 const chooseConclusion=useCallback((c:number,p:string)=>{const era=data.periods.find(x=>x.id===p);if(!era)return;setSelected(c);setNavigation(initialNavigation);setAllAreas(false);changeTime(p,era.end)},[data.periods,changeTime]);
 const chooseEra=useCallback((p:string)=>{const era=data.periods.find(x=>x.id===p);if(era)changeTime(p,era.start)},[data.periods,changeTime]);
 const clearConclusion=useCallback(()=>{setSelected(null);setStory(null);setMapFocus(null);setNavigation(initialNavigation)},[]);
 const investigationSurface=useMemo(()=>!comparisonOn&&active&&prepared?{nodes:prepared.surfaces,intent:navigation.intent,depth,missingRoot:prepared.missingRoot}:undefined,[active,prepared,navigation.intent,depth,comparisonOn]);
 const goStory=(index:number)=>{const p=data.periods[index],s=ERA_STORIES[index];if(!p||!s)return;if(comparisonOn){setComparisonPeriod(p.id);setComparisonFocus(null);return;}setStory(index);setPeriod(p.id);setYear(p.start);setSelected(s.id);setMapFocus(null);setPreview(null);setNavigation(initialNavigation);setAllAreas(false)};
 const pilot=()=>{setComparisonOn(false);
  const path=paths[0];if(!path||!data.evidence)return;
  const statementId=path.steps.find(s=>data.evidence?.reasoning?.conclusionBridges.some(b=>b.statementId===s.statementId&&b.isCurrent&&b.reviewStatus!=='rejected'))?.statementId;
  const bridge=data.evidence.reasoning?.conclusionBridges.find(b=>b.statementId===statementId&&b.isCurrent&&b.reviewStatus!=='rejected');
  const study=data.evidence.observations.find(o=>o.kind==='research_finding'&&o.start!=null);
  const p=study?.start!=null?periodAt(data.periods,study.start):undefined;
  if(!bridge||!p)return;
  setSelected(bridge.conclusionId);changeTime(p.id,study!.start!);setManual(true);setAllAreas(false);setNavigation({intent:'effects',trail:conceptTrail(data.evidence,path.steps[0].conceptId)});requestZoom(zoomForStop({level:'concept',conceptId:path.steps[0].conceptId}),undefined,{c:bridge.conclusionId,p:p.id});
 };
 const startComparison=()=>{if(comparisonDraft.length<2)return;setComparisonIds([...comparisonDraft]);setComparisonOn(true);setComparisonPhase(0);setComparisonFocus(null);setComparisonPicker(false)};
 const changeComparisonPeriod=(p:string|null)=>{setComparisonPeriod(p);setComparisonFocus(null)};
 const inspectComparison=(id:number)=>{const candidate=comparisonPeriod??comparisonFocus?.p??period;const p=data.cells.some(cell=>cell.c===id&&cell.p===candidate&&cell.direct+cell.context+cell.counter>0)?candidate!:comparison?.profiles.find(p=>p.conclusion.id===id)?.periodIds[0]??data.periods[0].id;setComparisonOn(false);setManual(false);chooseConclusion(id,p)};
 useEffect(()=>{setPreview(null);setListLimit(8)},[navigation,depth,period,includeUndated]);
 return <section className="atlas-experience" aria-label="Hyvinvointivaltion visuaalinen tutkimus">
  <div className="experience-toolbar"><div className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-2 text-sm text-primary"><BookOpen size={16}/>{comparison?"Vertaile päätelmiä":"Tarinakatsaus"}</span><Button size="sm" variant="default" aria-expanded={comparisonPicker} onClick={()=>setComparisonPicker(!comparisonPicker)}>Valitse vertailtavat päätelmät</Button><Button size="sm" variant="ghost" onClick={()=>{setComparisonOn(false);setManual(true);requestZoom(1.4)}}>Tutki selityksiä</Button>{paths.length>0&&<Button size="sm" variant="ghost" onClick={pilot}>Aloita lähteistetty esimerkkipolku</Button>}{!comparisonOn&&comparisonIds.length>1&&<Button size="sm" variant="ghost" onClick={()=>setComparisonOn(true)}>Palaa vertailuun</Button>}</div>
   {comparison?<label className="comparison-window">Vertailun aikaväli<select value={comparisonPeriod??''} onChange={e=>changeComparisonPeriod(e.target.value||null)} aria-label="Vertailun aikaväli"><option value="">Koko aikajana 1850–2050</option>{data.periods.map(p=><option value={p.id} key={p.id}>{p.label}</option>)}</select></label>:<label className="flex items-center gap-3 text-xs text-muted-foreground">Aikakone<input aria-label="Aikakone 1850–2050" className="w-40 accent-primary" type="range" min="1850" max="2050" value={year} onChange={e=>{const y=Number(e.target.value);changeTime(periodAt(data.periods,y)?.id??null,y)}}/><span className="w-8 text-primary tabular-nums">{year}</span></label>}
  </div>
  {comparisonPicker&&<ConclusionPicker data={data} ids={comparisonDraft} onChange={setComparisonDraft} onStart={startComparison} onClose={()=>setComparisonPicker(false)}/>}
  <div className="investigation-status"><span>Zoom {zoom.toFixed(2)}× · {comparison?'Päätelmien vertailu':prepared?.depthLabel??'Kokonaiskuva'}</span><span>Maaston korkeus kuvaa artikkelikytkentöjen tiheyttä, ei ilmiön voimakkuutta.</span></div>
  <div className="experience-field">
   <AtlasSphere paused={!visible} data={data} kinds={kinds} selected={comparison?null:selected} period={comparison?comparisonPeriod:period} showContext immersive scrubYear={comparison?undefined:year} onMapDetail={setMapFocus}
    onEra={chooseEra} onLensChange={setLensOpen}
    onPick={comparison?comparePick:chooseConclusion} onClear={comparison?closeComparison:clearConclusion} comparison={comparisonSurface} onComparisonFocus={setComparisonFocus}
    onZoomChange={reportZoom} zoomRequest={zoomRequest}
    investigation={investigationSurface}
    onInvestigationPick={pickSurface} onInvestigationPreview={setPreview}/>
   {!lensOpen&&<article className={`experience-hud ${comparison?'comparison-hud':active?'investigation-hud':''}`} aria-label={comparison?'Päätelmien vertailu':active?'Valitun kysymyksen selitys':'Aikakauden oivallus'}>
    {comparison?<ComparisonNarrative data={data} report={comparison} phase={comparisonPhase} onPhase={setComparisonPhase} onInspect={inspectComparison} onEdit={()=>setComparisonPicker(true)} onExit={closeComparison} onPeriod={changeComparisonPeriod} focus={comparisonFocus} editing={comparisonPicker}/>:<>
    <p className="experience-eyebrow">{era?.label??'1850–2050'} · {era&&era.start>=2026?'Mahdollinen tulevaisuus':'Historiallinen tarkastelu'}</p>
    {active&&prepared?<>
     <nav aria-label="Sijainti selityspolulla" className="investigation-breadcrumb">{prepared.trail.map((s,i)=><button type="button" key={JSON.stringify(s)} aria-current={i===prepared.trail.length-1?'page':undefined} onClick={()=>goBack(i)}>{stopLabel(s,data.evidence!)}</button>)}</nav>
     <div className="investigation-depths" aria-label="Tarkastelutasot">{Object.entries(LEVELS).map(([id,label])=><span key={id} aria-current={id===prepared.stop.level?'step':undefined}>{label}</span>)}</div>
     <h2>{prepared.scene.title}</h2><p className="experience-claim">{prepared.scene.question}</p>
     {prepared.stop.level==='concept'&&<div className="investigation-questions">{QUESTIONS.map(q=><Button size="sm" variant={navigation.intent===q.id?'default':'outline'} key={q.id} aria-pressed={navigation.intent===q.id} onClick={()=>setNavigation(previous=>({...previous,intent:q.id}))}>{q.label}</Button>)}</div>}
     <p className="investigation-summary">{prepared.scene.summary}</p>
     {preview&&<div className="investigation-preview" role="status"><strong>Miksi tämä näkyy?</strong><p>{preview.reason}</p></div>}
     <div className="investigation-notes">{prepared.scene.notes.filter(Boolean).map((note,i)=><p key={i}>{note}</p>)}</div>
     <div className="investigation-choices" aria-label="Seuraavat perustelut">{prepared.scene.nodes.slice(0,listLimit).map(node=><div key={node.id}>
      {node.href?<a href={node.href} target="_blank" rel="noreferrer">{node.label} ↗</a>:<Button variant="ghost" onFocus={()=>setPreview(node)} onMouseEnter={()=>setPreview(node)} onClick={()=>move(node)}>{node.label}<ArrowRight size={14}/></Button>}
      <small>{node.badge}{prepared.unmapped.some(n=>n.id===node.id)?' · ei aikapinnan sijoitusta':''}</small>
     </div>)}</div>
     {prepared.scene.nodes.length>listLimit&&<Button variant="ghost" size="sm" onClick={()=>setListLimit(listLimit+8)}>Näytä lisää ({prepared.scene.nodes.length-listLimit})</Button>}
     {prepared.missingRoot&&<Button size="sm" variant="outline" onClick={()=>setAllAreas(true)}>Näytä muu käsitteistö erillisenä</Button>}
     {period&&<label className="investigation-undated"><input type="checkbox" checked={includeUndated} onChange={e=>setIncludeUndated(e.target.checked)}/>Näytä epätarkasti ajoitetut erikseen</label>}
     {prepared.trail.length>1&&<Button size="sm" variant="outline" onClick={()=>goBack(prepared.trail.length-2)}>← Ylempi taso</Button>}
     <Button variant="ghost" size="sm" onClick={()=>{setManual(false);setNavigation(initialNavigation);setAllAreas(false);requestZoom(1)}}>Takaisin tarinakatsaukseen</Button>
    </>:<>
     {chapter&&<p className="experience-chapter">{chapter.title}</p>}<h2>{conclusion?.title??'Suomen hyvinvointivaltion kehitys'}</h2><p className="experience-claim">{conclusion?.claim}</p><p className="experience-caution">Toimituksellinen tulkinta · ei vahvistettu syy-yhteys</p>
     {!!connections.length&&<div className="experience-links"><span>Kirjatut asiayhteydet</span>{connections.slice(0,2).map(c=><Button key={`${c.c}:${c.p}`} variant="ghost" onClick={()=>chooseConclusion(c.c,c.p)}>{data.conclusions.find(x=>x.id===c.c)?.title}<ArrowRight/></Button>)}</div>}
     <details className="experience-limits"><summary>Rajaukset ja aineiston tila</summary><p>{conclusion?.limitations??'Aineiston kytkennät eivät osoita kausaalivaikutusta.'}</p></details>
     {story!=null&&<div className="experience-story-controls"><Button variant="outline" size="icon" aria-label="Edellinen murros" disabled={story===0} onClick={()=>goStory(story-1)}><ArrowLeft/></Button><span>{story+1} / {data.periods.length}</span><Button size="sm" disabled={story===data.periods.length-1} onClick={()=>goStory(story+1)}>Seuraava murros<ArrowRight/></Button></div>}
    </>}
    <details className="experience-limits article-evidence"><summary>Artikkelien perustelut ({shown.length})</summary>
     {treatmentsLoading&&<p>Ladataan artikkeliperusteluja…</p>}{treatmentsError&&<p>Artikkeliperusteluja ei saatu ladattua.</p>}
     {!treatmentsLoading&&!treatmentsError&&shown.length===0&&<p>Aineistoaukko: tälle jaksolle ei ole kirjattua artikkeliperustelua.</p>}
     {shown.map((t,i)=><section key={`${t.articleNo}:${t.periodId}:${t.relation}:${i}`} className="article-evidence-item"><h3>Artikkeli {t.articleNo}: {t.articleTitle}</h3><p>{t.treatment}</p><p>{t.evidence}</p><p>{t.limitations}</p><p>Tarkistus: {t.reviewStatus==='accepted'?'hyväksytty':'odottaa tarkistusta'} · {t.relation==='counterevidence'?'vastanäyttö':t.relation==='context'?'taustoittava':'suora kytkentä'}</p></section>)}
    </details>
    </>}
   </article>}
   {!comparison&&!lensOpen&&mapFocus&&!active&&<article className="map-selection" aria-label="Kartan kirjattu käsite"><div className="flex items-start justify-between gap-3"><h3>{mapFocus.label}</h3><Button size="icon" variant="ghost" aria-label="Sulje käsitetieto" onClick={()=>setMapFocus(null)}><X/></Button></div><p>{data.periods.find(p=>p.id===mapFocus.p)?.label} · {data.conclusions.find(c=>c.id===mapFocus.c)?.title}</p><p className="text-primary">Kirjatut artikkelit: {mapFocus.articles.join(', ')}</p><p>Artikkeliaineiston käsitemerkintä · eri sanasto kuin määritellyt avainkäsitteet</p></article>}
  </div>
  <nav className="experience-eras" aria-label="Historialliset murrokset">{data.periods.map((p,i)=><Button key={p.id} variant="ghost" aria-current={period===p.id?'step':undefined} onClick={()=>goStory(i)}><span>{p.label}</span><span>{ERA_STORIES[i]?.title}</span></Button>)}</nav>
 </section>;
}

