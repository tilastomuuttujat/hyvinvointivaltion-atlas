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
 'schemaVersion',1,'generatedAt',now(),
 'source','Neon / atlas_editing; nykyiset revisiot, hylätyt kytkennät poistettu',
 'reviewPolicy','Mukana myös tarkistusta odottavat kytkennät. Linkki ei ole kausaalisen vaikutuksen todiste.',
 'atlas',jsonb_build_object(
 'periods',(SELECT jsonb_agg(jsonb_build_object('id',p.id,'label',p.label,'start',p.start_year,'end',p.end_year,'coverage',jsonb_build_object('A',coalesce(c."A",0),'K',coalesce(c."K",0),'S',coalesce(c."S",0))) ORDER BY p.sort_order) FROM atlas_editing.periods p LEFT JOIN coverage c ON c.period_id=p.id),
 'conclusions',(SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'claim',claim_text,'kind',claim_kind,'limitations',limitations,'reviewStatus',review_status) ORDER BY id) FROM atlas_editing.conclusions),
 'cells',coalesce((SELECT jsonb_agg(to_jsonb(cells) ORDER BY c,p) FROM cells),'[]'::jsonb),
 'articleCount',(SELECT count(*) FROM atlas_editing.articles)),
 'treatments',coalesce((SELECT jsonb_agg(jsonb_build_object('conclusionId',l.conclusion_id,'articleNo',l.article_no,'articleTitle',l.article_title,'periodId',l.period_id,'relation',l.claim_relation,'treatment',l.treatment_text,'evidence',l.evidence_text,'limitations',l.limitations,'reviewStatus',l.review_status) ORDER BY l.conclusion_id,p.sort_order,l.article_no) FROM current_links l JOIN atlas_editing.periods p ON p.id=l.period_id),'[]'::jsonb)
) snapshot;
