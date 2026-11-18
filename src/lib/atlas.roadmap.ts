// Pure model for the five main routes (tiekartta): piecewise time scale, road geometry and stream lanes.
export type Route = { order: number; id: string; title: string; start: number; end: number; kind: string; status?: string };
export type Stage = { id?: string; route: number; seq: number; title: string; start: number; end?: number; situation?: string };
export type Boundary = { from: number; to: number; year: number; title: string };
export type RouteChain = { id: string; title: string; start: number; end?: number; routes: number[]; learning?: string };
export type Intersection = { id: string; title: string; start: number; end?: number; routes: number[] };
type SnapshotYears = { start_year: number | null; end_year: number | null };
export type RoadmapSnapshot = {
  routes: (SnapshotYears & { route_order: number; phenomenon_id: string; title: string; phenomenon_kind: string; review_status: string })[];
  stages: (SnapshotYears & { route_order: number; state_id: string; sequence_no: number; title: string; situation: string })[];
  boundaries: { from_route_order: number; to_route_order: number; boundary_year: number; title: string }[];
  chains: (SnapshotYears & { chain_id: string; title: string; observed_change: string; route_orders: number[]; learning_point: string })[];
  links?: { parent_phenomenon_id: string; parent_state_id: string; chain_id: string }[];
  details?: { chain_id: string; detail_id: string; detail_kind: string; detail: Record<string, unknown> }[];
  intersections: (SnapshotYears & { phenomenon_id: string; title: string; route_orders: number[] })[];
};

export type Roadmap = { routes: Route[]; stages: Stage[]; boundaries: Boundary[]; chains: RouteChain[]; intersections: Intersection[] };

/** Visual width share per route: older centuries are compressed, the dense 1800–2025 eras get room. */
export const ROUTE_WEIGHT: Record<number, number> = { 1: 1, 2: 3.4, 3: 1.7, 4: 1.4, 5: 1.2 };
export const BREAKS = [1500, 1809, 1917, 1986, 2026, 2050];

/** Maps a year to x in [x0, x1] piecewise per route, so every era stays readable. */
export function timeScale(x0: number, x1: number) {
  const total = Object.values(ROUTE_WEIGHT).reduce((a, b) => a + b, 0);
  const edges = [x0];
  for (let i = 1; i <= 5; i++) edges.push(edges[i - 1] + ((x1 - x0) * ROUTE_WEIGHT[i]) / total);
  return (year: number) => {
    const y = Math.max(1500, Math.min(2050, year));
    let i = 0;
    while (i < 4 && y >= BREAKS[i + 1]) i++;
    const t = (y - BREAKS[i]) / (BREAKS[i + 1] - BREAKS[i]);
    return edges[i] + t * (edges[i + 1] - edges[i]);
  };
}

/** The road's gentle meander: a vertical offset as a function of x. */
export const roadY = (x: number, cy: number, amp = 46) => cy + Math.sin(x / 260) * amp + Math.sin(x / 97) * amp * 0.18;

/** Greedy interval lanes: overlapping streams get separate lanes; returns lane index per item. */
export function lanes<T extends { start: number; end?: number }>(items: T[], gap = 4): number[] {
  const ends: number[] = [];
  return items.map((it) => {
    const e = it.end ?? it.start;
    let l = ends.findIndex((v) => v + gap <= it.start);
    if (l < 0) { l = ends.length; ends.push(e); } else ends[l] = e;
    return l;
  });
}

/** Route that a year belongs to (1–5). */
export const routeOf = (year: number) => { let i = 1; while (i < 5 && year >= BREAKS[i]) i++; return i; };

/** Split a station title into at most two lines of roughly `max` characters. */
export function wrapLabel(text: string, max = 22): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur || (cur + " " + w).length <= max) lines[lines.length - 1] = cur ? cur + " " + w : w;
    else if (lines.length < 2) lines.push(w);
    else { lines[1] = (lines[1] + " " + w); }
  }
  if (lines[1] && lines[1].length > max + 2) lines[1] = lines[1].slice(0, max) + "…";
  return lines;
}

/**
 * Greedy collision-free label slots: each label (centre x, width) gets a side (-1 up, 1 down) and tier 0..n.
 * Labels alternate sides and climb tiers until they no longer overlap a previously placed label on that side.
 */
export function labelSlots(items: { x: number; w: number }[], gap = 12, maxTier = 5): { side: -1 | 1; tier: number }[] {
  const placed: { side: number; tier: number; a: number; b: number }[] = [];
  return items.map((it, i) => {
    const a = it.x - it.w / 2 - gap / 2, b = it.x + it.w / 2 + gap / 2;
    const free = (side: number, tier: number) => !placed.some((p) => p.side === side && p.tier === tier && p.a < b && a < p.b);
    const pref: (-1 | 1)[] = i % 2 === 0 ? [-1, 1] : [1, -1];
    for (let tier = 0; tier <= maxTier; tier++) {
      for (const side of pref) {
        if (free(side, tier)) { placed.push({ side, tier, a, b }); return { side, tier }; }
      }
    }
    placed.push({ side: pref[0], tier: maxTier, a, b });
    return { side: pref[0], tier: maxTier };
  });
}

export type StageContext = { era?: Route; gate?: Boundary; before?: Stage; after?: Stage; lanes: RouteChain[]; lasting: RouteChain[] };
/** Gathers what the roadmap records around a stage: its era, preceding gate and stage, the next stage, and overlapping lanes. Order only, no causal claim. */
export function stageContext(m: Roadmap, s: Stage, linked: Set<string> = new Set()): StageContext {
  const end = s.end ?? s.start;
  const era = m.routes.find((r) => r.order === s.route);
  const gate = m.boundaries.filter((b) => b.year <= s.start).sort((a, b) => b.year - a.year)[0];
  const seq = m.stages.filter((t) => t.route === s.route).sort((a, b) => a.start - b.start || a.seq - b.seq);
  const i = seq.findIndex((t) => t.seq === s.seq && t.start === s.start);
  const lanes = m.chains
    .filter((c) => linked.has(c.id) || (c.routes.includes(s.route) && c.start <= end && (c.end ?? c.start) >= s.start))
    .sort((a, b) => Number(linked.has(b.id)) - Number(linked.has(a.id)) || Math.abs(a.start - s.start) - Math.abs(b.start - s.start));
  const lasting = lanes.filter((c) => (c.end ?? c.start) >= end + 30 && !!c.learning);
  return { era, gate, before: i > 0 ? seq[i - 1] : undefined, after: i >= 0 ? seq[i + 1] : undefined, lanes, lasting };
}
