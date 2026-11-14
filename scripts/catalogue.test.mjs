import {
  exploreTransition,
  EMPTY_EXPLORATION,
  frameGraph,
} from "../src/lib/atlas.explore.ts";
import { exploreOptions } from "../src/lib/atlas.explore.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateThemeCatalog,
  buildThemeCatalog,
} from "../src/lib/atlas.catalogue.ts";
import { buildFlow, themeBridges } from "../src/lib/teema.system.ts";
import { buildThemeMap } from "../src/lib/atlas.themes.ts";
import { buildForceGraph } from "../src/lib/atlas.force-graph.ts";
import { validateReasoning } from "../src/lib/atlas.reasoning.ts";
const s = JSON.parse(
  readFileSync(new URL("../public/data/atlas.json", import.meta.url), "utf8"),
);
const data = { ...s.atlas, evidence: s.evidence, themeCatalog: s.themeCatalog };
test("equal labels with different IDs do not fabricate a cross-theme bridge", () => {
  const theme = (id) => ({
    id,
    label: id,
    concepts: [{ id, t: "Sama nimi", d: "", r: "" }],
    conclusions: [],
    mechanisms: [],
    paths: [],
    insights: [],
    findings: [],
    series: 0,
    claims: 0,
    gap: [],
  });
  assert.equal(themeBridges([theme("one"), theme("two")]).length, 0);
  const copy = theme("two");
  copy.concepts[0].id = "one";
  assert.equal(themeBridges([theme("one"), copy]).length, 1);
});
test("all views share one snapshot, 12 themes and every canonical concept", () => {
  validateThemeCatalog(s.themeCatalog, data);
  const map = buildThemeMap(data),
    graph = buildForceGraph(s.themeCatalog.themes);
  assert.equal(map.themes.length, s.themeCatalog.themes.length);
  assert.deepEqual(
    new Set(map.concepts.map((c) => c.key)),
    new Set(s.evidence.concepts.map((c) => c.id)),
  );
  assert.deepEqual(
    new Set(
      graph.nodes.filter((n) => n.kind === "concept").map((n) => n.id.slice(2)),
    ),
    new Set(s.evidence.concepts.map((c) => c.id)),
  );
  assert.equal(s.themeCatalog.generatedAt, s.generatedAt);
});
test("a concept without a mechanism remains visible without an invented edge", () => {
  const t = {
    id: "example",
    label: "Example",
    concepts: [
      { id: "a", t: "A", d: "" },
      { id: "b", t: "B", d: "" },
      { id: "c", t: "C", d: "" },
    ],
    conclusions: [],
    mechanisms: [
      {
        id: "ab",
        t: "A to B",
        from: "A",
        to: "B",
        fromId: "a",
        toId: "b",
        d: "",
        m: "",
      },
    ],
    paths: [],
  };
  const flow = buildFlow(t),
    graph = buildForceGraph([t]);
  assert.equal(flow.nodes.length, 3);
  assert.equal(flow.edges.length, 1);
  const c = graph.nodes.findIndex((n) => n.id === "K:c");
  assert.ok(c >= 0);
  assert.equal(
    graph.edges.filter(
      (e) => e.kind === "mechanism" && (e.a === c || e.b === c),
    ).length,
    0,
  );
});
test("reverse mechanisms are preserved with their direction", () => {
  const t = {
    id: "x",
    label: "X",
    concepts: [
      { id: "a", t: "A", d: "" },
      { id: "b", t: "B", d: "" },
    ],
    conclusions: [],
    mechanisms: [
      { id: "ab", t: "AB", from: "A", to: "B", fromId: "a", toId: "b" },
      { id: "ba", t: "BA", from: "B", to: "A", fromId: "b", toId: "a" },
    ],
  };
  const graph = buildForceGraph([t]);
  const edges = graph.edges.filter((e) => e.kind === "mechanism");
  assert.equal(edges.length, 2);
  assert.equal(edges[0].a, edges[1].b);
  assert.equal(edges[0].b, edges[1].a);
});
test("research context keeps source, study design and limitations", () => {
  const findings = s.themeCatalog.themes.flatMap((t) => t.findings);
  assert.equal(findings.length, 37);
  for (const f of findings) {
    assert.match(f.sourceUrl, /^https?:\/\//);
    assert.ok(f.limitations);
    assert.ok(f.design);
    assert.ok(s.evidence.observations.some((o) => o.id === f.id));
  }
});
test("refresh fails closed when a new concept has no editorial assignment", () => {
  assert.throws(
    () =>
      buildThemeCatalog(
        {
          ...data,
          evidence: {
            ...data.evidence,
            concepts: [
              ...data.evidence.concepts,
              {
                id: "unassigned",
                label: "New",
                definition: "",
                limitations: "",
              },
            ],
          },
        },
        s.themeCatalog,
        s.generatedAt,
      ),
    /coverage/,
  );
});
test("publication holds and hypothesis status survive the shared snapshot", () => {
  validateReasoning(s.evidence, new Set(s.atlas.conclusions.map((c) => c.id)));
  assert.equal(s.evidence.withheld, 196);
  for (const t of s.themeCatalog.themes)
    for (const m of t.mechanisms) {
      const canonical = s.evidence.reasoning.mechanisms.find(
        (x) => x.id === m.id,
      );
      assert.ok(canonical);
      assert.equal(m.reviewStatus, canonical.reviewStatus);
      assert.equal(m.conditions, canonical.conditions);
    }
});

test("exploration follows recorded direction and excludes rejected, stale and unknown mechanisms", () => {
  const mechanism = {
    id: "ab",
    from: "a",
    to: "b",
    statementId: "s",
    isCurrent: true,
    reviewStatus: "needs_review",
  };
  const d = {
    evidence: {
      concepts: [{ id: "a" }, { id: "b" }],
      reasoning: {
        statements: [{ id: "s", reviewStatus: "needs_review" }],
        mechanisms: [
          mechanism,
          { ...mechanism, id: "rejected", reviewStatus: "rejected" },
          { ...mechanism, id: "stale", isCurrent: false },
          { ...mechanism, id: "unknown", to: "unknown" },
        ],
      },
    },
  };
  assert.deepEqual(
    exploreOptions(d, "a", "after").map((o) => o.mechanism.id),
    ["ab"],
  );
  assert.equal(exploreOptions(d, "a", "before").length, 0);
  assert.equal(exploreOptions(d, "b", "after").length, 0);
  assert.equal(exploreOptions(d, "b", "before")[0].target.id, "a");
  assert.equal(exploreOptions(d, "b", "how")[0].incoming, true);
  assert.equal(exploreOptions(d, "a", "conditions")[0].target.id, "b");
  assert.equal(exploreOptions(d, "isolated", "after").length, 0);
});

test("parallel mechanisms require a precise choice and history restores the chosen mechanism", () => {
  const m = {
    id: "ab1",
    from: "a",
    to: "b",
    isCurrent: true,
    reviewStatus: "needs_review",
    statementId: "s",
  };
  const d = {
    evidence: {
      concepts: [{ id: "a" }, { id: "b" }, { id: "c" }],
      reasoning: {
        statements: [{ id: "s", reviewStatus: "needs_review" }],
        mechanisms: [
          m,
          { ...m, id: "ab2" },
          { ...m, id: "bc", from: "b", to: "c" },
        ],
      },
    },
  };
  let h = exploreTransition(EMPTY_EXPLORATION, { type: "pick", id: "a" }, d);
  const pending = exploreTransition(h, { type: "pick", id: "b" }, d);
  assert.equal(pending.pending, "b");
  assert.deepEqual(pending.steps, [{ id: "a" }]);
  assert.equal(
    exploreTransition(h, { type: "pick", id: "b", via: "unknown" }, d),
    h,
  );
  h = exploreTransition(pending, { type: "pick", id: "b", via: "ab2" }, d);
  assert.equal(h.steps[1].via, "ab2");
  h = exploreTransition(h, { type: "pick", id: "c" }, d);
  assert.equal(h.steps.length, 3);
  const back = exploreTransition(h, { type: "back" }, d);
  assert.equal(back.steps.length, 2);
  const restored = exploreTransition(back, { type: "forward" }, d);
  assert.deepEqual(restored.steps, h.steps);
  const root = exploreTransition(restored, { type: "pick", id: "a" }, d);
  assert.equal(root.steps.length, 1);
  const branch = exploreTransition(
    root,
    { type: "pick", id: "b", via: "ab1" },
    d,
  );
  assert.equal(branch.steps[1].via, "ab1");
  assert.equal(branch.future.length, 0);
  const clear = exploreTransition(branch, { type: "clear" }, d);
  assert.deepEqual(clear.steps, []);
  assert.deepEqual(
    exploreTransition(clear, { type: "back" }, d).steps,
    branch.steps,
  );
});
test("framing leaves visible points still and pans before zooming out", () => {
  assert.deepEqual(
    frameGraph(
      [
        { x: 300, y: 300 },
        { x: 500, y: 400 },
      ],
      1000,
      760,
    ),
    { scale: 1, dx: 0, dy: 0 },
  );
  const pan = frameGraph([{ x: 1050, y: 300 }], 1000, 760);
  assert.equal(pan.scale, 1);
  assert.ok(pan.dx < 0);
  const fit = frameGraph(
    [
      { x: -300, y: -100 },
      { x: 1200, y: 900 },
    ],
    1000,
    760,
  );
  assert.ok(fit.scale < 1);
  for (const p of [
    { x: -300, y: -100 },
    { x: 1200, y: 900 },
  ]) {
    const x = 500 + (p.x - 500) * fit.scale + fit.dx,
      y = 380 + (p.y - 380) * fit.scale + fit.dy;
    assert.ok(x >= 74.9 && x <= 925.1);
    assert.ok(y >= 74.9 && y <= 685.1);
  }
});
