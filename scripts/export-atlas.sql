WITH current_links AS (
 SELECT cp.*,a.article_no,a.title article_title
 FROM atlas_editing.article_conclusion_periods cp
 JOIN atlas_editing.articles a ON a.id=cp.article_id
 JOIN atlas_editing.conclusions c ON c.id=cp.conclusion_id
 WHERE cp.based_on_article_revision=a.revision_no
 AND cp.based_on_body_sha256=a.body_sha256
 AND cp.based_on_conclusion_revision=c.revision_no
 AND cp.claim_relation IN ('direct','context','counterevidence')
 AND cp.review_status<>'rejected'
), coverage AS (
 SELECT ap.period_id,
 count(*) FILTER(WHERE ap.coverage_code='A') "A",
 count(*) FILTER(WHERE ap.coverage_code='K') "K",
 count(*) FILTER(WHERE ap.coverage_code='S') "S"
 FROM atlas_editing.article_periods ap JOIN atlas_editing.articles a ON a.id=ap.article_id
 WHERE ap.based_on_article_revision=a.revision_no AND ap.based_on_body_sha256=a.body_sha256
 AND ap.review_status<>'rejected' GROUP BY ap.period_id
), cells AS (
 SELECT conclusion_id c,period_id p,
 count(*) FILTER(WHERE claim_relation='direct') direct,
 count(*) FILTER(WHERE claim_relation='context') context,
 count(*) FILTER(WHERE claim_relation='counterevidence') counter,
 count(DISTINCT article_id) articles FROM current_links GROUP BY 1,2
)
SELECT jsonb_build_object(
 'schemaVersion',1,'generatedAt',now(),'evidenceGeneratedAt',now(),'evidence',(WITH published AS (
 SELECT o.observation_id, jsonb_build_object('id',o.observation_id,'kind','statistical','title',s.title,'start',o.year,'end',o.year,'period',o.period,'population',coalesce(o.group_label,o.group_key),'value',o.value,'unit',o.unit,'valueKind',o.value_kind,'sourceUrl',o.source_url,'sourceVersion',o.source_version,'verification',o.source_validation_status) row
 FROM atlas_evidence.observations o JOIN atlas_evidence.observation_series s USING(series_key)
 WHERE o.publication_hold IS FALSE AND o.source_is_published IS TRUE
 UNION ALL
 SELECT observation_id,jsonb_build_object('id',observation_id,'kind','research_finding','title',source_title,'finding',finding_text,'start',start_year,'end',end_year,'temporalPrecision',temporal_precision,'placementPeriod',placement_period,'population',population,'design',research_design,'result',result,'limitations',limitations,'sourceUrl',source_url,'publicationYear',source_publication_year,'verification',source_verification)
 FROM atlas_evidence.research_observations
), links AS (
 SELECT a.observation_id,a.concept_id,a.relation_type,a.rationale,a.limitations,a.review_status,a.source_verification FROM atlas_evidence.all_observation_concepts a JOIN published p USING(observation_id) WHERE a.review_status<>'rejected'
), article_refs AS (
 SELECT observation_id,article_no,review_status,is_current FROM atlas_evidence.observation_article_link_status WHERE review_status<>'rejected'
 UNION ALL SELECT observation_id,article_no,review_status,is_current FROM atlas_evidence.research_article_link_status WHERE review_status<>'rejected'
)
SELECT jsonb_build_object(
 'concepts',(SELECT jsonb_agg(jsonb_build_object('id',concept_id,'label',label_fi,'definition',definition,'limitations',limitations) ORDER BY label_fi) FROM atlas_evidence.concepts),
 'observations',coalesce((SELECT jsonb_agg(row ORDER BY observation_id) FROM published),'[]'::jsonb),
 'links',coalesce((SELECT jsonb_agg(jsonb_build_object('observationId',observation_id,'conceptId',concept_id,'relation',relation_type,'rationale',rationale,'limitations',limitations,'reviewStatus',review_status,'verification',source_verification) ORDER BY concept_id,observation_id,relation_type) FROM links),'[]'::jsonb),
 'articleRefs',coalesce((SELECT jsonb_agg(jsonb_build_object('observationId',a.observation_id,'articleNo',article_no,'reviewStatus',review_status,'isCurrent',is_current) ORDER BY a.observation_id,article_no) FROM article_refs a JOIN published p USING(observation_id)),'[]'::jsonb),
 'reasoning',(WITH visible_statements AS (
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
) reasoning),
 'withheld',(SELECT count(*) FROM atlas_evidence.observations WHERE publication_hold IS NOT FALSE OR source_is_published IS NOT TRUE)
) evidence),
 'source','Neon / atlas_editing; nykyiset revisiot, hylätyt kytkennät poistettu',
 'reviewPolicy','Mukana myös tarkistusta odottavat kytkennät. Linkki ei ole kausaalisen vaikutuksen todiste.',
 'atlas',jsonb_build_object(
 'periods',(SELECT jsonb_agg(jsonb_build_object('id',p.id,'label',p.label,'start',p.start_year,'end',p.end_year,'coverage',jsonb_build_object('A',coalesce(c."A",0),'K',coalesce(c."K",0),'S',coalesce(c."S",0))) ORDER BY p.sort_order) FROM atlas_editing.periods p LEFT JOIN coverage c ON c.period_id=p.id),
 'conclusions',(SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'claim',claim_text,'kind',claim_kind,'limitations',limitations,'reviewStatus',review_status) ORDER BY id) FROM atlas_editing.conclusions),
 'cells',coalesce((SELECT jsonb_agg(to_jsonb(cells) ORDER BY c,p) FROM cells),'[]'::jsonb),
 'articleCount',(SELECT count(*) FROM atlas_editing.articles)),
 'treatments',coalesce((SELECT jsonb_agg(jsonb_build_object('conclusionId',l.conclusion_id,'articleNo',l.article_no,'articleTitle',l.article_title,'periodId',l.period_id,'relation',l.claim_relation,'treatment',l.treatment_text,'evidence',l.evidence_text,'limitations',l.limitations,'reviewStatus',l.review_status,'concepts',coalesce((SELECT jsonb_agg(DISTINCT trim(link->>'concept')) FROM atlas_editing.article_structures s CROSS JOIN LATERAL jsonb_array_elements(s.payload->'links') link WHERE s.article_id=l.article_id AND s.based_on_article_revision=l.based_on_article_revision AND link->>'block'=l.period_id AND link->>'conclusion_id'=l.conclusion_id::text AND nullif(trim(link->>'concept'),'') IS NOT NULL),'[]'::jsonb)) ORDER BY l.conclusion_id,p.sort_order,l.article_no) FROM current_links l JOIN atlas_editing.periods p ON p.id=l.period_id),'[]'::jsonb)
) snapshot;

