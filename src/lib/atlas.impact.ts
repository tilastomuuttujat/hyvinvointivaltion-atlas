import type { AtlasData } from "./atlas.functions";
import type { ExploreStep } from "./atlas.explore";
import { catalogueFor } from "./teema.system.ts";
export type ImpactNode = {
  id: string;
  label: string;
  definition: string;
  themes: string[];
  x: number;
  y: number;
  rank: number;
  component: number;
  connected: boolean;
};
export type ImpactEdge = NonNullable<
  NonNullable<AtlasData["evidence"]>["reasoning"]
>["mechanisms"][number];
export type ImpactDirection = "effects" | "causes" | "both";
export type ImpactGraph = {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  themes: { id: string; label: string }[];
  bounds: { x: number; y: number; width: number; height: number };
};
export function buildImpactGraph(data: AtlasData): ImpactGraph {
  const catalog = catalogueFor(data),
    concepts = [...(data.evidence?.concepts ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    ids = new Set(concepts.map((c) => c.id));
  const statements = new Set(
    data.evidence?.reasoning?.statements
      .filter((s) => s.reviewStatus !== "rejected")
      .map((s) => s.id),
  );
  const edges = (data.evidence?.reasoning?.mechanisms ?? [])
    .filter(
      (m) =>
        m.isCurrent &&
        m.reviewStatus !== "rejected" &&
        statements.has(m.statementId) &&
        ids.has(m.from) &&
        ids.has(m.to),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const adjacency = new Map(concepts.map((c) => [c.id, [] as string[]]));
  for (const e of edges) adjacency.get(e.from)!.push(e.to);
  // Condense cycles before assigning ranks; cycles remain explicit directed edges.
  let next = 0;
  const indices = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    onStack = new Set<string>(),
    components: string[][] = [];
  const visit = (id: string) => {
    indices.set(id, next);
    low.set(id, next++);
    stack.push(id);
    onStack.add(id);
    for (const target of adjacency.get(id) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        low.set(id, Math.min(low.get(id)!, low.get(target)!));
      } else if (onStack.has(target))
        low.set(id, Math.min(low.get(id)!, indices.get(target)!));
    }
    if (low.get(id) === indices.get(id)) {
      const group: string[] = [];
      let item: string;
      do {
        item = stack.pop()!;
        onStack.delete(item);
        group.push(item);
      } while (item !== id);
      components.push(group.sort());
    }
  };
  for (const c of concepts) if (!indices.has(c.id)) visit(c.id);
  const component = new Map<string, number>();
  components.forEach((c, i) => c.forEach((id) => component.set(id, i)));
  const parents = components.map(() => new Set<number>()),
    children = components.map(() => new Set<number>());
  for (const e of edges) {
    const a = component.get(e.from)!,
      b = component.get(e.to)!;
    if (a !== b) {
      children[a]!.add(b);
      parents[b]!.add(a);
    }
  }
  const degree = parents.map((p) => p.size),
    rank = components.map(() => 0),
    queue = degree.flatMap((d, i) => (d === 0 ? [i] : []));
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i]!;
    for (const b of children[a]!) {
      rank[b] = Math.max(rank[b]!, rank[a]! + 1);
      if (--degree[b] === 0) queue.push(b);
    }
  }
  const memberships = new Map(
    concepts.map((c) => [
      c.id,
      catalog.themes
        .filter((t) => t.concepts.some((x) => x.id === c.id))
        .map((t) => t.id),
    ]),
  );
  const themeIndex = (id: string) =>
    Math.max(
      0,
      catalog.themes.findIndex((t) => t.id === memberships.get(id)?.[0]),
    );
  const connected = new Set(edges.flatMap((e) => [e.from, e.to])),
    positions = new Map<string, { x: number; y: number }>(),
    cy = new Map<number, number>();
  for (let level = 0; level <= Math.max(0, ...rank); level++) {
    const groups = components
      .map((c, i) => ({ c, i }))
      .filter(
        ({ c, i }) => rank[i] === level && c.some((id) => connected.has(id)),
      )
      .map(({ c, i }) => ({
        c,
        i,
        preferred: parents[i]!.size
          ? [...parents[i]!].reduce((s, p) => s + (cy.get(p) ?? 0), 0) /
            parents[i]!.size
          : themeIndex(c[0]!) * 140,
      }))
      .sort(
        (a, b) => a.preferred - b.preferred || a.c[0]!.localeCompare(b.c[0]!),
      );
    let bottom = -140;
    for (const { c, i, preferred } of groups) {
      const height = Math.max(130, c.length * 100),
        y = Math.max(preferred, bottom + height / 2 + 45);
      cy.set(i, y);
      bottom = y + height / 2;
      for (let j = 0; j < c.length; j++) {
        const angle = (j * Math.PI * 2) / c.length;
        positions.set(c[j]!, {
          x: level * 350 + (c.length > 1 ? Math.cos(angle) * 85 : 0),
          y: y + (c.length > 1 ? Math.sin(angle) * height * 0.35 : 0),
        });
      }
    }
  }
  let baseY = Math.max(0, ...[...positions.values()].map((p) => p.y)) + 260;
  const isolated = concepts.filter((c) => !connected.has(c.id));
  for (let row = 0; row < Math.ceil(catalog.themes.length / 4); row++) {
    let height = 130;
    for (let col = 0; col < 4; col++) {
      const ti = row * 4 + col;
      const group = isolated.filter((c) => themeIndex(c.id) === ti);
      height = Math.max(height, Math.ceil(group.length / 3) * 90 + 80);
      group.forEach((c, i) =>
        positions.set(c.id, {
          x: col * 350 + (i % 3) * 95,
          y: baseY + Math.floor(i / 3) * 90,
        }),
      );
    }
    baseY += height;
  }
  const nodes = concepts.map((c) => ({
    ...c,
    themes: memberships.get(c.id) ?? [],
    ...positions.get(c.id)!,
    rank: rank[component.get(c.id)!] ?? 0,
    component: component.get(c.id)!,
    connected: connected.has(c.id),
  }));
  const xs = nodes.map((n) => n.x),
    ys = nodes.map((n) => n.y),
    minX = Math.min(0, ...xs) - 150,
    minY = Math.min(0, ...ys) - 150;
  return {
    nodes,
    edges,
    themes: catalog.themes.map((t) => ({ id: t.id, label: t.label })),
    bounds: {
      x: minX,
      y: minY,
      width: Math.max(350, ...xs) - minX + 150,
      height: Math.max(300, ...ys) - minY + 150,
    },
  };
}
export function impactNeighborhood(
  graph: ImpactGraph,
  current: string | undefined,
  steps: ExploreStep[],
  direction: ImpactDirection,
  depth: number,
  excluded = new Set<string>(),
) {
  const nodes = new Set(steps.map((s) => s.id)),
    edges = new Set(steps.flatMap((s) => (s.via ? [s.via] : []))),
    distance = new Map<string, number>();
  if (!current)
    return {
      nodes: new Set(graph.nodes.map((n) => n.id)),
      edges: new Set(graph.edges.map((e) => e.id)),
      distance,
    };
  nodes.add(current);
  distance.set(current, 0);
  let frontier = [current];
  for (let level = 1; level <= Math.max(1, Math.min(3, depth)); level++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const e of graph.edges) {
        if (excluded.has(e.id)) continue;
        const target =
          direction !== "causes" && e.from === id
            ? e.to
            : direction !== "effects" && e.to === id
              ? e.from
              : undefined;
        if (!target) continue;
        edges.add(e.id);
        nodes.add(target);
        if (!distance.has(target)) {
          distance.set(target, level);
          next.push(target);
        }
      }
    frontier = next;
  }
  return { nodes, edges, distance };
}
export function impactCurve(graph: ImpactGraph, e: ImpactEdge) {
  const a = graph.nodes.find((n) => n.id === e.from)!,
    b = graph.nodes.find((n) => n.id === e.to)!;
  const peers = graph.edges.filter((p) => p.from === e.from && p.to === e.to),
    offset =
      (peers.findIndex((p) => p.id === e.id) - (peers.length - 1) / 2) * 45;
  const sign = b.x >= a.x ? 1 : -1,
    reach = Math.max(80, Math.abs(b.x - a.x) * 0.42);
  return {
    d: `M${a.x} ${a.y}C${a.x + sign * reach} ${a.y + offset},${b.x - sign * reach} ${b.y + offset},${b.x} ${b.y}`,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2 + offset * 0.75,
  };
}
export type ImpactCamera = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export function fitImpact(
  points: { x: number; y: number }[],
  ratio: number,
): ImpactCamera {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  if (!points.length) return { x: 0, y: 0, width: 1200, height: 1200 / ratio };
  const loX = Math.min(...xs),
    hiX = Math.max(...xs),
    loY = Math.min(...ys),
    hiY = Math.max(...ys),
    width = Math.max(480, hiX - loX + 260, (hiY - loY + 200) * ratio);
  return {
    x: (loX + hiX - width) / 2,
    y: (loY + hiY - width / ratio) / 2,
    width,
    height: width / ratio,
  };
}
