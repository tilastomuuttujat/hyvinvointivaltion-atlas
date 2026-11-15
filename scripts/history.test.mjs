import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
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
