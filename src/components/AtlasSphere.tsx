import { useMemo, useRef, useState } from 'react';
import type { AtlasData, Cell } from '../lib/atlas.functions';

type Relation = 'direct' | 'context' | 'counter';
const RELATIONS: { key: Relation; label: string; radius: number; color: string }[] = [
  { key: 'context', label: 'Taustoittava', radius: .77, color: 'var(--kind-hypo)' },
  { key: 'direct', label: 'Suora', radius: .96, color: 'var(--primary)' },
  { key: 'counter', label: 'Vastanäyttö', radius: 1.15, color: 'var(--warning)' },
];
type Props = {
  data: AtlasData; selected: number | null; period: string | null;
  kinds: Set<string>; showContext: boolean;
  onPick: (conclusion: number, period: string) => void; onClear: () => void;
};
// Longitude uses actual period midyears with a gap at 1850/2050.
// Latitude is a navigation order of conclusions, not a measured social hierarchy.
export function AtlasSphere({ data, selected, period, kinds, showContext, onPick, onClear }: Props) {
  const [yaw, setYaw] = useState(-.6), [pitch, setPitch] = useState(.2), [zoom, setZoom] = useState(1);
  const [hideOthers, setHideOthers] = useState(false);
  const [layer, setLayer] = useState('all');
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const order = useMemo(() => [...data.conclusions].sort((a,b) => a.kind.localeCompare(b.kind) || a.id-b.id), [data]);
  const selectedConclusion = data.conclusions.find(c => c.id === selected);
  const cells = data.cells.filter(cell => kinds.has(data.conclusions.find(c=>c.id===cell.c)?.kind || ''));
  const points = cells.flatMap(cell => RELATIONS.filter(rel => (showContext || rel.key!=='context') && (layer==='all'||layer===rel.key) && cell[rel.key]>0).map(rel=>({cell,rel,id:`${cell.c}:${cell.p}:${rel.key}`})));
  const max = Math.max(1, ...points.map(p => p.cell[p.rel.key]));
  function location(c: number, p: string, radius: number): [number,number,number] {
    const per = data.periods.find(x=>x.id===p)!;
    const angle = .25 + (((per.start+per.end)/2-1850)/200)*(Math.PI*2-.5);
    const latitude = -1.28 + order.findIndex(x=>x.id===c)/Math.max(1,order.length-1)*2.56;
    return [radius*Math.cos(latitude)*Math.sin(angle),radius*Math.sin(latitude),radius*Math.cos(latitude)*Math.cos(angle)];
  }
  function project(v: [number,number,number]) {
    const [x,y,z]=v, xx=x*Math.cos(yaw)+z*Math.sin(yaw), zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
    const yy=y*Math.cos(pitch)-zz*Math.sin(pitch), depth=y*Math.sin(pitch)+zz*Math.cos(pitch);
    const scale=220*zoom*3.8/(3.8-depth);
    return { x:340+xx*scale, y:300-yy*scale, z:depth };
  }
  const coords = (cell: Cell, r: number) => project(location(cell.c, cell.p, r));
  const plotted = points.map(p=>({...p,...coords(p.cell,p.rel.radius)})).sort((a,b)=>a.z-b.z);
  const focused = plotted.filter(p=>p.cell.c===selected);
  const hoverPoint = plotted.find(p=>p.id===hover);
  const path = (ps: {x:number;y:number}[]) => ps.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const steer = (dy: number, dp: number) => {setYaw(v=>v+dy);setPitch(v=>Math.max(-1.3,Math.min(1.3,v+dp)));};
  return <div className="w-full" data-testid="atlas-sphere">
    <div className="flex flex-wrap items-center gap-3 px-2 text-xs">
      <label>Kerros <select aria-label="Pallon kerros" className="ml-2 rounded border border-border bg-card p-2" value={layer} onChange={e=>setLayer(e.target.value)}><option value="all">Kaikki yhteystyypit</option>{RELATIONS.filter(r=>showContext||r.key!=='context').map(r=><option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={hideOthers} onChange={e=>setHideOthers(e.target.checked)} />Piilota muut pisteet</label>
      <button className="rounded border border-border px-3 py-2" onClick={()=>{setYaw(-.6);setPitch(.2);setZoom(1);}}>Palauta asento</button>
      <button className="rounded border border-border px-3 py-2" onClick={onClear} disabled={selected===null}>Näytä kokonaisuus</button>
    </div>
    <p className="mx-2 mt-3 text-xs text-muted-foreground" role="status">{selectedConclusion ? `Korostettu: ${selectedConclusion.title}. ${focused.length} pistettä nykyisessä rajauksessa; sama päätelmä eri aikakausina ja yhteystyypeissä.` : `${plotted.length} pistettä. Valitse piste tai päätelmä listasta avataksesi sen käsittelyt.`}</p>
    <svg viewBox="0 0 680 600" className="h-auto w-full touch-none rounded-lg" tabIndex={0} aria-label="Pyöritettävä Atlas-pallo. Nuolinäppäimet kiertävät, plus ja miinus zoomaavat. Esc poistaa valinnan. Pisteen voi valita myös alla olevasta valikosta."
      onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Escape'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')steer(-.1,0);if(e.key==='ArrowRight')steer(.1,0);if(e.key==='ArrowUp')steer(0,.1);if(e.key==='ArrowDown')steer(0,-.1);if(e.key==='+')setZoom(v=>Math.min(1.45,v+.1));if(e.key==='-')setZoom(v=>Math.max(.6,v-.1));if(e.key==='Escape')onClear();}}
      onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false};suppressClick.current=false;e.currentTarget.setPointerCapture?.(e.pointerId);}}
      onPointerMove={e=>{const d=drag.current;if(d){if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>5)d.moved=true;if(d.moved)steer((e.clientX-d.x)*.009,(e.clientY-d.y)*.009);d.x=e.clientX;d.y=e.clientY;}}}
      onPointerUp={e=>{const d=drag.current;suppressClick.current=!!d?.moved;drag.current=null;if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
        // Pointer capture retargets the click to the SVG; use a projected hit test.
        if(d&&!d.moved){const box=e.currentTarget.getBoundingClientRect(),x=(e.clientX-box.left)*680/box.width,y=(e.clientY-box.top)*600/box.height;const near=plotted.filter(p=>!hideOthers||selected===null||p.cell.c===selected).map(p=>({p,d:Math.hypot(p.x-x,p.y-y)})).filter(v=>v.d<12).sort((a,b)=>a.d-b.d||b.p.z-a.p.z)[0];if(near){onPick(near.p.cell.c,near.p.cell.p);suppressClick.current=true;}}}}
      onPointerCancel={()=>{drag.current=null;suppressClick.current=true;}}
      onPointerLeave={()=>setHover(null)}>
      <title>Atlas-pallo: aikakaudet, päätelmät ja kytkentöjen laji</title>
      <circle cx="340" cy="300" r={220*zoom} fill="var(--card)" opacity=".35" />
      <g fill="none" stroke="var(--border)" strokeWidth=".8" pointerEvents="none">
        {RELATIONS.filter(r=>(showContext||r.key!=='context')&&(layer==='all'||layer===r.key)).flatMap(rel=>[
          ...Array.from({length:9},(_,i)=>{const c=order[Math.round(i*(order.length-1)/8)];if(!c)return null;const points=Array.from({length:81},(_,n)=>{const angle=.25+n/80*(Math.PI*2-.5),latitude=-1.28+order.findIndex(x=>x.id===c.id)/Math.max(1,order.length-1)*2.56;return project([rel.radius*Math.cos(latitude)*Math.sin(angle),rel.radius*Math.sin(latitude),rel.radius*Math.cos(latitude)*Math.cos(angle)]);});return <path key={`${rel.key}:lat:${i}`} d={path(points)} opacity=".55" />;}),
          ...data.periods.map(p=><path key={`${rel.key}:${p.id}`} d={path(order.map(c=>project(location(c.id,p.id,rel.radius))))} opacity=".5" />)
        ])}
      </g>
      {data.periods.map(p=>{const v=project(location(order[0]?.id||1,p.id,1.27));return <text key={p.id} x={v.x} y={v.y} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)" pointerEvents="none">{p.label}</text>;})}
      {selected!==null&&RELATIONS.map(rel=>{const series=data.periods.map(p=>focused.find(x=>x.cell.p===p.id&&x.rel.key===rel.key));return series.slice(1).map((p,i)=>p&&series[i]?<path key={`${rel.key}:${i}`} d={path([series[i]!,p])} stroke={rel.color} strokeWidth="1.5" strokeDasharray="3 5" opacity=".6" fill="none" pointerEvents="none" />:null);})}
      {plotted.filter(p=>!hideOthers||selected===null||p.cell.c===selected).map(p=>{
        const active=selected===null||p.cell.c===selected, exact=p.cell.c===selected&&p.cell.p===period;
        const count=p.cell[p.rel.key], size=3+Math.sqrt(count/max)*4;
        const per=data.periods.find(x=>x.id===p.cell.p)!, c=data.conclusions.find(x=>x.id===p.cell.c)!;
        return <g key={p.id} opacity={active?(p.z<0?.62:1):.07}>
          <circle data-sphere-point={p.id} cx={p.x} cy={p.y} r={size+(exact?2:0)} fill={per.start>=2026?'var(--background)':p.rel.color} stroke={p.rel.color} strokeWidth={exact?2.5:1} onPointerEnter={()=>setHover(p.id)} onClick={()=>{if(!suppressClick.current)onPick(p.cell.c,p.cell.p);}} className="cursor-pointer"><title>{`${c.title} · ${per.label} · ${p.rel.label}: ${count} kytkentää`}</title></circle>
          {exact&&<circle cx={p.x} cy={p.y} r={size+6} fill="none" stroke="var(--foreground)" pointerEvents="none" />}
        </g>;
      })}
      {hoverPoint&&<g pointerEvents="none"><rect x="20" y="16" width="640" height="57" rx="8" fill="var(--popover)" stroke="var(--border)"/><text x="32" y="38" fontSize="12" fill="var(--foreground)">{data.conclusions.find(c=>c.id===hoverPoint.cell.c)?.title.slice(0,83)}</text><text x="32" y="58" fontSize="11" fill="var(--muted-foreground)">{data.periods.find(p=>p.id===hoverPoint.cell.p)?.label} · {hoverPoint.rel.label} · {hoverPoint.cell[hoverPoint.rel.key]} kytkentää</text></g>}
    </svg>
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-xs">
      <label>Zoom <input aria-label="Pallon zoom" type="range" min=".6" max="1.45" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))} /></label>
      <label className="flex max-w-full items-center gap-2">Valitse piste <select aria-label="Valitse pallon piste" className="min-w-0 max-w-[330px] rounded border border-border bg-card p-2" value="" onChange={e=>{const p=points.find(p=>p.id===e.target.value);if(p)onPick(p.cell.c,p.cell.p);}}><option value="">Päätelmä · aikakausi · yhteystyyppi</option>{points.map(p=><option key={p.id} value={p.id}>{p.cell.c} · {data.periods.find(x=>x.id===p.cell.p)?.label} · {p.rel.label} ({p.cell[p.rel.key]})</option>)}</select></label>
    </div>
    <p className="mx-2 mt-3 text-xs leading-relaxed text-muted-foreground">Vedä kiertääksesi. Pituusaste = aikakauden keskivuosi, leveysaste = päätelmien järjestys. Kerros ja väri = yhteystyyppi, pisteen koko = kytkentöjen määrä. Ontto piste = tulevaisuusjakson käsittely. Katkos erottaa aikajanan päät. Katkoviiva yhdistää saman päätelmän vierekkäisiä aikakausia; se ei osoita syy-yhteyttä. Puuttuva piste tarkoittaa puuttuvaa kytkentää tässä aineistossa. Säde ei kuvaa yhteiskunnallista poikkeamaa.</p>
  </div>;
}
