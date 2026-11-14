import catalogue from "../content/teemaluettelo.json" with { type: "json" };
import type { V3 } from "@/lib/teema.camera";

export type ForceKind = "theme" | "conclusion" | "concept";
export type ForceNode = {
  id: string;
  kind: ForceKind;
  label: string;
  detail?: string | undefined;
  themes: number[];
  p: V3;
};
export type ForceEdge = {
  a: number;
  b: number;
  kind: "member" | "mechanism";
  label?: string | undefined;
  referenceId?: string;
};
export type ForceGraph = { nodes: ForceNode[]; edges: ForceEdge[] };

type Theme = {
  id: string;
  label: string;
  concepts: { id: string; t: string; d: string }[];
  conclusions: { id: number; t: string; d?: string }[];
  mechanisms: {
    id: string;
    t: string;
    from: string;
    to: string;
    fromId?: string;
    toId?: string;
  }[];
};

/** Recorded catalogue structure only: theme membership and documented mechanisms; no inferred similarity links. */
export function buildForceGraph(
  themes: Theme[] = (catalogue as { themes: Theme[] }).themes,
): ForceGraph {
  const nodes: ForceNode[] = [],
    edges: ForceEdge[] = [],
    index = new Map<string, number>();
  const node = (
    id: string,
    kind: ForceKind,
    label: string,
    theme: number,
    detail?: string,
  ) => {
    let i = index.get(id);
    if (i === undefined) {
      i = nodes.length;
      index.set(id, i);
      nodes.push({
        id,
        kind,
        label,
        detail,
        themes: [],
        p: { x: 0, y: 0, z: 0 },
      });
    }
    if (!nodes[i]!.themes.includes(theme)) nodes[i]!.themes.push(theme);
    return i;
  };
  const seen = new Set<string>();
  const edge = (
    a: number,
    b: number,
    kind: ForceEdge["kind"],
    label?: string,
    referenceId?: string,
  ) => {
    const k =
      kind === "mechanism"
        ? `${a}-${b}-${kind}-${label}`
        : `${Math.min(a, b)}-${Math.max(a, b)}-${kind}`;
    if (a !== b && !seen.has(k)) {
      seen.add(k);
      edges.push({ a, b, kind, label, referenceId });
    }
  };
  themes.forEach((t, ti) => {
    const th = node(`T:${t.id}`, "theme", t.label, ti);
    t.conclusions.forEach((c) =>
      edge(
        th,
        node(`P:${c.id}`, "conclusion", `P${c.id} ${c.t}`, ti, c.d),
        "member",
      ),
    );
    t.concepts.forEach((c) =>
      edge(th, node(`K:${c.id}`, "concept", c.t, ti, c.d), "member"),
    );
    t.mechanisms.forEach((m) => {
      const a = node(`K:${m.fromId ?? m.from}`, "concept", m.from, ti),
        b = node(`K:${m.toId ?? m.to}`, "concept", m.to, ti);
      edge(a, b, "mechanism", m.t, m.id);
      edge(th, a, "member");
      edge(th, b, "member");
    });
  });
  return { nodes, edges };
}

/** Deterministic 3D force layout: repulsion, springs and gentle centring. */
export function layoutForceGraph(g: ForceGraph, iterations = 260): ForceGraph {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  const n = g.nodes.length,
    P = g.nodes.map(() => ({ x: rnd() * 600, y: rnd() * 600, z: rnd() * 600 }));
  const V = P.map(() => ({ x: 0, y: 0, z: 0 }));
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = P[i]!.x - P[j]!.x,
          dy = P[i]!.y - P[j]!.y,
          dz = P[i]!.z - P[j]!.z;
        const d2 = dx * dx + dy * dy + dz * dz + 1,
          f = 9000 / d2 / Math.sqrt(d2);
        V[i]!.x += dx * f;
        V[i]!.y += dy * f;
        V[i]!.z += dz * f;
        V[j]!.x -= dx * f;
        V[j]!.y -= dy * f;
        V[j]!.z -= dz * f;
      }
    for (const e of g.edges) {
      const a = P[e.a]!,
        b = P[e.b]!,
        dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01,
        rest = e.kind === "mechanism" ? 70 : 110,
        f = ((d - rest) * 0.02) / d;
      V[e.a]!.x += dx * f;
      V[e.a]!.y += dy * f;
      V[e.a]!.z += dz * f;
      V[e.b]!.x -= dx * f;
      V[e.b]!.y -= dy * f;
      V[e.b]!.z -= dz * f;
    }
    for (let i = 0; i < n; i++) {
      V[i]!.x -= P[i]!.x * 0.004;
      V[i]!.y -= P[i]!.y * 0.004;
      V[i]!.z -= P[i]!.z * 0.004;
      const s = Math.hypot(V[i]!.x, V[i]!.y, V[i]!.z),
        cap = 40 * cool + 2,
        k = s > cap ? cap / s : 1;
      P[i]!.x += V[i]!.x * k;
      P[i]!.y += V[i]!.y * k;
      P[i]!.z += V[i]!.z * k;
      V[i]!.x *= 0.5;
      V[i]!.y *= 0.5;
      V[i]!.z *= 0.5;
    }
  }
  return {
    edges: g.edges,
    nodes: g.nodes.map((nd, i) => ({ ...nd, p: P[i]! })),
  };
}

export function neighbours(g: ForceGraph, i: number) {
  const s = new Set<number>([i]);
  for (const e of g.edges) {
    if (e.a === i) s.add(e.b);
    if (e.b === i) s.add(e.a);
  }
  return s;
}
