import { test } from "node:test";
import assert from "node:assert/strict";
const { timeScale, lanes, routeOf } = await import("../src/lib/atlas.roadmap.ts");

test("time scale keeps route boundaries in order and endpoints fixed", () => {
  const x = timeScale(0, 1000);
  assert.equal(x(1500), 0);
  assert.equal(Math.round(x(2050)), 1000);
  const b = [1809, 1917, 1986, 2026].map(x);
  for (let i = 1; i < b.length; i++) assert.ok(b[i] > b[i - 1]);
});
test("overlapping streams get separate lanes", () => {
  assert.deepEqual(lanes([{ start: 1900, end: 1950 }, { start: 1920, end: 1930 }, { start: 1960, end: 1970 }]), [0, 1, 0]);
});
test("years belong to the right main route", () => {
  assert.equal(routeOf(1700), 1); assert.equal(routeOf(1809), 2); assert.equal(routeOf(1990), 4); assert.equal(routeOf(2030), 5);
});
test("dense station labels never overlap on the same side and tier", async () => {
  const { labelSlots } = await import("../src/lib/atlas.roadmap.ts");
  const items = [0, 20, 40, 60, 80, 100, 120].map((x) => ({ x, w: 150 }));
  const s = labelSlots(items);
  for (let i = 0; i < s.length; i++) for (let j = 0; j < i; j++)
    if (s[i].side === s[j].side && s[i].tier === s[j].tier) assert.ok(Math.abs(items[i].x - items[j].x) >= 162);
});
test("long station titles wrap to two lines", async () => {
  const { wrapLabel } = await import("../src/lib/atlas.roadmap.ts");
  assert.deepEqual(wrapLabel("säätyvaltiopäivät jälleen koolle"), ["säätyvaltiopäivät", "jälleen koolle"]);
});
test("stage context finds neighbours, gate and long-lasting lanes", async () => {
  const { stageContext } = await import("../src/lib/atlas.roadmap.ts");
  const m = { routes: [{ order: 3, id: "r", title: "R", start: 1917, end: 1986, kind: "x" }],
    boundaries: [{ from: 2, to: 3, year: 1917, title: "Itsenäisyys" }],
    stages: [{ route: 3, seq: 1, title: "A", start: 1920 }, { route: 3, seq: 2, title: "B", start: 1945, end: 1950 }, { route: 3, seq: 3, title: "C", start: 1960 }],
    chains: [{ id: "long", title: "L", start: 1940, end: 2000, routes: [3], learning: "x" }, { id: "short", title: "S", start: 1946, end: 1955, routes: [3] }, { id: "other", title: "O", start: 1946, end: 2000, routes: [4] }],
    intersections: [] };
  const c = stageContext(m, m.stages[1]);
  assert.equal(c.before.title, "A"); assert.equal(c.after.title, "C"); assert.equal(c.gate.year, 1917);
  assert.deepEqual(c.lanes.map((l) => l.id).sort(), ["long", "short"]);
  assert.deepEqual(c.lasting.map((l) => l.id), ["long"]);
});
