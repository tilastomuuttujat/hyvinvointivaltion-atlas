import { describe, expect, it } from "vitest";
import { backcast, periodAt, storylineStops } from "@/lib/atlas.storylines";
import type { Cell, Period } from "@/lib/atlas.functions";

const cov = { A: 0, K: 0, S: 0 };
const P: Period[] = [
  { id: "p1", label: "", start: 1850, end: 1916, coverage: cov },
  { id: "p3", label: "", start: 1945, end: 1974, coverage: cov },
  { id: "p6", label: "", start: 2010, end: 2025, coverage: cov },
  { id: "p7", label: "", start: 2026, end: 2050, coverage: cov },
];
const cell = (c: number, p: string, direct = 1): Cell => ({ c, p, direct, context: 0, counter: 0, articles: 1 });

describe("storylines", () => {
  it("turning points are only periods where a path conclusion has evidence, in time order", () => {
    expect(storylineStops(P, [cell(2, "p6"), cell(2, "p1"), cell(9, "p3"), cell(2, "p3", 0)], [2])).toEqual(["p1", "p6"]);
  });
  it("back-cast only reaches documented periods overlapping 1970–2025", () => {
    const b = backcast(P, [cell(5, "p1"), cell(5, "p3"), cell(5, "p6"), cell(5, "p7")], [], 5);
    expect(b.map((x) => x.p)).toEqual(["p3", "p6"]);
  });
  it("time machine maps a year to its era", () => {
    expect(periodAt(P, 2030)?.id).toBe("p7");
    expect(periodAt(P, 1960)?.id).toBe("p3");
  });
});
