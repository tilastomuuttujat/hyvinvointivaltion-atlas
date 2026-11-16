import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildReadingFrame,
  offerReading,
  tickReading,
  pauseReading,
  emptyReading,
  READING_TIMING as T,
} from "../src/lib/atlas.reading.ts";
const raw = JSON.parse(
    readFileSync(new URL("../public/data/atlas.json", import.meta.url)),
  ),
  data = { ...raw.atlas, evidence: raw.evidence, generatedAt: raw.generatedAt },
  history = JSON.parse(
    readFileSync(new URL("../src/content/history-wall.json", import.meta.url)),
  );
const themes = raw.themeCatalog.themes;
const frame = (key, count = 3) => ({
  key,
  title: key,
  note: "test",
  items: Array.from({ length: count }, (_, i) => ({
    id: String(i),
    kind: "concept",
    title: String(i),
    meaning: "meaning",
    context: "context",
    theme: "",
  })),
});
test("reading waits for stability, reveals one item at a time and holds before replacing", () => {
  let s = offerReading(emptyReading, frame("a"), 0);
  assert.equal(tickReading(s, T.settle - 1).frame, null);
  s = tickReading(s, T.settle);
  assert.equal(s.shown, 1);
  s = offerReading(s, frame("b"), T.settle + 100);
  s = tickReading(s, T.settle + T.step);
  assert.equal(s.frame.key, "a");
  assert.equal(s.shown, 2);
  s = tickReading(s, T.settle + 2 * T.step);
  assert.equal(s.shown, 3);
  assert.equal(tickReading(s, s.holdUntil - 1).frame.key, "a");
  assert.equal(tickReading(s, s.holdUntil).frame.key, "b");
});
test("brief orientations are ignored and the latest stable frame replaces the queue", () => {
  let s = offerReading(emptyReading, frame("a"), 0);
  s = offerReading(s, frame("b"), 1900);
  assert.equal(tickReading(s, 2000).frame, null);
  s = offerReading(s, frame("c"), 2500);
  assert.equal(tickReading(s, 4500).frame.key, "c");
});
test("pause freezes reveal and hold timers, including updates arriving while paused", () => {
  let s = tickReading(offerReading(emptyReading, frame("a"), 0), T.settle);
  s = pauseReading(s, true, 2100);
  s = offerReading(s, frame("b"), 9000);
  assert.equal(tickReading(s, 12000).shown, 1);
  s = pauseReading(s, false, 12100);
  assert.equal(tickReading(s, 12100).shown, 1);
  assert.equal(tickReading(s, 13300).shown, 2);
});
test("reading copies canonical meanings and never includes stale or fabricated relations", () => {
  const m = data.evidence.reasoning.mechanisms.find(
    (m) => m.isCurrent && m.reviewStatus !== "rejected",
  );
  const route = {
    start: m.from,
    nodes: [m.from, m.to, "unknown"],
    mechanisms: [m.id],
  };
  const f = buildReadingFrame(data, route, history, themes);
  assert.ok(f);
  assert.ok(f.items.find((i) => i.id === m.from));
  assert.ok(f.items.find((i) => i.id === m.to));
  assert.ok(!f.items.find((i) => i.id === "unknown"));
  assert.equal(
    f.items[0].meaning,
    data.evidence.concepts.find((c) => c.id === m.from).definition,
  );
  for (const p of f.items.filter((i) => i.kind === "phenomenon"))
    assert.ok(p.context.includes("ei kausaalivahvistus"));
  const d = structuredClone(data);
  d.evidence.reasoning.mechanisms.find((x) => x.id === m.id).isCurrent = false;
  assert.ok(
    !buildReadingFrame(d, route, history, themes).items.find(
      (i) => i.id === m.to,
    ),
  );
});
