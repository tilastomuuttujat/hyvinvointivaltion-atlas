import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  spotlightRoutes,
  orientationSpotlight,
} from "../src/lib/atlas.spotlight.ts";
const data = JSON.parse(
  readFileSync(new URL("../public/data/atlas.json", import.meta.url)),
);
test("visual previews follow only current directed mechanisms and bounded branching", () => {
  const routes = spotlightRoutes(data);
  assert.ok(routes.length > 1);
  for (const route of routes) {
    assert.ok(route.mechanisms.length <= 7);
    const reached = new Set([route.start]);
    for (const id of route.mechanisms) {
      const m = data.evidence.reasoning.mechanisms.find((m) => m.id === id);
      assert.ok(m.isCurrent);
      assert.notEqual(m.reviewStatus, "rejected");
      assert.ok(reached.has(m.from));
      reached.add(m.to);
    }
    assert.deepEqual([...reached], route.nodes);
  }
  const d = structuredClone(data);
  d.evidence.reasoning.mechanisms.forEach((m) => (m.isCurrent = false));
  assert.equal(spotlightRoutes(d).length, 0);
});
test("turning changes the foreground chain without selecting a reader path", () => {
  const routes = [
      { start: "a", nodes: ["a", "b"], mechanisms: ["m"] },
      { start: "b", nodes: ["b", "a"], mechanisms: ["n"] },
    ],
    graph = { nodes: [{ id: "K:a" }, { id: "K:b" }], edges: [] };
  assert.equal(
    orientationSpotlight(routes, graph, [
      { x: 0, y: 0, z: -100 },
      { x: 0, y: 0, z: 100 },
    ]).start,
    "a",
  );
  assert.equal(
    orientationSpotlight(
      routes,
      graph,
      [
        { x: 0, y: 0, z: 100 },
        { x: 0, y: 0, z: -100 },
      ],
      "a",
    ).start,
    "b",
  );
  assert.equal(
    orientationSpotlight(routes, graph, [
      { x: 0, y: 0, z: 100 },
      { x: 0, y: 0, z: 100 },
    ]),
    null,
  );
  const nearly = [
    { x: 10, y: 0, z: -100 },
    { x: 0, y: 0, z: -100 },
  ];
  assert.equal(orientationSpotlight(routes, graph, nearly, "a").start, "a");
});
