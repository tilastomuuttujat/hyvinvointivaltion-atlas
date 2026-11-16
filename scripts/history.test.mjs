import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  corridorLayout,
  historyConnections,
  historyLayout,
  historyThemes,
  validateHistory,
} from "../src/lib/atlas.history.ts";
const h = JSON.parse(
    readFileSync(new URL("../src/content/history-wall.json", import.meta.url)),
  ),
  snapshot = JSON.parse(
    readFileSync(new URL("../public/data/atlas.json", import.meta.url)),
  ),
  data = { ...snapshot.atlas, evidence: snapshot.evidence };
test("dated public history export retains stable IDs, references and full 1850–2050 axis", () => {
  validateHistory(h);
  assert.equal(h.items.length, 1111);
  assert.ok(h.items.find((i) => i.id === "pankkikriisi").sources.length);
  assert.ok(h.items.find((i) => i.id === "peruskoulu-1968"));
  const a = historyLayout(h, ["finance", "education"]),
    b = historyLayout(h, ["finance", "education"]);
  assert.deepEqual(a, b);
  const p = a.find((p) => p.item.id === "pankkikriisi");
  assert.equal(p.x, 100 + (1991 - 1850) * 7);
  assert.equal(p.endX, 100 + (1994 - 1850) * 7);
  assert.ok(
    historyThemes(h.items.find((i) => i.id === "peruskoulu-1968")).includes(
      "education",
    ),
  );
});
test("same domain and same period remain contextual and never become causal evidence", () => {
  const m = data.evidence.reasoning.mechanisms.find(
    (m) => m.isCurrent && m.reviewStatus !== "rejected",
  );
  const copy = structuredClone(data),
    s = copy.evidence.reasoning.statements.find((s) => s.id === m.statementId);
  s.start = 1990;
  s.end = 2000;
  const rows = historyConnections(
    h,
    copy,
    new Set([m.id]),
    new Set(["finance"]),
  );
  assert.equal(
    rows.find((c) => c.item.id === "pankkikriisi").relation,
    "context",
  );
  assert.ok(rows.every((c) => c.relation !== "recorded"));
  assert.equal(
    rows.find((c) => c.item.id === "torpparivapautus-1918").relation,
    "none",
  );
});
test("only accepted explicit current-ID references receive recorded-context treatment", () => {
  const m = data.evidence.reasoning.mechanisms.find(
      (m) => m.isCurrent && m.reviewStatus !== "rejected",
    ),
    bundle = {
      ...h,
      mechanismLinks: [
        {
          itemId: "pankkikriisi",
          mechanismId: m.id,
          relation: "documented_context",
          rationale: "Recorded context",
          sourceUrl: "https://example.org/source",
          reviewStatus: "accepted",
        },
      ],
    };
  validateHistory(bundle);
  assert.equal(
    historyConnections(bundle, data, new Set([m.id]), new Set()).find(
      (c) => c.item.id === "pankkikriisi",
    ).relation,
    "recorded",
  );
  bundle.mechanismLinks[0].reviewStatus = "needs_review";
  assert.equal(
    historyConnections(bundle, data, new Set([m.id]), new Set()).find(
      (c) => c.item.id === "pankkikriisi",
    ).relation,
    "none",
  );
  bundle.mechanismLinks[0].reviewStatus = "accepted";
  bundle.mechanismLinks[0].mechanismId = "legacy-142";
  assert.equal(
    historyConnections(bundle, data, new Set([m.id]), new Set()).find(
      (c) => c.item.id === "pankkikriisi",
    ).relation,
    "none",
  );
});
test("invalid intervals and duplicate historical IDs fail closed", () => {
  const copy = structuredClone(h);
  copy.items[0].end = copy.items[0].start - 1;
  assert.throws(() => validateHistory(copy));
  copy.items[0] = h.items[1];
  assert.throws(() => validateHistory(copy));
});

test("corridor places phenomena on receding side walls along the time axis", () => {
  const order = [
    "rights",
    "work",
    "health",
    "education",
    "livelihood",
    "governance",
    "finance",
    "population",
    "information",
    "democracy",
    "security_environment",
    "renewal",
  ];
  const rows = corridorLayout(h, order);
  assert.ok(rows.some((p) => p.side === "left"));
  assert.ok(rows.some((p) => p.side === "right"));
  for (const p of rows) {
    // Walls recede toward the central vanishing point; earlier years sit nearer the viewer, the future at the horizon.
    assert.ok(
      p.side === "left"
        ? p.x < 800 && p.endX >= p.x - 1
        : p.x > 800 && p.endX <= p.x + 1,
    );
    assert.ok(p.y >= 50 && p.y <= 950);
  }
  assert.deepEqual(rows, corridorLayout(h, order));
});

test("dense wall positions and background labels stay fixed while the active chain changes", () => {
  const themes = [
    "rights",
    "work",
    "health",
    "education",
    "livelihood",
    "governance",
    "finance",
    "population",
    "information",
    "democracy",
    "security_environment",
    "renewal",
  ];
  const positions = corridorLayout(h, themes);
  assert.equal(positions.length, h.items.length);
  assert.ok(positions.filter((p) => p.labelled).length > 150);
  for (const side of ["left", "right"])
    assert.ok(
      positions.filter((p) => p.side === side && p.labelled).length > 60,
    );
  const before = JSON.stringify(positions);
  historyConnections(h, data, new Set(), new Set(["work"]));
  historyConnections(h, data, new Set(), new Set(["finance"]));
  assert.equal(JSON.stringify(corridorLayout(h, themes)), before);
  for (const p of positions) {
    const top = 500 - 440 * p.depth,
      bottom = 500 + 440 * p.depth;
    assert.ok(p.y > top && p.y < bottom);
  }
});

test("theme-only and time-plus-theme matches are never eligible case anchors", () => {
  const ids = new Set(["structural-hidden-8", "structural-care-6"]);
  const c = historyConnections(
    h,
    data,
    ids,
    new Set(["governance", "finance"]),
  ).find((c) => c.item.id === "suomen-sota-autonomia-1808");
  assert.equal(c.matchLevel, "theme_only");
  assert.equal(c.anchorEligible, false);
  const copy = structuredClone(data);
  for (const m of copy.evidence.reasoning.mechanisms.filter((m) =>
    ids.has(m.id),
  )) {
    const s = copy.evidence.reasoning.statements.find(
      (s) => s.id === m.statementId,
    );
    s.start = 1991;
    s.end = 1994;
  }
  const timed = historyConnections(h, copy, ids, new Set(["finance"])).find(
    (c) => c.item.id === "pankkikriisi",
  );
  assert.equal(timed.matchLevel, "time_and_theme");
  assert.equal(timed.anchorEligible, false);
});
