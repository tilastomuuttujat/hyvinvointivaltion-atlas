type Years = { start_year: number | null; end_year: number | null };
type Named = Years & { title: string };

export type Roadmap = {
  routes: (Named & { phenomenon_id: string; route_order: number })[];
  stages: (Named & {
    phenomenon_id: string;
    state_id: string;
    situation: string;
  })[];
  boundaries: {
    boundary_year: number;
    title: string;
    from_route_id: string;
    to_route_id: string;
    from_state_id: string;
    to_state_id: string;
  }[];
  intersections: (Named & {
    phenomenon_id: string;
    route_orders: number[];
    links: { route_id: string; state_id: string }[];
  })[];
  chains: (Named & {
    chain_id: string;
    phenomenon_kind: string;
    reader_question: string;
    observed_change: string;
    review_status: string;
  })[];
  links: {
    membership_id: string;
    parent_phenomenon_id: string;
    parent_state_id: string;
    chain_id: string;
  }[];
  details: {
    chain_id: string;
    detail_kind: string;
    detail_id: string;
    stage_title: string | null;
    transition_title: string | null;
    detail: Record<string, unknown>;
  }[];
};
