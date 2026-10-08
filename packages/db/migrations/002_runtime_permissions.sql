-- A non-login permission group. Provision a separate secret-backed login and
-- GRANT denguespot_runtime TO that_login; never use the schema owner at runtime.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='denguespot_runtime') THEN
    CREATE ROLE denguespot_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO denguespot_runtime;
GRANT SELECT ON jurisdictions, profiles, organization_memberships TO denguespot_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports, report_locations_private, report_media,
  app_sessions, data_subject_requests, provider_jobs, rate_limits TO denguespot_runtime;
GRANT SELECT, INSERT ON report_events, audit_logs TO denguespot_runtime;
GRANT USAGE, SELECT ON SEQUENCE report_events_seq_seq, audit_logs_seq_seq TO denguespot_runtime;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['jurisdictions','profiles','organization_memberships',
    'reports','report_locations_private','report_media','app_sessions',
    'data_subject_requests','provider_jobs','rate_limits','report_events','audit_logs']
  LOOP
    EXECUTE format('CREATE POLICY server_runtime ON %I TO denguespot_runtime USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;
-- This role is for the trusted BFF/worker only. It must never be granted to
-- Supabase anon/authenticated roles or exposed through a browser connection.
