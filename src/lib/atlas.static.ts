import {
  validatePublication,
  type PublicationBundle,
} from "./atlas.publication";
import type { ThemeCatalog } from "./teema.system";
import { validateThemeCatalog } from "./atlas.catalogue";
import type { EvidenceBundle } from "./atlas.evidence";
import type { AtlasData, Treatment } from "./atlas.functions";
export type { AtlasData, Conclusion } from "./atlas.functions";
import type { Roadmap } from "./atlas.roadmap";
type Snapshot = {
  roadmap?: Roadmap;
  publication?: PublicationBundle;
  themeCatalog?: ThemeCatalog;
  evidence?: EvidenceBundle;
  schemaVersion: number;
  generatedAt: string;
  reviewPolicy: string;
  atlas: AtlasData;
  treatments: (Treatment & { conclusionId: number; reviewStatus: string })[];
};
let pending: Promise<Snapshot> | undefined;
async function snapshot(): Promise<Snapshot> {
  if (!pending)
    pending = fetch(new URL("data/atlas.json", document.baseURI).href).then(
      async (response) => {
        if (!response.ok)
          throw new Error("Atlas-aineistoa ei saatu ladattua.");
        return (await response.json()) as Snapshot;
      },
    )
      .then(async (data: Snapshot) => {
        if (
          data.schemaVersion !== 1 ||
          !data.atlas?.periods?.length ||
          !Array.isArray(data.atlas.conclusions) ||
          !Array.isArray(data.atlas.cells) ||
          !Array.isArray(data.treatments)
        )
          throw new Error("Atlas-aineiston muoto on virheellinen.");
        if (data.publication)
          validatePublication(data.publication, {
            ...data.atlas,
            evidence: data.evidence,
            generatedAt: data.generatedAt,
          });
        if (
          data.themeCatalog?.generatedAt &&
          data.themeCatalog.generatedAt !== data.generatedAt
        )
          throw new Error("Aineistoversiot eivät vastaa toisiaan.");
        if (data.themeCatalog)
          validateThemeCatalog(data.themeCatalog, {
            ...data.atlas,
            evidence: data.evidence,
          });
        return data;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  return pending;
}
export async function getAtlas(): Promise<AtlasData> {
  const data = await snapshot();
  return {
    ...data.atlas,
    publication: data.publication,
    themeCatalog: data.themeCatalog,
    evidence: data.evidence,
    generatedAt: data.generatedAt,
    reviewPolicy: data.reviewPolicy,
    evidenceIndex: data.treatments.map((r) => ({
      c: r.conclusionId,
      p: r.periodId,
      articleNo: r.articleNo,
      concepts: r.concepts || [],
      relation: r.relation,
      reviewStatus: r.reviewStatus,
    })),
  };
}
export async function getTreatments({
  data,
}: {
  data: { conclusionId: number };
}): Promise<Treatment[]> {
  if (!Number.isInteger(data.conclusionId) || data.conclusionId < 1)
    throw new Error("Virheellinen päätelmä");
  return (await snapshot()).treatments.filter(
    (row) => row.conclusionId === data.conclusionId,
  );
}

export async function getRoadmap(): Promise<Roadmap | undefined> {
  return (await snapshot()).roadmap;
}
