import type { AtlasData } from "./atlas.functions";
import type { Observation } from "./atlas.evidence";
import { temporalStatus, validPaths } from "./atlas.navigation.ts";
export type MapLayout = "field" | "routes";
export type MapRegion = {
  id: string;
  label: string;
  question: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};
export type MapConcept = {
  id: string;
  label: string;
  definition: string;
  limitations: string;
  clusterId: string;
  memberships: string[];
  x: number;
  y: number;
  observationIds: string[];
};
export type MapMechanism = {
  id: string;
  from: string;
  to: string;
  label: string;
  explanation: string;
  conditions: string;
  limitations: string;
  basis: string;
  reviewStatus: string;
  statementId: string;
};
export type ConceptMapModel = {
  layout: MapLayout;
  width: number;
  height: number;
  regions: MapRegion[];
  concepts: MapConcept[];
  mechanisms: MapMechanism[];
  paths: ReturnType<typeof validPaths>;
};
const COLORS = [
  "var(--primary)",
  "var(--kind-hypo)",
  "var(--kind-principle)",
  "var(--kind-synth)",
];
export function buildConceptMap(
  data: AtlasData,
  layout: MapLayout,
): ConceptMapModel {
  const bundle = data.evidence,
    r = bundle?.reasoning;
  if (!bundle || !r)
    return {
      layout,
      width: 1600,
      height: 1000,
      regions: [],
      concepts: [],
      mechanisms: [],
      paths: [],
    };
  const clusters = r.clusters.filter((c) => c.reviewStatus !== "rejected");
  const membership = r.memberships.filter(
    (m) =>
      m.reviewStatus !== "rejected" &&
      clusters.some((c) => c.id === m.clusterId),
  );
  const home = (id: string) =>
    clusters.find((c) =>
      membership.some((m) => m.conceptId === id && m.clusterId === c.id),
    )?.id ?? "unassigned";
  const groups = [
    ...clusters,
    ...(bundle.concepts.some((c) => home(c.id) === "unassigned")
      ? [
          {
            id: "unassigned",
            label: "Klusteri määrittelemättä",
            question: "Ryhmittelyä ei ole kirjattu.",
          },
        ]
      : []),
  ];
  const regions: MapRegion[] = [],
    concepts: MapConcept[] = [];
  let rowY = 50,
    rowHeight = 0,
    maxWidth = 1600,
    maxHeight = 900;
  groups.forEach((group, index) => {
    const members = bundle.concepts
      .filter((c) => home(c.id) === group.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    let x: number, y: number, width: number, height: number;
    if (layout === "routes") {
      x = 40;
      y = 60 + index * 270;
      width = Math.max(1500, 320 + members.length * 240);
      height = 210;
    } else {
      if (index > 0 && index % 2 === 0) {
        rowY += rowHeight + 60;
        rowHeight = 0;
      }
      x = 40 + (index % 2) * 790;
      y = rowY;
      width = 740;
      height = Math.max(400, 140 + Math.ceil(members.length / 3) * 110);
      rowHeight = Math.max(rowHeight, height);
    }
    regions.push({
      id: group.id,
      label: group.label,
      question: group.question,
      x,
      y,
      width,
      height,
      color: COLORS[index % COLORS.length],
    });
    members.forEach((c, i) => {
      const ids = [
        ...new Set(
          bundle.links
            .filter(
              (l) =>
                l.conceptId === c.id &&
                l.reviewStatus !== "rejected" &&
                bundle.observations.some((o) => o.id === l.observationId),
            )
            .map((l) => l.observationId),
        ),
      ];
      concepts.push({
        ...c,
        clusterId: group.id,
        memberships: membership
          .filter((m) => m.conceptId === c.id)
          .map((m) => m.clusterId),
        x: layout === "routes" ? x + 260 + i * 230 : x + 130 + (i % 3) * 235,
        y: layout === "routes" ? y + 130 : y + 150 + Math.floor(i / 3) * 110,
        observationIds: ids,
      });
    });
    maxWidth = Math.max(maxWidth, x + width + 40);
    maxHeight = Math.max(maxHeight, y + height + 70);
  });
  const mechanisms = r.mechanisms.filter(
    (m) =>
      m.isCurrent &&
      m.reviewStatus !== "rejected" &&
      r.statements.some(
        (s) => s.id === m.statementId && s.reviewStatus !== "rejected",
      ) &&
      concepts.some((c) => c.id === m.from) &&
      concepts.some((c) => c.id === m.to),
  );
  return {
    layout,
    width: maxWidth,
    height: maxHeight,
    regions,
    concepts,
    mechanisms,
    paths: validPaths(bundle),
  };
}
export function conceptObservations(
  data: AtlasData,
  concept: MapConcept,
  periodId: string | null,
) {
  const window = data.periods.find((p) => p.id === periodId) ?? null;
  return (data.evidence?.observations ?? [])
    .filter(
      (o) =>
        concept.observationIds.includes(o.id) &&
        (!window || temporalStatus(o, window) === "inside"),
    )
    .sort(
      (a, b) =>
        Number(b.kind === "research_finding") -
          Number(a.kind === "research_finding") ||
        (b.start ?? -1) - (a.start ?? -1) ||
        a.id.localeCompare(b.id),
    );
}
export function mechanismStatus(
  data: AtlasData,
  mechanism: MapMechanism,
  periodId: string | null,
) {
  const statement = data.evidence?.reasoning?.statements.find(
    (s) => s.id === mechanism.statementId,
  );
  return statement
    ? temporalStatus(
        statement,
        data.periods.find((p) => p.id === periodId) ?? null,
      )
    : "outside";
}
export function observationPosition(
  concept: MapConcept,
  observation: Observation,
) {
  return localPosition(concept, observation.id, 210, 80);
}
export function localPosition(
  parent: { x: number; y: number },
  key: string,
  radius = 160,
  spread = 50,
) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const a = ((h % 360) * Math.PI) / 180,
    r = radius + ((h >>> 9) % spread);
  return { x: parent.x + Math.cos(a) * r, y: parent.y + Math.sin(a) * r };
}
export function pathAvailability(
  data: AtlasData,
  model: ConceptMapModel,
  pathId: string,
  periodId: string | null,
) {
  const path = model.paths.find((p) => p.id === pathId);
  if (!path) return [];
  return path.steps.map((step) => {
    const statement = data.evidence?.reasoning?.statements.find(
      (s) => s.id === step.statementId,
    );
    const mechanism = step.viaMechanismId
      ? model.mechanisms.find((m) => m.id === step.viaMechanismId)
      : undefined;
    const status = statement
      ? temporalStatus(
          statement,
          data.periods.find((p) => p.id === periodId) ?? null,
        )
      : "outside";
    const available =
      status !== "outside" &&
      (!step.viaMechanismId ||
        (!!mechanism &&
          mechanismStatus(data, mechanism, periodId) !== "outside"));
    return { ...step, status, available };
  });
}
export type MapCamera = { x: number; y: number; scale: number };
export function fitMap(
  width: number,
  height: number,
  worldWidth: number,
  worldHeight: number,
): MapCamera {
  const scale = Math.max(
    0.05,
    Math.min(width / worldWidth, height / worldHeight) * 0.92,
  );
  return {
    x: (width - worldWidth * scale) / 2,
    y: (height - worldHeight * scale) / 2,
    scale,
  };
}
export function zoomMap(
  camera: MapCamera,
  factor: number,
  anchor: { x: number; y: number },
  baseScale: number,
): MapCamera {
  const scale = Math.max(
      baseScale * 0.65,
      Math.min(baseScale * 7, camera.scale * factor),
    ),
    k = scale / camera.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - camera.x) * k,
    y: anchor.y - (anchor.y - camera.y) * k,
  };
}
export function mapDepth(zoom: number, previous = 0) {
  let d = previous;
  const thresholds = [1.35, 2.5, 3.9];
  while (d < 3 && zoom > thresholds[d] + 0.06) d++;
  while (d > 0 && zoom < thresholds[d - 1] - 0.06) d--;
  return d;
}
