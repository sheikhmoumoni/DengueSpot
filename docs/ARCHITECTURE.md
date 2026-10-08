# Architecture and schema/API freeze

```mermaid
flowchart TD
 Citizen[Citizen PWA / IndexedDB] --> API[Next.js API / Zod / rate limits]
 Officer[Supabase identity or explicit local demo session] --> API
 API --> Domain[Domain services / RBAC / transitions]
 Domain --> DB[PostgreSQL + PostGIS / demo file repository]
 API --> Media[Private storage / bounded Sharp decode]
 DB --> Jobs[Durable provider jobs]
 Jobs --> Worker[Worker / retention / optional adapters]
 Media --> Review[Human privacy review before public release]
 API --> Public[Allowlist public DTO / coarse points]
```

Trust boundaries: public client, authenticated citizen, authority scoped to membership/jurisdiction, moderator, privacy/security, infrastructure. Roles never come from request bodies or user-editable metadata. Supabase identity is verified server-side; controlled application profiles define roles and database memberships define jurisdiction scopes. Development sessions are unavailable outside explicit demo mode. Database and service keys stay on the server.

```mermaid
erDiagram
 profiles ||--o{ organization_memberships : has
 authority_organizations ||--o{ jurisdictions : contains
 jurisdictions ||--o{ reports : routes
 reports ||--|| report_locations_private : protects
 reports ||--o{ report_media : evidences
 reports ||--o{ report_events : records
 reports ||--o{ report_assignments : assigns
 reports ||--o{ verifications : verifies
 reports ||--o{ consents : authorizes
 reports ||--o{ moderation_cases : moderates
 reports ||--o{ data_subject_requests : requests
 reports ||--o{ provider_jobs : queues
```

Primary contracts: UUID internal/client IDs, random public ID, hashed private tracking token; reports never embed exact coordinates. Private-location table contains geography(Point,4326); public geometry is a snapped point. Spatial lookup uses ST_Covers and duplicate search uses ST_DWithin with GiST indexes. Read/write boundary schemas disallow extra fields. Public serializers use explicit allowlists. Privileged mutations run in repository transactions and create chained audit entries. API base `/api/v1`; see API.md for frozen endpoints. Media keys are random, private and never accepted as arbitrary remote URLs.

The ER diagram is the intended contract topology. Active repositories persist reports, private locations, media, events, audits, jurisdictions, profiles, sessions, rights requests and provider jobs; memberships are read directly for real identity scopes. Other requested tables reserve integration contracts and do not yet have dedicated normalized writers. The Postgres implementation currently reads JSONB state snapshots under a global transaction advisory lock, with real spatial SQL for routing/duplicates. Replace this with scoped queries and lease-based jobs before production scale. Runtime uses the constrained `denguespot_runtime` permission group from migration 002; schema-owner credentials are for migrations only.
