WITH visible_statements AS (
 SELECT * FROM atlas_reasoning.statements WHERE review_status<>'rejected'
), visible_mechanisms AS (
 SELECT m.* FROM atlas_reasoning.mechanism_status m JOIN visible_statements s USING(statement_id)
 WHERE m.review_status<>'rejected' AND m.is_current
), visible_steps AS (
 SELECT p.* FROM atlas_reasoning.path_step_status p JOIN visible_statements s USING(statement_id)
 WHERE p.is_current AND (p.via_mechanism_id IS NULL OR EXISTS(SELECT 1 FROM visible_mechanisms m WHERE m.mechanism_id=p.via_mechanism_id))
), valid_paths AS (
 SELECT p.* FROM atlas_reasoning.explanation_paths p WHERE p.review_status<>'rejected'
 AND (SELECT count(*) FROM visible_steps s WHERE s.path_id=p.path_id)>0
 AND (SELECT count(*) FROM visible_steps s WHERE s.path_id=p.path_id)=(SELECT count(*) FROM atlas_reasoning.path_steps s WHERE s.path_id=p.path_id)
 AND NOT EXISTS (
 SELECT 1 FROM visible_steps s LEFT JOIN visible_steps prev ON prev.path_id=s.path_id AND prev.step_no=s.step_no-1
 LEFT JOIN visible_mechanisms m ON m.mechanism_id=s.via_mechanism_id
 WHERE s.path_id=p.path_id AND (
 (s.step_no=1 AND s.via_mechanism_id IS NOT NULL) OR
 (s.step_no>1 AND (prev.step_no IS NULL OR m.mechanism_id IS NULL OR m.from_concept_id<>prev.concept_id OR m.to_concept_id<>s.concept_id))))
), visible_refs AS (
 SELECT r.* FROM atlas_reasoning.observation_source_status r
 WHERE r.publishable AND r.is_current AND r.review_status<>'rejected'
)
SELECT jsonb_build_object(
 'modelVersion',1,'generatedAt',now(),
 'policy','Toimituksellinen malli. Tarkistusta odottava yhteys ei ole hyväksytty kausaalinen selitys. Lähteen tarkistus ja väitteen näytön arviointi ovat erillisiä.',
 'clusters',coalesce((SELECT jsonb_agg(jsonb_build_object('id',cluster_id,'label',label_fi,'question',question,'definition',definition,'reviewStatus',review_status) ORDER BY sort_order) FROM atlas_reasoning.clusters WHERE review_status<>'rejected'),'[]'::jsonb),
 'memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('conceptId',cc.concept_id,'clusterId',cc.cluster_id,'rationale',cc.rationale,'reviewStatus',cc.review_status) ORDER BY cc.cluster_id,cc.concept_id) FROM atlas_reasoning.concept_clusters cc JOIN atlas_reasoning.clusters c USING(cluster_id) WHERE cc.review_status<>'rejected' AND c.review_status<>'rejected'),'[]'::jsonb),
 'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.source_id,'title',s.title,'url',s.url,'kind',s.source_kind,'version',s.source_version,'publicationYear',s.publication_year,'verification',s.verification,'checkedOn',s.checked_on,'revision',s.revision_no) ORDER BY s.source_id) FROM atlas_reasoning.sources s WHERE EXISTS(SELECT 1 FROM visible_refs r WHERE r.source_id=s.source_id)),'[]'::jsonb),
 'observationSources',coalesce((SELECT jsonb_agg(jsonb_build_object('observationId',observation_id,'sourceId',source_id,'locator',locator,'verification',verification,'reviewStatus',review_status,'isCurrent',is_current) ORDER BY observation_id,source_id) FROM visible_refs),'[]'::jsonb),
 'statements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',statement_id,'title',title,'text',statement_text,'kind',statement_kind,'scope',scope,'conditions',conditions,'limitations',limitations,'start',start_year,'end',end_year,'revision',revision_no,'reviewStatus',review_status) ORDER BY statement_id) FROM visible_statements),'[]'::jsonb),
 'statementConcepts',coalesce((SELECT jsonb_agg(jsonb_build_object('statementId',sc.statement_id,'conceptId',sc.concept_id,'rationale',sc.rationale) ORDER BY sc.statement_id,sc.concept_id) FROM atlas_reasoning.statement_concepts sc JOIN visible_statements s USING(statement_id)),'[]'::jsonb),
 'evidenceLinks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.evidence_link_id,'observationId',e.observation_id,'statementId',e.statement_id,'relation',e.relation_type,'rationale',e.rationale,'applicability',e.applicability,'limitations',e.limitations,'assessmentBasis',e.assessment_basis,'causalEffectIdentified',e.causal_effect_identified,'reviewStatus',e.review_status,'isCurrent',e.is_current) ORDER BY e.evidence_link_id) FROM atlas_reasoning.evidence_link_status e JOIN visible_statements s USING(statement_id) WHERE e.publishable AND e.is_current AND e.review_status<>'rejected'),'[]'::jsonb),
 'statementRelations',coalesce((SELECT jsonb_agg(jsonb_build_object('from',r.from_statement_id,'to',r.to_statement_id,'relation',r.relation_type,'rationale',r.rationale,'limitations',r.limitations,'reviewStatus',r.review_status,'isCurrent',r.is_current) ORDER BY r.from_statement_id,r.to_statement_id) FROM atlas_reasoning.statement_relation_status r JOIN visible_statements a ON a.statement_id=r.from_statement_id JOIN visible_statements b ON b.statement_id=r.to_statement_id WHERE r.is_current AND r.review_status<>'rejected'),'[]'::jsonb),
 'mechanisms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',mechanism_id,'from',from_concept_id,'to',to_concept_id,'label',label_fi,'explanation',explanation,'conditions',conditions,'limitations',limitations,'basis',relation_basis,'direction',effect_direction,'statementId',statement_id,'reviewStatus',review_status,'isCurrent',is_current) ORDER BY mechanism_id) FROM visible_mechanisms),'[]'::jsonb),
 'conclusionBridges',coalesce((SELECT jsonb_agg(jsonb_build_object('statementId',b.statement_id,'conclusionId',b.conclusion_id,'relation',b.relation_type,'rationale',b.rationale,'reviewStatus',b.review_status,'isCurrent',b.is_current) ORDER BY b.statement_id,b.conclusion_id) FROM atlas_reasoning.conclusion_bridge_status b JOIN visible_statements s USING(statement_id) JOIN atlas_editing.conclusions c ON c.id=b.conclusion_id WHERE b.is_current AND b.review_status<>'rejected' AND c.review_status<>'rejected'),'[]'::jsonb),
 'paths',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.path_id,'title',p.title,'introduction',p.introduction,'limitations',p.limitations,'reviewStatus',p.review_status,'steps',(SELECT jsonb_agg(jsonb_build_object('order',s.step_no,'conceptId',s.concept_id,'statementId',s.statement_id,'viaMechanismId',s.via_mechanism_id,'caption',s.caption) ORDER BY s.step_no) FROM visible_steps s WHERE s.path_id=p.path_id)) ORDER BY p.path_id) FROM valid_paths p),'[]'::jsonb)
) reasoning
