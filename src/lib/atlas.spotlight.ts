import type { AtlasData } from "./atlas.functions";
import type { ForceGraph } from "./atlas.force-graph";
export type SpotlightRoute = {
  start: string;
  nodes: string[];
  mechanisms: string[];
};
/** Small directed, branching previews from current canonical mechanisms, never membership. */
export function spotlightRoutes(data: AtlasData): SpotlightRoute[] {
  const r = data.evidence?.reasoning,
    ids = new Set(data.evidence?.concepts.map((c) => c.id));
  const statements = new Set(
    r?.statements.filter((s) => s.reviewStatus !== "rejected").map((s) => s.id),
  );
  const edges = (r?.mechanisms ?? [])
    .filter(
      (m) =>
        m.isCurrent &&
        m.reviewStatus !== "rejected" &&
        statements.has(m.statementId) &&
        ids.has(m.from) &&
        ids.has(m.to),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return [...new Set(edges.map((m) => m.from))].sort().map((start) => {
    const nodes = new Set([start]),
      mechanisms: string[] = [];
    let frontier = [start];
    for (let depth = 0; depth < 3; depth++) {
      const next: string[] = [];
      for (const id of frontier)
        for (const m of edges) {
          if (
            m.from !== id ||
            mechanisms.includes(m.id) ||
            mechanisms.length >= 7
          )
            continue;
          mechanisms.push(m.id);
          if (!nodes.has(m.to)) {
            nodes.add(m.to);
            next.push(m.to);
          }
        }
      frontier = next;
    }
    return { start, nodes: [...nodes], mechanisms };
  });
}
/** Negative z is the front. Hysteresis avoids flickering near orientation boundaries. */
export function orientationSpotlight(
  routes: SpotlightRoute[],
  graph: ForceGraph,
  projected: { x: number; y: number; z: number }[],
  previous?: string,
) {
  const ranked = routes
    .flatMap((route) => {
      const i = graph.nodes.findIndex((n) => n.id === `K:${route.start}`),
        p = projected[i];
      if (!p) return [];
      const length = Math.hypot(p.x, p.y, p.z) || 1,
        front = -p.z / length;
      return front > 0.08
        ? [{ route, score: front - (0.12 * Math.abs(p.y)) / length }]
        : [];
    })
    .sort(
      (a, b) => b.score - a.score || a.route.start.localeCompare(b.route.start),
    );
  const best = ranked[0];
  if (!best) return null;
  const old = ranked.find((x) => x.route.start === previous);
  return old && old.score >= best.score - 0.1 ? old.route : best.route;
}
