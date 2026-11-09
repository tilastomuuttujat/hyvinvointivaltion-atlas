import type { ReasoningBundle } from './atlas.reasoning';
export type Observation = { id:string; kind:'statistical'|'research_finding'; title:string; start:number|null; end:number|null; period?:string|null; temporalPrecision?:string; placementPeriod?:number[]; population:string; value?:number; unit?:string; valueKind?:string; finding?:string; design?:string; result?:{[key:string]:string|number|boolean|null|{[key:string]:number}}; limitations?:string; sourceUrl:string; sourceVersion?:string; publicationYear?:number; verification:string };
export type EvidenceBundle = {
 reasoning?:ReasoningBundle;
 concepts:{id:string;label:string;definition:string;limitations:string}[];
 observations:Observation[];
 links:{observationId:string;conceptId:string;relation:string;rationale:string;limitations:string;reviewStatus:string;verification:string}[];
 articleRefs:{observationId:string;articleNo:number;reviewStatus:string;isCurrent:boolean}[];
 withheld:number;
};
export function observationDate(o:Observation):string {
 if(o.period) return o.period;
 if(o.start!=null && o.end!=null) return o.start===o.end?String(o.start):`${o.start}–${o.end}`;
 return o.placementPeriod?.length ? `Arvioitu sijoittuminen ${o.placementPeriod.join('–')} (ei tarkka havaintojakso)` : 'Havaintojakso avoin';
}
export function conceptObservations(bundle:EvidenceBundle,id:string,kind='all') {
 const ids=new Set(bundle.links.filter(l=>l.conceptId===id && l.reviewStatus!=='rejected').map(l=>l.observationId));
 return bundle.observations.filter(o=>ids.has(o.id)&&(kind==='all'||o.kind===kind)).sort((a,b)=>(b.start??-1)-(a.start??-1)||a.id.localeCompare(b.id));
}

