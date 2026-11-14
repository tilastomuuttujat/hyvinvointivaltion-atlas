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
test('equal labels with different IDs do not fabricate a cross-theme bridge',()=>{
 const theme=id=>({id,label:id,concepts:[{id,t:'Sama nimi',d:'',r:''}],conclusions:[],mechanisms:[],paths:[],insights:[],findings:[],series:0,claims:0,gap:[]});
 assert.equal(themeBridges([theme('one'),theme('two')]).length,0);
 const copy=theme('two');copy.concepts[0].id='one';assert.equal(themeBridges([theme('one'),copy]).length,1);
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
