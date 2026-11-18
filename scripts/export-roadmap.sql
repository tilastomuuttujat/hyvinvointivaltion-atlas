select jsonb_build_object(
  'routes', coalesce((select jsonb_agg(to_jsonb(r) order by route_order) from atlas_reasoning.main_routes r), '[]'),
  'stages', coalesce((select jsonb_agg(to_jsonb(s) order by route_order, sequence_no) from atlas_reasoning.main_route_stages s), '[]'),
  'boundaries', coalesce((select jsonb_agg(to_jsonb(b) order by boundary_year) from atlas_reasoning.main_route_boundaries b), '[]'),
  'intersections', coalesce((select jsonb_agg(to_jsonb(i) order by start_year, phenomenon_id)
    from atlas_reasoning.main_route_intersections i where review_status <> 'rejected'), '[]'),
  'chains', coalesce((select jsonb_agg(to_jsonb(c) order by start_year, chain_id)
    from atlas_reasoning.main_route_chains c where review_status <> 'rejected'), '[]'),
  'links', coalesce((select jsonb_agg(distinct jsonb_build_object(
      'membership_id', l.membership_id, 'parent_phenomenon_id', l.parent_phenomenon_id,
      'parent_state_id', l.parent_state_id, 'chain_id', l.chain_id))
    from atlas_reasoning.main_route_chain_links l), '[]'),
  'details', coalesce((select jsonb_agg(jsonb_build_object(
      'chain_id', d.chain_id, 'detail_kind', d.detail_kind, 'detail_id', d.detail_id,
      'state_id', d.state_id, 'transition_id', d.transition_id, 'explanation_id', d.explanation_id,
      'stage_title', coalesce(s.title, scenario.title), 'transition_title', t.trigger_description,
      'detail', d.detail - 'is_current')
    order by d.chain_id, d.detail_kind, d.detail_id)
    from atlas_reasoning.main_route_chain_details d
    join atlas_reasoning.main_route_chains c using(chain_id)
    left join atlas_reasoning.phenomenon_states s on s.phenomenon_id=d.chain_id and s.state_id=d.state_id
    left join atlas_reasoning.phenomenon_transitions t on t.phenomenon_id=d.chain_id and t.transition_id=d.transition_id
    left join atlas_reasoning.phenomenon_states scenario on scenario.phenomenon_id=d.chain_id and scenario.state_id=t.to_state_id
    where c.review_status <> 'rejected' and (
      d.publishable or (c.phenomenon_kind='hypothetical' and d.detail_kind in ('scenario_context','scenario_stage'))
    )), '[]')
) as roadmap;
