// Pure model for the five main routes (tiekartta): piecewise time scale, road geometry and stream lanes.
export type Route = { order: number; id: string; title: string; start: number; end: number; kind: string; status?: string };
export type Stage = { route: number; seq: number; title: string; start: number; end?: number; situation?: string };
export type Boundary = { from: number; to: number; year: number; title: string };
export type RouteChain = { id: string; title: string; start: number; end?: number; routes: number[]; learning?: string };
export type Intersection = { id: string; title: string; start: number; end?: number; routes: number[] };
type SnapshotYears = { start_year: number | null; end_year: number | null };
export type RoadmapSnapshot = {
  routes: (SnapshotYears & { route_order: number; phenomenon_id: string; title: string; phenomenon_kind: string; review_status: string })[];
  stages: (SnapshotYears & { route_order: number; sequence_no: number; title: string; situation: string })[];
  boundaries: { from_route_order: number; to_route_order: number; boundary_year: number; title: string }[];
  chains: (SnapshotYears & { chain_id: string; title: string; observed_change: string; route_orders: number[]; learning_point: string })[];
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
