import { createServerFn } from "@tanstack/react-start";
import { neonQuery, neonUserError } from "./neon";

export type Period = { id: string; label: string; start: number; end: number; coverage: { A: number; K: number; S: number } };
export type Conclusion = { id: number; title: string; claim: string; kind: string; limitations: string | null };
export type Cell = { c: number; p: string; direct: number; context: number; counter: number; articles: number };
import type { EvidenceRef } from "./atlas.relationships";
export type AtlasData = { periods: Period[]; conclusions: Conclusion[]; cells: Cell[]; articleCount: number; generatedAt?: string; reviewPolicy?: string; evidenceIndex?: EvidenceRef[] };

export type Treatment = {
  articleNo: number; articleTitle: string; periodId: string; relation: string;
  concepts?: string[]; reviewStatus?: string; treatment: string | null; evidence: string | null; limitations: string | null;
};

// The server reader uses the same read-only, current-revision export as Pages.
import snapshotSql from "../../scripts/export-atlas.sql?raw";
type Snapshot = { atlas: AtlasData; generatedAt: string; reviewPolicy: string; treatments: (Treatment & { conclusionId: number })[] };
async function readSnapshot(): Promise<Snapshot> {
  try {
    const { rows } = await neonQuery<{ rows: { snapshot: Snapshot }[] }>(snapshotSql);
    if (!rows[0]?.snapshot) throw new Error("Empty Atlas snapshot");
    return rows[0].snapshot;
  } catch (err) { throw new Error(neonUserError(err).message); }
}
export const getAtlas = createServerFn({ method: "GET" }).handler(async (): Promise<AtlasData> => {
  const data = await readSnapshot();
  return { ...data.atlas, generatedAt: data.generatedAt, reviewPolicy: data.reviewPolicy,
    evidenceIndex: data.treatments.map(r=>({c:r.conclusionId,p:r.periodId,articleNo:r.articleNo,concepts:r.concepts || [],relation:r.relation,reviewStatus:r.reviewStatus})) };
});
export const getTreatments = createServerFn({ method: "GET" })
  .inputValidator((d: { conclusionId: number }) => {
    const id = Number(d?.conclusionId);
    if (!Number.isInteger(id) || id < 1) throw new Error("Virheellinen päätelmä");
    return { conclusionId: id };
  })
  .handler(async ({ data }): Promise<Treatment[]> => (await readSnapshot()).treatments.filter(row=>row.conclusionId===data.conclusionId));
