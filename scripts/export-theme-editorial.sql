SELECT jsonb_build_object('insights',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'insight_id',insight_id,'title',title,'insight_text',insight_text,'reader_question',reader_question,
 'counterexample',counterexample,'limitations',limitations,'editorial_status',editorial_status))
 FROM atlas_reasoning.insights WHERE editorial_status<>'rejected'),'[]'::jsonb)) editorial;
