SELECT
 (SELECT count(*) FROM atlas_reasoning.clusters) clusters,
 (SELECT count(*) FROM atlas_reasoning.concept_clusters) memberships,
 (SELECT count(*) FROM atlas_reasoning.observation_sources) source_references,
 (SELECT count(*) FROM atlas_reasoning.statements) statements,
 (SELECT count(*) FROM atlas_reasoning.evidence_links) evidence_links,
 (SELECT count(*) FROM atlas_reasoning.mechanisms) mechanisms,
 (SELECT count(*) FROM atlas_reasoning.explanation_paths) paths,
 (SELECT count(*) FROM atlas_evidence.concepts c WHERE NOT EXISTS(SELECT 1 FROM atlas_reasoning.concept_clusters m WHERE m.concept_id=c.concept_id)) unclustered_concepts,
 (SELECT count(*) FROM atlas_reasoning.evidence_link_status WHERE NOT is_current) stale_evidence_links,
 (SELECT count(*) FROM atlas_reasoning.observation_source_status WHERE NOT is_current) stale_source_references,
 (SELECT count(*) FROM atlas_reasoning.evidence_links WHERE review_status='accepted') accepted_new_evidence_links,
 (SELECT count(*) FROM atlas_reasoning.mechanisms WHERE relation_basis='causal') causal_mechanisms,
 (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='atlas_reasoning' AND grantee='PUBLIC') public_table_grants;
