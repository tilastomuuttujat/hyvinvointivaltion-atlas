// Pure model for the Päättelyketju view: recorded phenomenon chains and state transitions only.
export type ChainPhenomenon = { id: string; title: string; start: number; end?: number; kind?: string; question?: string; change?: string; learning?: string; status: string };
export type ChainMembership = { member: string; parent: string; relation: string; question?: string };
export type ChainTransition = { id: string; phenomenon: string; from?: number; to?: number; situation?: string; constraints?: string; trigger?: string; changed?: string; improved?: string; unresolved?: string; remaining?: string; groups?: string; claim?: string };
export type ChainBundle = { generatedAt: string; phenomena: ChainPhenomenon[]; memberships: ChainMembership[]; transitions: ChainTransition[]; traces: { phenomenon: string; text: string }[] };

export const RING_START = 1500, RING_END = 2050;
/** Year → degrees clockwise from top; 1500 at -150°, 2050 at +150°, gap at the bottom. */
export function yearAngle(year: number): number {
  const t = (Math.min(RING_END, Math.max(RING_START, year)) - RING_START) / (RING_END - RING_START);
  return -150 + t * 300;
}

export function chainIndex(b: ChainBundle) {
  const byId = new Map(b.phenomena.filter((p) => Number.isFinite(p.start)).map((p) => [p.id, p]));
  const members = new Map<string, ChainMembership[]>();
  const parents = new Map<string, ChainMembership[]>();
  for (const m of b.memberships) {
    if (!byId.has(m.member) || !byId.has(m.parent)) continue;
    (members.get(m.parent) ?? members.set(m.parent, []).get(m.parent)!).push(m);
    (parents.get(m.member) ?? parents.set(m.member, []).get(m.member)!).push(m);
  }
  const roots = [...members.keys()].map((id) => byId.get(id)!).sort((a, z) => a.start - z.start);
  return { byId, members, parents, roots };
}

/** Members of a chain in chronological order (start year, then title). */
export function chainOrder(b: ChainBundle, parentId: string): ChainPhenomenon[] {
  const { byId, members } = chainIndex(b);
  return (members.get(parentId) ?? [])
    .map((m) => byId.get(m.member)!)
    .sort((a, z) => a.start - z.start || a.title.localeCompare(z.title, "fi"));
}

/** Recorded anatomy of one phenomenon: its transitions in order and present-day traces. */
export function anatomy(b: ChainBundle, id: string) {
  return {
    transitions: b.transitions.filter((t) => t.phenomenon === id).sort((a, z) => (a.from ?? 0) - (z.from ?? 0)),
    traces: b.traces.filter((t) => t.phenomenon === id).map((t) => t.text),
  };
}
