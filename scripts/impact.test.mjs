import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildImpactGraph,
  impactNeighborhood,
  impactCurve,
  fitImpact,
} from "../src/lib/atlas.impact.ts";
const data = JSON.parse(
  readFileSync(new URL("../public/data/atlas.json", import.meta.url)),
);
test("impact map retains all concepts, stable positions and only current recorded mechanisms", () => {
  const g = buildImpactGraph(data),
    again = buildImpactGraph(data);
  assert.equal(g.nodes.length, data.evidence.concepts.length);
  assert.deepEqual(g, again);
  for (const n of g.nodes)
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
  for (const m of g.edges) {
    assert.ok(m.isCurrent);
    assert.notEqual(m.reviewStatus, "rejected");
    assert.ok(impactCurve(g, m).d.startsWith("M"));
  }
  assert.ok(g.nodes.some((n) => !n.connected));
});
test("directed drilldown retains route history and never skips intervening steps", () => {
  const g = buildImpactGraph(data),
    m = g.edges.find((m) => m.from !== m.to);
  const effects = impactNeighborhood(g, m.from, [], "effects", 1);
  assert.equal(effects.distance.get(m.to), 1);
  const causes = impactNeighborhood(g, m.to, [], "causes", 1);
  assert.equal(causes.distance.get(m.from), 1);
  const selected = [{ id: m.from }, { id: m.to, via: m.id }];
  const scoped = impactNeighborhood(
    g,
    m.to,
    selected,
    "effects",
    3,
    new Set([m.id]),
  );
  assert.ok(scoped.nodes.has(m.from));
  assert.ok(scoped.edges.has(m.id));
  const blocked = impactNeighborhood(
    g,
    m.from,
    [],
    "effects",
    1,
    new Set(g.edges.map((e) => e.id)),
  );
  assert.equal(blocked.nodes.size, 1);
  assert.equal(blocked.edges.size, 0);
});
test("rejected statements and stale mechanisms cannot create visible causal links", () => {
  const copy = structuredClone(data),
    m = copy.evidence.reasoning.mechanisms[0];
  m.isCurrent = false;
  assert.ok(!buildImpactGraph(copy).edges.some((e) => e.id === m.id));
  m.isCurrent = true;
  copy.evidence.reasoning.statements.find(
    (s) => s.id === m.statementId,
  ).reviewStatus = "rejected";
  assert.ok(!buildImpactGraph(copy).edges.some((e) => e.id === m.id));
});
test("camera fitting preserves aspect ratio and includes requested context", () => {
  const pts = [
      { x: -200, y: 50 },
      { x: 800, y: 1000 },
    ],
    c = fitImpact(pts, 2);
  assert.equal(c.width / c.height, 2);
  for (const p of pts)
    assert.ok(
      p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height,
    );
});
