import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AtlasData } from '@/lib/atlas.functions';
import { conceptTrail, descend, initialNavigation, LEVELS, returnTo, reviewLabel, sceneFor, stopLabel, validPaths, type Intent, type Navigation, type NavNode, type Stop } from '@/lib/atlas.navigation';
import '../styles/atlas-navigation.css';
const QUESTIONS:{id:Intent;label:string}[]=[{id:'causes',label:'Mistä tämä johtuu?'},{id:'effects',label:'Mihin tämä vaikuttaa?'},{id:'evidence',label:'Mihin tieto perustuu?'}];
const levels=Object.entries(LEVELS);
function wrap(text:string,width=25,max=3) {
 const lines:string[]=[];let line='';for(const word of text.split(/\s+/)){if((line+' '+word).trim().length>width&&line){lines.push(line);line=word}else line=(line+' '+word).trim();}if(line)lines.push(line);
 return lines.slice(0,max).map((l,i)=>i===max-1&&lines.length>max?l+'…':l);
}
function positions(n:number,anchor:boolean,compact=false) {
 if(compact&&n===2)return [{x:450,y:anchor?105:175},{x:450,y:anchor?470:410}];
 if(n===1)return [{x:450,y:anchor?130:280}];
 if(n===4&&!anchor)return [{x:315,y:195},{x:585,y:195},{x:315,y:405},{x:585,y:405}];
 return Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return {x:450+Math.cos(a)*205,y:300+Math.sin(a)*190}});
}
function Globe({nodes,anchor,intent,motion,compact,onPick,onPreview}:{nodes:NavNode[];anchor?:string;intent:Intent;motion:boolean;compact:boolean;onPick:(n:NavNode)=>void;onPreview:(n:NavNode|null)=>void}) {
 const id=useId().replace(/:/g,'');const points=positions(nodes.length,!!anchor,compact);
 const nodeClass=(n:NavNode)=>`semantic-node semantic-${n.kind}${n.relation==='challenges'||n.relation==='limits'?' semantic-caution':''}`;
 return <svg viewBox="160 0 580 620" className="semantic-globe" aria-label="Tasoittain avautuva käsitteellinen pallo" role="group" data-motion={motion} data-compact={compact}>
  <defs><radialGradient id={`${id}-ocean`} cx="35%" cy="28%" r="78%"><stop offset="0" stopColor="var(--muted)"/><stop offset=".65" stopColor="var(--background)"/><stop offset="1" stopColor="var(--space)"/></radialGradient><clipPath id={`${id}-surface`}><circle cx="450" cy="300" r="275"/></clipPath><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="var(--primary)"/></marker></defs>
  <circle cx="450" cy="300" r="275" fill={`url(#${id}-ocean)`} stroke="var(--border)" strokeWidth="2"/>
  <g opacity=".28" fill="none" stroke="var(--muted-foreground)" aria-hidden="true">
   {[90,170,230].map(rx=><ellipse key={rx} cx="450" cy="300" rx={rx} ry="273"/>)}
   {[-160,-80,0,80,160].map(y=><ellipse key={y} cx="450" cy={300+y} rx={Math.sqrt(275**2-y**2)} ry="30"/>)}
  </g>
  {anchor&&<g aria-hidden="true"><circle cx="450" cy="300" r="58" fill="var(--background)" stroke="var(--primary)"/>{wrap(anchor,17,3).map((s,i)=><text key={i} x="450" y={285+i*(compact?22:16)} textAnchor="middle" className="semantic-anchor">{s}</text>)}</g>}
  {nodes.map((n,i)=>{const p=points[i],lines=wrap(n.label,compact?20:n.kind==='cluster'?23:25),edge=anchor&&n.kind==='mechanism';
   const dx=p.x-450,dy=p.y-300,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
   const near={x:450+ux*62,y:300+uy*62},far={x:p.x-ux*23,y:p.y-uy*23};
   const start=intent==='causes'?far:near,end=intent==='causes'?near:far;
   const curve=`M${start.x} ${start.y} Q${(near.x+far.x)/2-uy*24} ${(near.y+far.y)/2+ux*24} ${end.x} ${end.y}`;
   return <g key={n.id} clipPath={n.kind==='cluster'?`url(#${id}-surface)`:undefined}>
   {edge&&<path d={curve} fill="none" stroke="var(--primary)" strokeOpacity=".65" strokeWidth="2" strokeDasharray={n.basis==='causal'?undefined:'5 7'} markerEnd={`url(#${id}-arrow)`} aria-hidden="true"/>}
   {n.href?<a href={n.href} target="_blank" rel="noreferrer" className={nodeClass(n)} aria-label={n.label} onFocus={()=>onPreview(n)} onMouseEnter={()=>onPreview(n)}><NodeGlyph node={n} x={p.x} y={p.y} lines={lines} compact={compact}/></a>:
   <g className={nodeClass(n)} role="button" tabIndex={0} aria-label={`${n.label} · ${n.badge}`} onClick={()=>onPick(n)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onPick(n)}}} onFocus={()=>onPreview(n)} onMouseEnter={()=>onPreview(n)}><title>{n.label} · {n.badge}</title><NodeGlyph node={n} x={p.x} y={p.y} lines={lines} compact={compact}/></g>}
  </g>})}
  {!nodes.length&&<g><circle cx="450" cy="295" r="16" fill="none" stroke="var(--muted-foreground)" strokeDasharray="4 5"/><text x="450" y="342" textAnchor="middle" className="semantic-node-badge">Tässä rajauksessa on aineistoaukko</text></g>}
  <text x="450" y="603" textAnchor="middle" className="semantic-map-note">Käsitteellinen kartta · sijainti ja koko eivät mittaa vaikutusta</text>
 </svg>;
}
function NodeGlyph({node:n,x,y,lines,compact}:{node:NavNode;x:number;y:number;lines:string[];compact:boolean}) {
 const cluster=n.kind==='cluster';return <g transform={`translate(${x} ${y})`}>
  {cluster?<path d="M-108-43 Q-120-12-106 20 L-82 49 Q-42 64-4 54 L50 63 Q101 47 112 13 L101-31 Q63-57 15-52 L-45-62Z" className="semantic-land"/>:<><circle r="34" className="semantic-hit"/><circle r="13" className="semantic-dot"/></>}
  {lines.map((line,i)=><text key={i} x="0" y={(cluster?-12:36)+i*(compact?25:17)} textAnchor="middle" className="semantic-node-label">{line}</text>)}
  <text x="0" y={(cluster?-12:36)+lines.length*(compact?25:17)+7} textAnchor="middle" className="semantic-node-badge">{n.badge}</text>
 </g>;
}
export function AtlasNavigator({data,navigation,onNavigate,period,onPeriod,onOpenConclusion}:{data:AtlasData;navigation:Navigation;onNavigate:(s:Navigation)=>void;period:string|null;onPeriod:(p:string|null)=>void;onOpenConclusion:(id:number)=>void}) {
 const bundle=data.evidence;
 const [page,setPage]=useState(0),[preview,setPreview]=useState<NavNode|null>(null),[includeUndated,setIncludeUndated]=useState(false);
 const [compact,setCompact]=useState(false);
 const [motion,setMotion]=useState(true),[reduced,setReduced]=useState(false),[pathId,setPathId]=useState(''),[pathStep,setPathStep]=useState(0),[playing,setPlaying]=useState(false);
 const title=useRef<HTMLHeadingElement>(null),focusAfterChange=useRef(false);
 const stop=navigation.trail[navigation.trail.length-1]??initialNavigation.trail[0];
 const window=data.periods.find(p=>p.id===period)??null;
 const scene=useMemo(()=>bundle?sceneFor(bundle,stop,navigation.intent,window,includeUndated):null,[bundle,stop,navigation.intent,window,includeUndated]);
 const paths=useMemo(()=>bundle?validPaths(bundle):[],[bundle]),path=paths.find(p=>p.id===pathId);
 const stageKey=JSON.stringify(stop)+navigation.intent+period+includeUndated;
 useEffect(()=>{setPage(0);setPreview(null);if(focusAfterChange.current){title.current?.focus({preventScroll:true});focusAfterChange.current=false}},[stageKey]);
 useEffect(()=>{const media=windowGlobal()?.matchMedia?.('(prefers-reduced-motion: reduce)');if(!media)return;const update=()=>{setReduced(media.matches);if(media.matches)setPlaying(false)};update();media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[]);
 useEffect(()=>{const media=windowGlobal()?.matchMedia?.('(max-width: 760px)');if(!media)return;const update=()=>{setCompact(media.matches);setPage(0)};update();media.addEventListener?.('change',update);return()=>media.removeEventListener?.('change',update)},[]);
 const go=(next:Navigation,focus=true)=>{setPlaying(false);focusAfterChange.current=focus;onNavigate(next)};
 const ancestor=navigation.trail.find(s=>s.level==='domain');
 const guideStep=(index:number,manual=true)=>{
  if(!bundle||!path)return;const target=path.steps[index];if(!target)return;
  if(manual)setPlaying(false);setPathStep(index);focusAfterChange.current=manual;
  onNavigate({intent:'effects',trail:conceptTrail(bundle,target.conceptId,ancestor?.level==='domain'?ancestor.clusterId:undefined)});
 };
 useEffect(()=>{
  if(!playing||!path||reduced||!motion)return;
  if(pathStep>=path.steps.length-1){setPlaying(false);return}
  const timer=setTimeout(()=>guideStep(pathStep+1,false),5000);return()=>clearTimeout(timer);
 },[playing,pathStep,path,navigation.trail,reduced,motion]);
 if(!bundle||!scene)return <p className="p-6">Tämä JSON-versio ei sisällä havaintosanastoa. Avaa Kytkentäpallo tarkastellaksesi artikkelien yhteyksiä.</p>;
 const pageSize=compact?2:6;
 const nodes=scene.nodes.slice(page*pageSize,page*pageSize+pageSize),pages=Math.ceil(scene.nodes.length/pageSize);
 const breadcrumb=(index:number)=>{if(index===0)setPathId('');go(returnTo(navigation,index))};
 const select=(n:NavNode)=>{if(n.stop)go(descend(navigation,n.stop))};
 return <section className="semantic-atlas" aria-label="Älykäs pallonavigointi" onKeyDown={e=>{if(e.key==='Escape'&&navigation.trail.length>1){e.preventDefault();breadcrumb(navigation.trail.length-2)}}}>
  <div className="semantic-toolbar">
   <label>Aikakausi<select aria-label="Pallon aikakausi" value={period??''} onChange={e=>{setPlaying(false);onPeriod(e.target.value||null)}}><option value="">Koko aikajana 1850–2050</option>{data.periods.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
   <label className="semantic-motion"><input type="checkbox" checked={motion&&!reduced} disabled={reduced} onChange={e=>{setMotion(e.target.checked);if(!e.target.checked)setPlaying(false)}}/>Liike{reduced?' pois laitteen asetuksella':''}</label>
  </div>
  <nav aria-label="Sijainti pallolla" className="semantic-breadcrumbs">{navigation.trail.map((s,i)=><span key={`${i}:${JSON.stringify(s)}`}><button type="button" aria-current={i===navigation.trail.length-1?'page':undefined} onClick={()=>breadcrumb(i)}>{stopLabel(s,bundle)}</button>{i<navigation.trail.length-1&&<span aria-hidden="true"> / </span>}</span>)}</nav>
  <div className="semantic-depth" aria-label={`Nykyinen taso: ${LEVELS[stop.level]}`}>{levels.map(([id,label],i)=><span key={id} aria-current={id===stop.level?'step':undefined}>{i+1}. {label}</span>)}</div>
  <div className="semantic-heading"><div><p className="semantic-question">{scene.question}</p><h2 ref={title} tabIndex={-1}>{scene.title}</h2></div><button type="button" disabled={navigation.trail.length<2} onClick={()=>breadcrumb(navigation.trail.length-2)}>← Ylempi taso</button></div>
  {stop.level==='concept'&&<div className="semantic-questions" aria-label="Tarkastelukysymys">{QUESTIONS.map(q=><button type="button" key={q.id} aria-pressed={navigation.intent===q.id} onClick={()=>go({...navigation,intent:q.id})}>{q.label}</button>)}</div>}
  <div className="semantic-stage" key={stageKey} data-motion={motion&&!reduced}>
   <Globe nodes={nodes} anchor={scene.anchor} intent={navigation.intent} motion={motion&&!reduced} compact={compact} onPick={select} onPreview={setPreview}/>
   <div className="semantic-narration">
    <p className="semantic-level-label">Taso {levels.findIndex(([id])=>id===stop.level)+1} · {LEVELS[stop.level]}{window?` · ${window.label}`:''}</p>
    <p className="semantic-summary">{scene.summary}</p>
    {preview&&<div className="semantic-relevance" role="status"><h3>Miksi tämä näkyy?</h3><p>{preview.reason}</p>{preview.stop&&<button type="button" onClick={()=>select(preview)}>Avaa {preview.kind==='cluster'?'ilmiöalue':preview.kind==='concept'?'käsite':preview.kind==='source'?'lähde':'perustelu'} →</button>}</div>}
    {!preview&&<p className="semantic-hint">{scene.nodes.length?'Valitse kohde pallolta. Kohdistamalla näet, miksi se liittyy kysymykseesi.':'Tietoa ei korvata arvauksella. Kokeile toista kysymystä tai aikarajausta.'}</p>}
    <div className="semantic-notes">{scene.notes.filter(Boolean).map((note,i)=><p key={i}>{note}</p>)}</div>
    {stop.level==='source'&&scene.nodes[0]?.href&&<a className="semantic-source-link" href={scene.nodes[0].href} target="_blank" rel="noreferrer">Avaa alkuperäislähde ↗</a>}
    {stop.level==='explanation'&&bundle.reasoning?.conclusionBridges.filter(b=>b.statementId===stop.statementId&&b.isCurrent&&b.reviewStatus!=='rejected').map(b=><button type="button" className="semantic-bridge" key={b.conclusionId} onClick={()=>onOpenConclusion(b.conclusionId)}>Vertaa päätelmään {b.conclusionId} · {b.relation==='context_for'?'taustayhteys':'kirjattu kytkentä'}, {reviewLabel(b.reviewStatus)} →</button>)}
   </div>
  </div>
  {pages>1&&<div className="semantic-pagination"><button type="button" disabled={page===0} onClick={()=>{setPage(page-1);setPreview(null)}}>← Edelliset</button><span>{page*pageSize+1}–{Math.min((page+1)*pageSize,scene.nodes.length)} / {scene.nodes.length} kohdetta</span><button type="button" disabled={page===pages-1} onClick={()=>{setPage(page+1);setPreview(null)}}>Seuraavat →</button></div>}
  {period&&<label className="semantic-undated"><input type="checkbox" checked={includeUndated} onChange={e=>{setPlaying(false);setIncludeUndated(e.target.checked)}}/>Näytä myös epätarkasti ajoitetut havainnot erikseen merkittyinä</label>}
  {!!paths.length&&<div className="semantic-guide">
   {!path?<><span>Ohjattu esimerkkipolku</span>{paths.map(p=><button type="button" key={p.id} onClick={()=>{setPathId(p.id);setPathStep(0);go({intent:'effects',trail:conceptTrail(bundle,p.steps[0].conceptId)})}}>{p.title} →</button>)}</>:<>
    <div><strong>{path.title}</strong><p aria-live="polite">Vaihe {pathStep+1}/{path.steps.length}: {path.steps[pathStep]?.caption}</p><p className="semantic-hint">{path.limitations}</p></div>
    <div className="semantic-guide-controls"><button type="button" disabled={pathStep===0} onClick={()=>guideStep(pathStep-1)}>← Edellinen vaihe</button><button type="button" disabled={reduced||!motion||pathStep===path.steps.length-1} aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?'Pysäytä':'Toista polku'}</button><button type="button" disabled={pathStep===path.steps.length-1} onClick={()=>guideStep(pathStep+1)}>Seuraava vaihe →</button><button type="button" onClick={()=>{setPlaying(false);setPathId('')}}>Sulje opastus</button></div>
   </>}
  </div>}
 </section>;
}
function windowGlobal(){return typeof globalThis.window==='undefined'?undefined:globalThis.window}
