import { describe, expect, it } from "vitest";
import { anatomy, chainOrder, yearAngle, type ChainBundle } from "@/lib/atlas.chain";

const b: ChainBundle = {
  generatedAt: "", traces: [{ phenomenon: "b", text: "jälki" }],
  phenomena: [
    { id: "p", title: "Pääketju", start: 1809, status: "accepted" },
    { id: "b", title: "B", start: 1918, status: "accepted" },
    { id: "a", title: "A", start: 1866, status: "needs_review" },
  ],
  memberships: [{ member: "b", parent: "p", relation: "thematic_context" }, { member: "a", parent: "p", relation: "thematic_context" }, { member: "x", parent: "p", relation: "thematic_context" }],
  transitions: [{ id: "t2", phenomenon: "b", from: 1950 }, { id: "t1", phenomenon: "b", from: 1918 }],
};

describe("päättelyketju", () => {
  it("places 1500 and 2050 at the ends of the clock ring", () => {
    expect(yearAngle(1500)).toBe(-150);
    expect(yearAngle(2050)).toBe(150);
  });
  it("orders chain members chronologically and drops unknown members", () => {
    expect(chainOrder(b, "p").map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("orders a phenomenon's transitions by start year with its traces", () => {
    const r = anatomy(b, "b");
    expect(r.transitions.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(r.traces).toEqual(["jälki"]);
  });
});
