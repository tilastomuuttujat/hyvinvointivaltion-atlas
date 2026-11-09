-- Deliberately provisional editorial model: no inherited approval upgrades.
INSERT INTO atlas_reasoning.clusters(cluster_id,label_fi,question,definition,sort_order) VALUES
 ('participation','Työhön osallistuminen','Kuka pääsee mukaan ja kuka jää ulkopuolelle?','Työmarkkinoille pääsy, kiinnittyminen ja osallistumisen esteet.',1),
 ('labour_input','Työpanoksen käyttäminen','Kuinka paljon olemassa olevasta työpanoksesta käytetään?','Toteutunut työn määrä ja käyttökelpoisen työpanoksen hyödyntäminen.',2),
 ('capacity','Toimintakyky ja työn yhteensovittaminen','Miten ihmisen voimavarat ja työn vaatimukset kohtaavat?','Työkyky, työn mukauttaminen ja työssä jatkamisen edellytykset.',3),
 ('livelihood','Toimeentulo ja tuen saavutettavuus','Riittääkö toimeentulo ja tavoittaako tuki tarvitsevan?','Toimeentulon riittävyys, puute ja etuuksien tavoittavuus.',4)
 ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.concept_clusters(concept_id,cluster_id,rationale)
 SELECT c,k,'Toimituksellinen ryhmittely; jäsenyys ei osoita vaikutussuhdetta.' FROM (VALUES
 ('employment','participation'),('long_term_unemployment','participation'),('participation_threshold','participation'),
 ('realised_labour_input','labour_input'),('labour_input_use','labour_input'),
 ('functional_capacity','capacity'),('work_ability','capacity'),('work_accommodation','capacity'),('sustained_return_to_work','capacity'),
 ('participation_threshold','capacity'),('sustained_return_to_work','participation'),('work_ability','participation'),
 ('benefit_receipt','livelihood'),('material_social_deprivation','livelihood'),('income_adequacy','livelihood'),('benefit_non_take_up','livelihood')
 ) v(c,k) ON CONFLICT DO NOTHING;
-- Deduplicate by source URL and version. Unknown titles/verification are not invented.
INSERT INTO atlas_reasoning.sources(source_id,title,url,source_kind,source_version,verification)
 SELECT DISTINCT 'source:'||md5(o.source_url||'|'||coalesce(o.source_version,'')),o.source_url,o.source_url,'statistical',coalesce(o.source_version,''),'inherited_observation_metadata_no_new_source_check'
 FROM atlas_evidence.observations o ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.sources(source_id,title,url,source_kind,source_version,publication_year,verification,checked_on)
 SELECT 'source:'||md5(source_url||'|'||study_key),source_title,source_url,'research',study_key,source_publication_year,source_verification,source_checked_on
 FROM atlas_evidence.research_observations ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.observation_refs(observation_id,statistical_id)
 SELECT observation_id,observation_id FROM atlas_evidence.observations ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.observation_refs(observation_id,research_id)
 SELECT observation_id,observation_id FROM atlas_evidence.research_observations ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.observation_sources(observation_id,source_id,based_on_source_revision,locator,based_on_observation_sha256,verification)
 SELECT observation_id,'source:'||md5(source_url||'|'||coalesce(source_version,'')),1,
 'series='||series_key||'; year='||year||'; period='||coalesce(period,'annual')||'; group='||group_key,
 source_record_sha256,coalesce(source_validation_status,'not_recorded') FROM atlas_evidence.observations ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.observation_sources(observation_id,source_id,based_on_source_revision,locator,based_on_observation_sha256,verification)
 SELECT observation_id,'source:'||md5(source_url||'|'||study_key),1,
 CASE WHEN observation_id='research:doi-10.5271-sjweh.3664-sustained-rtw' THEN 'Abstract: Results; sustained return to work; methods and matched population' ELSE 'Source-card finding; precise page/section requires verification' END,
 source_record_sha256,source_verification FROM atlas_evidence.research_observations ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.statements(statement_id,title,statement_text,statement_kind,scope,conditions,limitations,start_year,end_year) VALUES
 ('rtw-study-result','Osasairauspoissaolo ja kestävä työhönpaluu',
 'Kaltaistetussa suomalaisessa rekisteritutkimuksessa kestävän työhönpaluun osuus oli osa-aikaisen sairauspoissaolon ryhmässä 8,0 prosenttiyksikköä suurempi kuin kokoaikaisen sairauspoissaolon vertailuryhmässä.',
 'empirical_claim','Tutkimuksen vuosina 2010–2011 alkaneet sairauspoissaolot ja kahden vuoden seuranta; tutkimuksen valintakriteerit täyttävä väestö.',
 'Kaltaistettujen ryhmien vertailu; kestävä työhönpaluu tarkoittaa vähintään 28 peräkkäistä työpäivää.',
 'Ei satunnaistettu koe. Jäljelle jäävä valikoituminen on mahdollista. Ei suora työkyvyn tai kokonaiskustannusten mittaus.',2010,2013),
 ('accommodation-participation','Mukauttaminen voi tukea työelämäyhteyttä',
 'Työn ja sairauspoissaolon mukauttaminen voi tietyissä tilanteissa auttaa säilyttämään käyttökelpoista työpanosta työelämässä.',
 'synthesis','Rajattu tulkinta osasairauspoissaolon tutkimuksesta; ei kaikkia työntekijöitä tai mukauttamiskeinoja koskeva yleislaki.',
 'Sopivan osa-aikaisen työn on oltava mahdollista ja terveydentilaan soveltuvaa.',
 'Pysyvä työhönpaluu ei yksin mittaa toteutuneiden työtuntien kokonaismäärää tai toimintakyvyn muutosta.',NULL,NULL),
 ('accommodation-fiscal-hypothesis','Julkisen talouden säästö on erillinen hypoteesi',
 'Työn mukauttaminen voi pienentää julkisen talouden pitkän aikavälin nettokustannuksia verrattuna tilanteeseen, jossa sopivaa työtä ei järjestetä.',
 'hypothesis','Julkisen talouden nettovaikutus; sama kohderyhmä ja yhteinen seuranta-aika molemmille vaihtoehdoille.',
 'Arvioon tarvitaan järjestämiskustannukset, tulonsiirrot, verotulot ja palvelumenot sekä uskottava vertailuasetelma.',
 'Nykyinen työhönpaluututkimus ei yksin osoita tätä säästöä. Hypoteesille ei ole tässä pilotissa kustannusvaikutusarviota.',NULL,NULL)
 ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.statement_concepts(statement_id,concept_id,rationale)
 SELECT s,c,'Käsite rajaa väitteen tarkastelukohteen; ei itsessään osoita näyttöä.' FROM (VALUES
 ('rtw-study-result','work_accommodation'),('rtw-study-result','sustained_return_to_work'),
 ('accommodation-participation','work_accommodation'),('accommodation-participation','labour_input_use'),('accommodation-participation','sustained_return_to_work'),
 ('accommodation-fiscal-hypothesis','work_accommodation'),('accommodation-fiscal-hypothesis','labour_input_use')
 ) v(s,c) ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.evidence_links(evidence_link_id,observation_id,statement_id,based_on_statement_revision,relation_type,rationale,applicability,limitations,assessment_basis,based_on_observation_sha256)
 SELECT 'rtw-result-support',observation_id,'rtw-study-result',1,'supports',
 'Tutkimustulos vastaa väitteen kohderyhmää, vertailua ja työhönpaluun määritelmää.',
 'Vain tutkimuksen valintakriteerit täyttävä ryhmä ja seuranta-aika.',
 'Kvasikokeellinen rekisterivertailu; ei automaattista yleistystä muihin mukautuksiin eikä kausaalisen vaikutuksen hyväksyntää.',
 'quasi_experimental',source_record_sha256 FROM atlas_evidence.research_observations WHERE observation_id='research:doi-10.5271-sjweh.3664-sustained-rtw' ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.evidence_links(evidence_link_id,observation_id,statement_id,based_on_statement_revision,relation_type,rationale,applicability,limitations,assessment_basis,based_on_observation_sha256)
 SELECT 'rtw-fiscal-limit',observation_id,'accommodation-fiscal-hypothesis',1,'limits',
 'Työhönpaluutulos ei sisällä julkisen talouden kokonaiskustannusten vertailua, joten siitä ei voi päätellä nettosäästöä.',
 'Rajaa tämän tutkimuksen käyttöä kustannushypoteesin perusteluna.',
 'Näytön puute kustannuksista ei ole näyttö säästön puuttumisesta.',
 'interpretive',source_record_sha256 FROM atlas_evidence.research_observations WHERE observation_id='research:doi-10.5271-sjweh.3664-sustained-rtw' ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.statement_relations(from_statement_id,from_revision,to_statement_id,to_revision,relation_type,rationale,limitations) VALUES
 ('rtw-study-result',1,'accommodation-participation',1,'supports','Rajattu työhönpaluutulos tukee mahdollisuutta säilyttää työelämäyhteyttä.','Yhden tutkimuksen perusteella tehty rajattu synteesi; ei koko työpanoksen mittaus.'),
 ('accommodation-participation',1,'accommodation-fiscal-hypothesis',1,'assumption_for','Osallistumisen säilyminen on yksi mahdollinen säästömekanismin edellytys.','Osallistumishyöty ei yksin ratkaise nettokustannusta.')
 ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.mechanisms(mechanism_id,from_concept_id,to_concept_id,label_fi,explanation,conditions,limitations,relation_basis,effect_direction,statement_id,based_on_statement_revision) VALUES
 ('accommodation-to-rtw','work_accommodation','sustained_return_to_work','Mukautettu työ ja työhönpaluu',
 'Osa-aikainen työ voi mahdollistaa työhönpaluun ennen kuin kokoaikainen työ on mahdollista.',
 'Terveydentilaan soveltuva työ ja tutkimuksen kaltainen kohderyhmä.',
 'Ehdotettu selitysmekanismi; tutkimus tukee tuloseroa mutta ei yksin varmista juuri tätä välittävää mekanismia.',
 'association','conditional','rtw-study-result',1),
 ('rtw-to-input','sustained_return_to_work','labour_input_use','Työelämäyhteydestä työpanoksen käyttöön',
 'Pysyvä työhönpaluu voi pitää osan työpanoksesta käytössä.',
 'Työn on jatkuttava, ja toteutuneet työtunnit sekä vertailuvaihtoehto on huomioitava.',
 'Tulkinnallinen yhteys: työhönpaluun indikaattori ei ole kokonaistyöpanoksen mitta.',
 'hypothesized','conditional','accommodation-participation',1)
 ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.conclusion_bridges(statement_id,conclusion_id,based_on_statement_revision,based_on_conclusion_revision,relation_type,rationale)
 SELECT 'accommodation-participation',id,1,revision_no,'context_for',
 'Tarjoaa työn osallistumisehtojen tarkasteluun rajatun esimerkin; ei suora testi työn optimointia koskevalle laajalle päätelmälle.'
 FROM atlas_editing.conclusions WHERE id=25 ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.explanation_paths(path_id,title,introduction,limitations) VALUES
 ('work-accommodation-pilot','Voiko mukautettu työ pitää työpanosta käytössä?',
 'Toimituksellinen esimerkkipolku: tutkimustulos, rajattu tulkinta ja avoin kustannuskysymys erotetaan toisistaan.',
 'Kaikki uudet tulkintakytkennät odottavat tarkistusta. Polku ei osoita julkisen talouden säästöä.') ON CONFLICT DO NOTHING;
INSERT INTO atlas_reasoning.path_steps(path_id,step_no,concept_id,statement_id,based_on_statement_revision,via_mechanism_id,caption) VALUES
 ('work-accommodation-pilot',1,'work_accommodation','rtw-study-result',1,NULL,'Alku: työn ja sairauspoissaolon mukauttaminen.'),
 ('work-accommodation-pilot',2,'sustained_return_to_work','rtw-study-result',1,'accommodation-to-rtw','Tutkimuksessa havaittiin ero kestävässä työhönpaluussa.'),
 ('work-accommodation-pilot',3,'labour_input_use','accommodation-participation',1,'rtw-to-input','Tulkinta: työpanosta voi säilyä käytössä. Nettosäästö jää avoimeksi.')
 ON CONFLICT DO NOTHING;
