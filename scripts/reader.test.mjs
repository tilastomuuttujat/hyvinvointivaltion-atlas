import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readerPath, compareReaderPaths } from "../src/lib/atlas.reader.ts";
const data = JSON.parse(
  readFileSync(new URL("../public/data/atlas.json", import.meta.url)),
);
test("reader synthesis uses exact directed mechanisms and never fabricates a chain", () => {
  const m = data.evidence.reasoning.mechanisms.find(
    (x) => x.isCurrent && x.reviewStatus !== "rejected",
  );
  const route = [{ id: m.from }, { id: m.to, via: m.id }];
  assert.equal(readerPath(data, route).links[0].mechanism.id, m.id);
  assert.equal(
    readerPath(data, [{ id: m.to }, { id: m.from, via: m.id }]).links[0]
      .mechanism.from,
    m.from,
  );
  assert.equal(
    readerPath(data, [{ id: "missing" }, { id: m.to, via: m.id }]).unknown,
    1,
  );
  const copy = structuredClone(data);
  copy.evidence.reasoning.mechanisms.find((x) => x.id === m.id).isCurrent =
    false;
  assert.equal(readerPath(copy, route).unknown, 1);
});
test("reader evidence excludes rejected and stale links and preserves contrary relations", () => {
  const d = structuredClone(data),
    r = d.evidence.reasoning,
    m = r.mechanisms.find((x) => x.isCurrent && x.reviewStatus !== "rejected"),
    o = d.evidence.observations[0];
  const template = {
    id: "test",
    observationId: o.id,
    statementId: m.statementId,
    relation: "challenges",
    rationale: "counterevidence",
    limitations: "limited",
    applicability: "",
    assessmentBasis: "",
    causalEffectIdentified: false,
    reviewStatus: "needs_review",
    isCurrent: true,
  };
  r.evidenceLinks = [
    template,
    { ...template, id: "rejected", reviewStatus: "rejected" },
    { ...template, id: "stale", isCurrent: false },
  ];
  const p = readerPath(d, [{ id: m.from }, { id: m.to, via: m.id }]);
  assert.equal(p.links[0].evidence.length, 1);
  assert.equal(p.links[0].evidence[0].link.relation, "challenges");
  assert.equal(p.links[0].mechanism.basis, m.basis);
});
test("path comparison distinguishes parallel mechanisms and exact branching position", () => {
  const a = [{ id: "a" }, { id: "b", via: "m1" }],
    b = [{ id: "a" }, { id: "b", via: "m2" }];
  assert.deepEqual(compareReaderPaths(a, b), {
    shared: 1,
    sameStart: true,
    sameEnd: true,
  });
  assert.equal(compareReaderPaths(a, []).shared, 0);
});
