import type { ThemeCatalog } from './teema.system';
import type { EvidenceBundle } from './atlas.evidence';
import type { EvidenceRef } from './atlas.relationships';
import { createServerFn } from '@tanstack/react-start';
import { neonQuery,neonUserError } from './neon';
import snapshotSql from '../../scripts/export-atlas.sql?raw';
export type Period = { id: string; label: string; start: number; end: number; coverage: { A: number; K: number; S: number } };
export type Conclusion = { reviewStatus?:string; id: number; title: string; claim: string; kind: string; limitations: string | null };
export type Cell = { c: number; p: string; direct: number; context: number; counter: number; articles: number };
export type AtlasData = { themeCatalog?:ThemeCatalog; evidence?: EvidenceBundle | undefined; periods: Period[]; conclusions: Conclusion[]; cells: Cell[]; articleCount: number;
  evidenceIndex?: EvidenceRef[]; generatedAt?: string; reviewPolicy?: string };

export type Treatment = {
  articleNo: number; articleTitle: string; periodId: string; relation: string;
  treatment: string | null; evidence: string | null; limitations: string | null;
  concepts?: string[]; reviewStatus?: string;
};


type Snapshot={atlas:AtlasData;evidence?:EvidenceBundle;generatedAt:string;reviewPolicy:string;treatments:(Treatment&{conclusionId:number})[]};
// One canonical read-only query keeps server and public JSON revision/rejection policies identical.
async function readSnapshot():Promise<Snapshot>{
 try{const {rows}=await neonQuery<{rows:{snapshot:Snapshot}[]}>(snapshotSql);if(!rows[0]?.snapshot)throw new Error('Empty Atlas snapshot');return rows[0].snapshot;}
 catch(error){throw new Error(neonUserError(error).message)}
}
export const getAtlas=createServerFn({method:'GET'}).handler(async():Promise<AtlasData>=>{
 const s=await readSnapshot();return {...s.atlas,evidence:s.evidence,generatedAt:s.generatedAt,reviewPolicy:s.reviewPolicy,evidenceIndex:s.treatments.map(r=>({c:r.conclusionId,p:r.periodId,articleNo:r.articleNo,concepts:r.concepts??[],relation:r.relation,reviewStatus:r.reviewStatus}))};
});
export const getTreatments=createServerFn({method:'GET'}).inputValidator((d:{conclusionId:number})=>{
 const id=Number(d?.conclusionId);if(!Number.isInteger(id)||id<1)throw new Error('Virheellinen päätelmä');return {conclusionId:id};
}).handler(async({data}):Promise<Treatment[]> => (await readSnapshot()).treatments.filter(row=>row.conclusionId===data.conclusionId));

