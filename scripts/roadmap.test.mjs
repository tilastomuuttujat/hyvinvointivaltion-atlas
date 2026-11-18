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
