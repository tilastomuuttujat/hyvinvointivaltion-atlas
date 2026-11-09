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
