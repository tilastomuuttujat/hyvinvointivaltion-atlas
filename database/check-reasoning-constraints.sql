-- Run only on the temporary validation branch. Inner block rolls changes back.
DO $$
BEGIN
 BEGIN
  INSERT INTO atlas_reasoning.concept_clusters(concept_id,cluster_id,rationale) VALUES ('missing_concept','capacity','invalid FK test');
  RAISE EXCEPTION 'Foreign key test failed';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO atlas_reasoning.observation_refs(observation_id) VALUES ('invalid-reference');
  RAISE EXCEPTION 'Typed observation test failed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE atlas_reasoning.evidence_links SET causal_effect_identified=true WHERE evidence_link_id='rtw-result-support';
  RAISE EXCEPTION 'Unreviewed causal evidence test failed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE atlas_reasoning.statements SET statement_text=statement_text||' (revision test)' WHERE statement_id='rtw-study-result';
  IF (SELECT revision_no FROM atlas_reasoning.statements WHERE statement_id='rtw-study-result')<>2 THEN RAISE EXCEPTION 'Automatic revision did not advance'; END IF;
  IF EXISTS(SELECT 1 FROM atlas_reasoning.evidence_link_status WHERE statement_id='rtw-study-result' AND is_current) THEN RAISE EXCEPTION 'Stale evidence remained current'; END IF;
  IF EXISTS(SELECT 1 FROM atlas_reasoning.mechanism_status WHERE mechanism_id='accommodation-to-rtw' AND is_current) THEN RAISE EXCEPTION 'Stale mechanism remained current'; END IF;
  IF EXISTS(SELECT 1 FROM atlas_reasoning.path_step_status WHERE path_id='work-accommodation-pilot' AND step_no<=2 AND is_current) THEN RAISE EXCEPTION 'Stale path remained current'; END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='Expected rollback of revision test';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
END;
$$;
