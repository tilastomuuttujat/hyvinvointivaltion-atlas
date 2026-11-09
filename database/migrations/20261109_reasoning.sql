-- Additive migration. Run as atlas_editor_owner in a transaction.
-- Existing observations, article approvals and source verification are not changed.
CREATE SCHEMA IF NOT EXISTS atlas_reasoning;
REVOKE ALL ON SCHEMA atlas_reasoning FROM PUBLIC;
CREATE TABLE IF NOT EXISTS atlas_reasoning.clusters (
 cluster_id text PRIMARY KEY, label_fi text NOT NULL, question text NOT NULL,
 definition text NOT NULL, sort_order integer NOT NULL,
 review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected'))
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.concept_clusters (
 concept_id text REFERENCES atlas_evidence.concepts(concept_id),
 cluster_id text REFERENCES atlas_reasoning.clusters(cluster_id),
 rationale text NOT NULL, review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 PRIMARY KEY(concept_id,cluster_id)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.sources (
 source_id text PRIMARY KEY, title text NOT NULL, url text NOT NULL CHECK(url ~ '^https?://'),
 source_kind text NOT NULL CHECK(source_kind IN ('statistical','research')),
 source_version text NOT NULL, publication_year integer,
 verification text NOT NULL, checked_on date, revision_no integer NOT NULL DEFAULT 1 CHECK(revision_no>0),
 UNIQUE(source_id,revision_no)
);
-- Typed foreign keys keep observation references valid across the two existing tables.
CREATE TABLE IF NOT EXISTS atlas_reasoning.observation_refs (
 observation_id text PRIMARY KEY,
 statistical_id text UNIQUE REFERENCES atlas_evidence.observations(observation_id),
 research_id text UNIQUE REFERENCES atlas_evidence.research_observations(observation_id),
 CHECK(num_nonnulls(statistical_id,research_id)=1),
 CHECK(observation_id=coalesce(statistical_id,research_id))
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.observation_sources (
 observation_id text REFERENCES atlas_reasoning.observation_refs(observation_id),
 source_id text NOT NULL, based_on_source_revision integer NOT NULL,
 locator text NOT NULL, based_on_observation_sha256 text NOT NULL CHECK(length(based_on_observation_sha256)=64),
 verification text NOT NULL, review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 PRIMARY KEY(observation_id,source_id),
 FOREIGN KEY(source_id) REFERENCES atlas_reasoning.sources(source_id)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.statements (
 statement_id text PRIMARY KEY, title text NOT NULL, statement_text text NOT NULL,
 statement_kind text NOT NULL CHECK(statement_kind IN ('empirical_claim','hypothesis','synthesis','evaluation','scenario')),
 scope text NOT NULL, conditions text NOT NULL, limitations text NOT NULL,
 start_year integer, end_year integer,
 review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 revision_no integer NOT NULL DEFAULT 1 CHECK(revision_no>0),
 CHECK((start_year IS NULL AND end_year IS NULL) OR (start_year IS NOT NULL AND end_year IS NOT NULL AND start_year<=end_year)),
 UNIQUE(statement_id,revision_no)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.statement_concepts (
 statement_id text REFERENCES atlas_reasoning.statements(statement_id),
 concept_id text REFERENCES atlas_evidence.concepts(concept_id),
 rationale text NOT NULL, PRIMARY KEY(statement_id,concept_id)
);
-- Evidential relevance is separate from source verification and editorial approval.
CREATE TABLE IF NOT EXISTS atlas_reasoning.evidence_links (
 evidence_link_id text PRIMARY KEY,
 observation_id text NOT NULL REFERENCES atlas_reasoning.observation_refs(observation_id),
 statement_id text NOT NULL, based_on_statement_revision integer NOT NULL,
 relation_type text NOT NULL CHECK(relation_type IN ('supports','challenges','limits','context_for')),
 rationale text NOT NULL, applicability text NOT NULL, limitations text NOT NULL,
 assessment_basis text NOT NULL CHECK(assessment_basis IN ('descriptive','observational','quasi_experimental','experimental','review','interpretive')),
 causal_effect_identified boolean NOT NULL DEFAULT false,
 based_on_observation_sha256 text NOT NULL CHECK(length(based_on_observation_sha256)=64),
 review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 FOREIGN KEY(statement_id) REFERENCES atlas_reasoning.statements(statement_id)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.statement_relations (
 from_statement_id text NOT NULL, from_revision integer NOT NULL,
 to_statement_id text NOT NULL, to_revision integer NOT NULL,
 relation_type text NOT NULL CHECK(relation_type IN ('supports','challenges','limits','assumption_for')),
 rationale text NOT NULL, limitations text NOT NULL,
 review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 PRIMARY KEY(from_statement_id,to_statement_id,relation_type), CHECK(from_statement_id<>to_statement_id),
 FOREIGN KEY(from_statement_id) REFERENCES atlas_reasoning.statements(statement_id),
 FOREIGN KEY(to_statement_id) REFERENCES atlas_reasoning.statements(statement_id)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.mechanisms (
 mechanism_id text PRIMARY KEY,
 from_concept_id text NOT NULL REFERENCES atlas_evidence.concepts(concept_id),
 to_concept_id text NOT NULL REFERENCES atlas_evidence.concepts(concept_id),
 label_fi text NOT NULL, explanation text NOT NULL, conditions text NOT NULL, limitations text NOT NULL,
 relation_basis text NOT NULL CHECK(relation_basis IN ('hypothesized','association','causal')),
 effect_direction text NOT NULL CHECK(effect_direction IN ('increases','decreases','conditional','unknown')),
 statement_id text NOT NULL, based_on_statement_revision integer NOT NULL,
 review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 CHECK(from_concept_id<>to_concept_id),
 CHECK(relation_basis<>'causal' OR review_status='accepted'),
 FOREIGN KEY(statement_id) REFERENCES atlas_reasoning.statements(statement_id)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.conclusion_bridges (
 statement_id text REFERENCES atlas_reasoning.statements(statement_id),
 conclusion_id integer REFERENCES atlas_editing.conclusions(id),
 based_on_statement_revision integer NOT NULL, based_on_conclusion_revision integer NOT NULL,
 relation_type text NOT NULL CHECK(relation_type IN ('supports','challenges','limits','context_for')),
 rationale text NOT NULL, review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected')),
 PRIMARY KEY(statement_id,conclusion_id),
 FOREIGN KEY(statement_id) REFERENCES atlas_reasoning.statements(statement_id)
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.explanation_paths (
 path_id text PRIMARY KEY, title text NOT NULL, introduction text NOT NULL, limitations text NOT NULL,
 review_status text NOT NULL DEFAULT 'needs_review' CHECK(review_status IN ('needs_review','accepted','rejected'))
);
CREATE TABLE IF NOT EXISTS atlas_reasoning.path_steps (
 path_id text REFERENCES atlas_reasoning.explanation_paths(path_id),
 step_no integer CHECK(step_no>0), concept_id text NOT NULL REFERENCES atlas_evidence.concepts(concept_id),
 statement_id text NOT NULL, based_on_statement_revision integer NOT NULL,
 via_mechanism_id text REFERENCES atlas_reasoning.mechanisms(mechanism_id),
 caption text NOT NULL,
 PRIMARY KEY(path_id,step_no),
 FOREIGN KEY(statement_id) REFERENCES atlas_reasoning.statements(statement_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA atlas_reasoning FROM PUBLIC;
CREATE OR REPLACE VIEW atlas_reasoning.observation_status AS
 SELECT r.observation_id,coalesce(o.source_record_sha256,q.source_record_sha256) current_sha256,
 CASE WHEN r.statistical_id IS NOT NULL THEN o.publication_hold IS FALSE AND o.source_is_published IS TRUE ELSE true END publishable
 FROM atlas_reasoning.observation_refs r
 LEFT JOIN atlas_evidence.observations o ON o.observation_id=r.statistical_id
 LEFT JOIN atlas_evidence.research_observations q ON q.observation_id=r.research_id;
CREATE OR REPLACE VIEW atlas_reasoning.evidence_link_status AS
 SELECT e.*,(s.revision_no=e.based_on_statement_revision AND o.current_sha256=e.based_on_observation_sha256) is_current,o.publishable
 FROM atlas_reasoning.evidence_links e JOIN atlas_reasoning.statements s USING(statement_id)
 JOIN atlas_reasoning.observation_status o USING(observation_id);
CREATE OR REPLACE VIEW atlas_reasoning.observation_source_status AS
 SELECT l.*,(s.revision_no=l.based_on_source_revision AND o.current_sha256=l.based_on_observation_sha256) is_current,o.publishable
 FROM atlas_reasoning.observation_sources l JOIN atlas_reasoning.sources s USING(source_id)
 JOIN atlas_reasoning.observation_status o USING(observation_id);
CREATE OR REPLACE VIEW atlas_reasoning.statement_relation_status AS
 SELECT r.*,(a.revision_no=r.from_revision AND b.revision_no=r.to_revision) is_current
 FROM atlas_reasoning.statement_relations r JOIN atlas_reasoning.statements a ON a.statement_id=r.from_statement_id
 JOIN atlas_reasoning.statements b ON b.statement_id=r.to_statement_id;
CREATE OR REPLACE VIEW atlas_reasoning.mechanism_status AS
 SELECT m.*,(s.revision_no=m.based_on_statement_revision) is_current
 FROM atlas_reasoning.mechanisms m JOIN atlas_reasoning.statements s USING(statement_id);
CREATE OR REPLACE VIEW atlas_reasoning.conclusion_bridge_status AS
 SELECT b.*,(s.revision_no=b.based_on_statement_revision AND c.revision_no=b.based_on_conclusion_revision) is_current
 FROM atlas_reasoning.conclusion_bridges b JOIN atlas_reasoning.statements s USING(statement_id)
 JOIN atlas_editing.conclusions c ON c.id=b.conclusion_id;
CREATE OR REPLACE VIEW atlas_reasoning.path_step_status AS
 SELECT p.*,(s.revision_no=p.based_on_statement_revision AND (m.mechanism_id IS NULL OR m.is_current)) is_current
 FROM atlas_reasoning.path_steps p JOIN atlas_reasoning.statements s USING(statement_id)
 LEFT JOIN atlas_reasoning.mechanism_status m ON m.mechanism_id=p.via_mechanism_id;
REVOKE ALL ON ALL TABLES IN SCHEMA atlas_reasoning FROM PUBLIC;
-- Content changes invalidate references even if a caller forgets to bump revision_no.
CREATE OR REPLACE FUNCTION atlas_reasoning.bump_statement_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.title,NEW.statement_text,NEW.statement_kind,NEW.scope,NEW.conditions,NEW.limitations,NEW.start_year,NEW.end_year)
 IS DISTINCT FROM (OLD.title,OLD.statement_text,OLD.statement_kind,OLD.scope,OLD.conditions,OLD.limitations,OLD.start_year,OLD.end_year) THEN
 NEW.revision_no := OLD.revision_no+1;
 ELSIF NEW.revision_no<OLD.revision_no THEN RAISE EXCEPTION 'Statement revision cannot decrease'; END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION atlas_reasoning.bump_source_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.title,NEW.url,NEW.source_kind,NEW.source_version,NEW.publication_year,NEW.verification,NEW.checked_on)
 IS DISTINCT FROM (OLD.title,OLD.url,OLD.source_kind,OLD.source_version,OLD.publication_year,OLD.verification,OLD.checked_on) THEN
 NEW.revision_no := OLD.revision_no+1;
 ELSIF NEW.revision_no<OLD.revision_no THEN RAISE EXCEPTION 'Source revision cannot decrease'; END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER reasoning_statement_revision BEFORE UPDATE ON atlas_reasoning.statements
 FOR EACH ROW EXECUTE FUNCTION atlas_reasoning.bump_statement_revision();
CREATE OR REPLACE TRIGGER reasoning_source_revision BEFORE UPDATE ON atlas_reasoning.sources
 FOR EACH ROW EXECUTE FUNCTION atlas_reasoning.bump_source_revision();
CREATE TABLE IF NOT EXISTS atlas_reasoning.schema_migrations (
 version text PRIMARY KEY, migration_sha256 text NOT NULL CHECK(length(migration_sha256)=64), applied_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_reasoning FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA atlas_reasoning FROM PUBLIC;
