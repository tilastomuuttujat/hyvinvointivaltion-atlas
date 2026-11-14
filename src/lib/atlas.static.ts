import type { ThemeCatalog } from './teema.system';
import { validateThemeCatalog } from './atlas.catalogue';
import type { EvidenceBundle } from './atlas.evidence';
import type { AtlasData, Treatment } from './atlas.functions';
export type { AtlasData, Conclusion } from './atlas.functions';
type Snapshot = { themeCatalog?:ThemeCatalog; evidence?: EvidenceBundle; schemaVersion: number; generatedAt: string; reviewPolicy: string; atlas: AtlasData; treatments: (Treatment & { conclusionId: number; reviewStatus: string })[] };
let pending: Promise<Snapshot> | undefined;
async function snapshot(): Promise<Snapshot> {
  if (!pending) pending = fetch(`${import.meta.env.BASE_URL}data/atlas.json`).then(async response => {
    if (!response.ok) throw new Error('Atlas-aineistoa ei saatu ladattua.');
    const data: Snapshot = await response.json();
    if (data.schemaVersion !== 1 || !data.atlas?.periods?.length || !Array.isArray(data.atlas.conclusions) || !Array.isArray(data.atlas.cells) || !Array.isArray(data.treatments)) throw new Error('Atlas-aineiston muoto on virheellinen.');
    if (data.themeCatalog) validateThemeCatalog(data.themeCatalog, {...data.atlas,evidence:data.evidence});
    return data;
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
export async function getAtlas(): Promise<AtlasData> { const data = await snapshot(); return { ...data.atlas, themeCatalog:data.themeCatalog, evidence: data.evidence, generatedAt: data.generatedAt, reviewPolicy: data.reviewPolicy, evidenceIndex: data.treatments.map(r => ({ c: r.conclusionId, p: r.periodId, articleNo: r.articleNo, concepts: r.concepts || [], relation: r.relation, reviewStatus: r.reviewStatus })) }; }
export async function getTreatments({ data }: { data: { conclusionId: number } }): Promise<Treatment[]> {
  if (!Number.isInteger(data.conclusionId) || data.conclusionId < 1) throw new Error('Virheellinen päätelmä');
  return (await snapshot()).treatments.filter(row => row.conclusionId === data.conclusionId);
}

