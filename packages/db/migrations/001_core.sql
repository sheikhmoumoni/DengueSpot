CREATE EXTENSION IF NOT EXISTS postgis;
-- gen_random_uuid() is built into the supported PostgreSQL 17 runtime.
CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE profiles(id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE authority_organizations(id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE jurisdictions(id text PRIMARY KEY, data jsonb NOT NULL, boundary geometry(MultiPolygon,4326) NOT NULL);
CREATE INDEX jurisdictions_boundary_gist ON jurisdictions USING gist(boundary);
CREATE TABLE organization_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id text REFERENCES profiles(id), jurisdiction_id text REFERENCES jurisdictions(id), role text NOT NULL, UNIQUE(profile_id,jurisdiction_id));
CREATE TABLE reports(id uuid PRIMARY KEY, data jsonb NOT NULL, public_location geometry(Point,4326) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT reports_no_exact CHECK (NOT data ? 'exactLocation' AND NOT data ? 'location' AND NOT data ? 'lat' AND NOT data ? 'lng'));
CREATE UNIQUE INDEX reports_public_id ON reports((data->>'publicId'));
CREATE UNIQUE INDEX reports_client_id ON reports((data->>'clientReportId'));
CREATE INDEX reports_public_location_gist ON reports USING gist(public_location);
CREATE INDEX reports_status_jurisdiction ON reports((data->>'jurisdictionId'),(data->>'status'));
CREATE TABLE report_locations_private(report_id uuid PRIMARY KEY REFERENCES reports(id), data jsonb NOT NULL, exact_location geography(Point,4326) NOT NULL);
CREATE INDEX report_exact_location_gist ON report_locations_private USING gist(exact_location);
CREATE TABLE report_media(id uuid PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE report_events(id uuid PRIMARY KEY, seq bigserial UNIQUE NOT NULL, data jsonb NOT NULL);
CREATE INDEX report_events_report ON report_events((data->>'reportId'));
CREATE TABLE report_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id), assignee text, data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE verifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE ai_assessments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE moderation_cases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE report_flags(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE notification_preferences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE qr_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE consents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE data_subject_requests(id uuid PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE audit_logs(id uuid PRIMARY KEY, seq bigserial UNIQUE NOT NULL, data jsonb NOT NULL);
CREATE TABLE webhook_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE provider_jobs(id uuid PRIMARY KEY, data jsonb NOT NULL);
CREATE INDEX provider_jobs_pending ON provider_jobs((data->>'status'),(data->>'nextAttemptAt'));
CREATE TABLE retention_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE app_sessions(id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE rate_limits(key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
CREATE FUNCTION reject_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only record'; END $$;
CREATE TRIGGER immutable_report_events BEFORE UPDATE OR DELETE ON report_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE TRIGGER immutable_audit_logs BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
CREATE VIEW public_reports WITH (security_barrier=true) AS SELECT data->>'publicId' AS public_id, data->>'category' AS category, data->>'status' AS status, public_location, created_at FROM reports WHERE data->>'hidden'='false' AND data->>'status' NOT IN ('withdrawn','rejected','archived');
-- Supabase REST must never grant raw-table access. Server connection handles RBAC.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'spatial_ref_sys'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',t.tablename);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM anon',t.tablename); END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated',t.tablename); END IF;
  END LOOP;
END $$;
