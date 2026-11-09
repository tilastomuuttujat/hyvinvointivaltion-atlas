import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildConceptMap,
  conceptObservations,
  fitMap,
  zoomMap,
  mapDepth,
  pathAvailability,
  observationPosition,
} from "../src/lib/atlas.concept-map.ts";
import { conceptUses, articleClusters } from "../src/lib/atlas.axes.ts";
const snapshot = JSON.parse(
  await readFile(new URL("../public/data/atlas.json", import.meta.url), "utf8"),
);
const data = { ...snapshot.atlas, evidence: snapshot.evidence };
test("map uses defined concepts once, preserving multiple memberships and measurement gaps", () => {
  const m = buildConceptMap(data, "field");
  assert.equal(m.regions.length, 4);
  assert.equal(m.concepts.length, 13);
  assert.equal(new Set(m.concepts.map((c) => c.id)).size, 13);
  assert.ok(m.concepts.some((c) => c.memberships.length > 1));
  assert.ok(m.concepts.find((c) => c.id === "benefit_non_take_up"));
  assert.equal(
    conceptObservations(
      data,
      m.concepts.find((c) => c.id === "benefit_non_take_up"),
      null,
    ).length,
    0,
  );
  const d = structuredClone(data);
  d.evidence.reasoning.memberships = [];
  assert.equal(
    buildConceptMap(d, "field").concepts.every(
      (c) => c.clusterId === "unassigned",
    ),
    true,
  );
});
test("rejected memberships and mechanisms cannot become map routes", () => {
  const d = structuredClone(data);
  d.evidence.reasoning.memberships.forEach(
    (m) => (m.reviewStatus = "rejected"),
  );
  d.evidence.reasoning.mechanisms.forEach((m) => (m.reviewStatus = "rejected"));
  const m = buildConceptMap(d, "field");
  assert.equal(m.mechanisms.length, 0);
  assert.equal(m.paths.length, 0);
  assert.ok(m.concepts.every((c) => c.clusterId === "unassigned"));
});
test("layouts are distinct and only explicit mechanisms connect concepts", () => {
  const m = buildConceptMap(data, "field"),
    r = buildConceptMap(data, "routes");
  assert.equal(m.mechanisms.length, 2);
  assert.equal(m.paths.length, 1);
  assert.notDeepEqual(
    m.concepts.map((c) => [c.x, c.y]),
    r.concepts.map((c) => [c.x, c.y]),
  );
  for (const edge of m.mechanisms)
    assert.ok(
      data.evidence.reasoning.mechanisms.some(
        (e) => e.id === edge.id && e.from === edge.from && e.to === edge.to,
      ),
    );
  const c = m.concepts.find((c) => c.id === "sustained_return_to_work");
  const finding = conceptObservations(data, c, null).find(
    (o) => o.kind === "research_finding",
  );
  assert.ok(finding);
  assert.ok(
    conceptObservations(data, c, "p6").some((o) => o.id === finding.id),
  );
  assert.ok(
    !conceptObservations(data, c, "p1").some((o) => o.id === finding.id),
  );
  assert.deepEqual(
    observationPosition(c, finding),
    observationPosition(c, finding),
  );
  assert.ok(
    pathAvailability(data, m, m.paths[0].id, "p1").some((s) => !s.available),
  );
  assert.ok(
    pathAvailability(data, m, m.paths[0].id, "p6").some(
      (s) => s.status === "undated",
    ),
  );
});
test("zoom anchors stay fixed, levels have hysteresis and magnification is bounded", () => {
  const c = fitMap(900, 600, 1600, 1000),
    a = { x: 321, y: 217 },
    z = zoomMap(c, 2, a, c.scale);
  assert.ok(Math.abs((a.x - c.x) / c.scale - (a.x - z.x) / z.scale) < 1e-8);
  assert.ok(Math.abs((a.y - c.y) / c.scale - (a.y - z.y) / z.scale) < 1e-8);
  assert.equal(zoomMap(c, 100, a, c.scale).scale, c.scale * 7);
  assert.equal(zoomMap(c, 0.001, a, c.scale).scale, c.scale * 0.65);
  assert.equal(mapDepth(1.36, 0), 0);
  assert.equal(mapDepth(1.36, 1), 1);
  assert.equal(mapDepth(4.5, 0), 3);
});
test("metric word and article groups exclude rejected references", () => {
  const d = {
    evidenceIndex: [
      {
        c: 1,
        p: "p1",
        articleNo: 9,
        concepts: ["test"],
        relation: "direct",
        reviewStatus: "rejected",
      },
    ],
  };
  assert.equal(conceptUses(d).size, 0);
  assert.equal(articleClusters(d, [1]).length, 0);
});
