import raw from "@/content/teemaluettelo.json";

export type Mechanism = { t: string; from: string; to: string; d: string; m: string };
export type Path = { t: string; steps: string[]; m: string };
export type Theme = {
  id: string; label: string;
  conclusions: { id: number; t: string; d: string }[];
  insights: { t: string; d: string; q: string; v: string; links: number[] }[];
  concepts: { t: string; d: string; r: string }[];
  mechanisms: Mechanism[]; paths: Path[];
  findings: { t: string; d: string }[];
  series: number; claims: number; gap: string[];
};
export const CATALOG = raw as { date: string; themes: Theme[] };

const norm = (s: string) => s.trim().toLocaleLowerCase("fi");

/** Concept names a theme explicitly uses (key concepts, mechanism ends, path steps). */
export function themeTerms(t: Theme): Map<string, string> {
  const m = new Map<string, string>();
  const add = (s: string) => { if (s) m.set(norm(s), s); };
  t.concepts.forEach((c) => add(c.t));
  t.mechanisms.forEach((x) => { add(x.from); add(x.to); });
  t.paths.forEach((p) => p.steps.forEach(add));
  return m;
}

/** Bridges between themes = identically named concepts recorded in both (no text similarity). */
export function themeBridges(themes: Theme[]) {
  const terms = themes.map(themeTerms);
  const out: { a: number; b: number; shared: string[] }[] = [];
  for (let a = 0; a < themes.length; a++)
    for (let b = a + 1; b < themes.length; b++) {
      const shared = [...terms[a]!.keys()].filter((k) => terms[b]!.has(k)).map((k) => terms[a]!.get(k)!);
      if (shared.length) out.push({ a, b, shared });
    }
  return out;
}

export type FlowNode = { key: string; label: string; rank: number; x: number; y: number };
export type FlowEdge = { from: string; to: string; kind: "mechanism" | "path"; ref: number };

/** Layered left→right layout of a theme's causal mechanisms and explanation paths. */
export function buildFlow(t: Theme, W = 900, H = 420) {
  const labels = new Map<string, string>();
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();
  const push = (a: string, b: string, kind: FlowEdge["kind"], ref: number) => {
    if (!a || !b || norm(a) === norm(b)) return;
    labels.set(norm(a), a); labels.set(norm(b), b);
    const id = `${kind}|${ref}|${norm(a)}|${norm(b)}`;
    if (seen.has(id)) return; seen.add(id);
    edges.push({ from: norm(a), to: norm(b), kind, ref });
  };
  t.mechanisms.forEach((m, i) => push(m.from, m.to, "mechanism", i));
  t.paths.forEach((p, i) => p.steps.slice(1).forEach((s, j) => push(p.steps[j]!, s, "path", i)));
  const rank = new Map<string, number>([...labels.keys()].map((k) => [k, 0]));
  for (let it = 0; it < labels.size; it++) {
    let changed = false;
    for (const e of edges) {
      const r = rank.get(e.from)! + 1;
      if (r > rank.get(e.to)! && r < 8) { rank.set(e.to, r); changed = true; }
    }
    if (!changed) break;
  }
  const max = Math.max(0, ...rank.values());
  const cols = new Map<number, string[]>();
  for (const [k, r] of rank) cols.set(r, [...(cols.get(r) ?? []), k]);
  const nodes: FlowNode[] = [];
  for (const [r, ks] of cols) ks.forEach((k, i) => nodes.push({
    key: k, label: labels.get(k)!, rank: r,
    x: max === 0 ? W / 2 : 90 + (r / max) * (W - 180),
    y: ((i + 1) / (ks.length + 1)) * H,
  }));
  return { nodes, edges };
}
