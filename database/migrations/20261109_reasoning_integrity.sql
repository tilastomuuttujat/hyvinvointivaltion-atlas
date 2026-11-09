-- Additional invariant: a causal assessment cannot be published as unreviewed.
ALTER TABLE atlas_reasoning.evidence_links ADD CONSTRAINT reviewed_causal_evidence
 CHECK(NOT causal_effect_identified OR review_status='accepted');
