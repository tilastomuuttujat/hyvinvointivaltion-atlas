import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePublication } from "../src/lib/atlas.publication.ts";
import {
  buildThemeCatalog,
  validateThemeCatalog,
} from "../src/lib/atlas.catalogue.ts";
import { assessMechanism } from "../src/lib/atlas.context.ts";
import { buildForceGraph } from "../src/lib/atlas.force-graph.ts";
const snapshot = JSON.parse(
  await readFile(
    new URL("./fixtures/publication-input.json", import.meta.url),
    "utf8",
  ),
);
const publication = JSON.parse(
  await readFile(
    new URL("./fixtures/publication.json", import.meta.url),
    "utf8",
  ),
);
const data = { ...snapshot.atlas, evidence: snapshot.evidence, publication };
test("expanded publication preserves public references and all canonical concepts", () => {
  validatePublication(publication, data);
  const catalog = buildThemeCatalog(
    data,
    snapshot.themeCatalog,
    publication.generatedAt,
  );
  validateThemeCatalog(catalog, data);
  assert.equal(catalog.themes.length, 12);
  assert.deepEqual(
    new Set(catalog.themes.flatMap((t) => t.concepts.map((c) => c.id))),
    new Set(data.evidence.concepts.map((c) => c.id)),
  );
  const homes = catalog.themes
    .filter((t) => t.concepts.some((c) => c.id === "cost_shifting"))
    .map((t) => t.id);
  assert.ok(
    homes.includes("work") &&
      homes.includes("finance") &&
      homes.includes("governance"),
  );
  const graph = buildForceGraph(catalog.themes);
  assert.equal(graph.nodes.filter((n) => n.id === "K:cost_shifting").length, 1);
  assert.equal(
    graph.nodes.filter((n) => n.kind === "concept").length,
    data.evidence.concepts.length,
  );
  assert.ok(
    catalog.themes.some((t) =>
      t.concepts.some((c) => c.membershipSource === "editorial_fallback"),
    ),
  );
  assert.equal(publication.cases.length, 5);
  assert.equal(publication.stages.length, 8);
  assert.equal(publication.evidenceGaps.length, 18);
});
test("publication rejects private fields, unpublished observations, rejected transitions and mixed versions", () => {
  const badObs = structuredClone(publication);
  badObs.caseEvidence[0].observation_id = "withheld-observation";
  assert.throws(() => validatePublication(badObs, data), /case observation/);
  const badTransition = structuredClone(publication);
  badTransition.transitions[0].review_status = "rejected";
  assert.throws(
    () => validatePublication(badTransition, data),
    /service transition/,
  );
  const privateData = structuredClone(publication);
  privateData.cases[0].body_markdown = "private article";
  assert.throws(() => validatePublication(privateData, data), /private fields/);
  assert.throws(
    () =>
      validatePublication(publication, { ...data, generatedAt: "2000-01-01" }),
    /mixed snapshot/,
  );
  const badTheme = structuredClone(publication);
  badTheme.suppressedConceptIds = ["cost_shifting"];
  assert.throws(
    () =>
      buildThemeCatalog(
        { ...data, publication: badTheme },
        snapshot.themeCatalog,
        publication.generatedAt,
      ),
    /Rejected theme/,
  );
});
const m = {
  id: "ab",
  from: "a",
  to: "b",
  statementId: "s",
  conditions: "Edellyttää sopivaa työtä.",
  isCurrent: true,
  reviewStatus: "needs_review",
};
const contextData = {
  evidence: {
    concepts: [],
    observations: [{ id: "o", population: "Tutkimuksen kohderyhmä" }],
    reasoning: {
      statements: [
        { id: "s", start: 2010, end: 2012 },
        { id: "old", start: 1900, end: 1901 },
      ],
      mechanisms: [m, { ...m, id: "old", statementId: "old" }],
      evidenceLinks: [
        {
          statementId: "s",
          observationId: "o",
          isCurrent: true,
          reviewStatus: "accepted",
        },
      ],
      paths: [],
    },
  },
  publication: { caseRoutes: [] },
};
test("context respects explicit years and never treats textual conditions as fulfilled", () => {
  assert.equal(
    assessMechanism(contextData, m, { start: 1900, end: 1901 }).status,
    "outside",
  );
  const a = assessMechanism(contextData, m, {
    start: 2011,
    end: 2011,
    population: "Tutkimuksen kohderyhmä",
  });
  assert.equal(a.status, "unknown");
  assert.ok(a.messages.some((m) => m.includes("Soveltamisehdot")));
  assert.equal(
    assessMechanism(contextData, m, { population: "Toinen ryhmä" }).status,
    "context_change",
  );
  assert.equal(
    assessMechanism(contextData, m, { caseId: "not-recorded" }).status,
    "outside",
  );
  assert.equal(
    assessMechanism(contextData, m, { start: 2020, end: 2010 }).status,
    "outside",
  );
});
test("context changes distinguish disjoint periods from open timing", () => {
  assert.equal(
    assessMechanism(contextData, m, {}, [{ id: "a", via: "old" }]).status,
    "context_change",
  );
  const open = {
    ...contextData,
    evidence: {
      ...contextData.evidence,
      reasoning: {
        ...contextData.evidence.reasoning,
        statements: [{ id: "s", start: null, end: null }],
      },
    },
  };
  assert.equal(assessMechanism(open, m, {}).status, "unknown");
});
test("trusted publishing refreshes data on pushes and schedule, not on PRs", async () => {
  const yaml = await readFile(
    new URL("../.github/workflows/pages.yml", import.meta.url),
    "utf8",
  );
  assert.match(yaml, /schedule:\s*\n\s*- cron:/);
  assert.match(
    yaml,
    /if: github.event_name == 'push' \|\| github.event_name == 'schedule'/,
  );
  assert.doesNotMatch(yaml, /pull_request_target/);
  const script = await readFile(
    new URL("./export-atlas.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(
    script.indexOf("validatePublication") < script.indexOf("await rename"),
  );
  assert.match(script, /REPEATABLE READ READ ONLY/);
  assert.match(script, /atlas-version.json/);
  const sql = await readFile(
    new URL("./export-publication.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    sql,
    /publication_hold IS FALSE AND o.source_is_published IS TRUE/,
  );
  assert.match(sql, /JOIN observation_ids/);
  assert.doesNotMatch(sql, /body_markdown|body_html|source_snapshots/);
});

test("parallel mechanism IDs survive identical labels and endpoints", () => {
  const t = {
    id: "t",
    label: "T",
    concepts: [
      { id: "a", t: "A", d: "" },
      { id: "b", t: "B", d: "" },
    ],
    conclusions: [],
    mechanisms: [
      { id: "one", fromId: "a", toId: "b", from: "A", to: "B", t: "Same" },
      { id: "two", fromId: "a", toId: "b", from: "A", to: "B", t: "Same" },
    ],
  };
  assert.deepEqual(
    buildForceGraph([t])
      .edges.filter((e) => e.kind === "mechanism")
      .map((e) => e.referenceId),
    ["one", "two"],
  );
});
