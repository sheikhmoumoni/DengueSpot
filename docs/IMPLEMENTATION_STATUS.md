# Implementation boundary and release requirements

This deliverable is an executable, tested scaffold. It is not certified as production-ready. The requested scope includes integrations and operational/legal work that cannot be honestly completed without their credentials, contracts, staff and infrastructure.

| Area | Implemented | Remaining before real service |
|---|---|---|
| Citizen funnel | Bangla/English, anonymous photo/location/category/consent, GPS/manual pin, tracking | Field usability, assisted channels and low-end real-device tests |
| Offline | IndexedDB photo/GPS draft, consent gate, stable UUID, retry/backoff, discard/expiry, anonymous shell cache | Browser storage eviction/recovery; encrypted shared-device strategy if required |
| Public map/list | Coarse points, filters, privacy explanation, offline schematic/list fallback | Approved tile hosting/terms, load testing, accessibility review of live map controls |
| Authority | Scoped dashboard/queue/private detail, review/verify/assign/progress/after-photo resolution, supervisor reopen/export | Real official boundaries, onboarding, SLA escalation, operational agreements and staff MFA screens |
| Moderation | Flags, hide/release/reject/duplicate, reason, privacy-attested publication | Real face/plate redaction or trained reviewers, appeal/escalation, staffed moderation |
| Data rights | Owner download, primary-content deletion, optional-consent withdrawal, receipt/status, legal-hold refusal | Privacy officer workflow/appeals, lawful exceptions, immutable-note/backup erasure policy |
| QR | Public-link generation, on-device camera/file image decode, origin/path validation, signed site-token utility and expiry tests | Official site registry/provisioning and printed field program |
| Persistence | PostgreSQL/PostGIS spatial routing/duplicates, immutable logs, RLS, least-privilege group, local demo | Query-oriented scale refactor; current global lock/state snapshots are a throughput limit |
| Media | Signature/MIME/size/pixel checks, bounded decode, EXIF removal, SHA-256, private local/Supabase/S3 adapters | Malware scanning/quarantine as required; direct signed upload flow; independent parser/abuse testing |
| Authentication | Random hashed demo sessions, real Supabase password/Bearer verification, membership lookup, staff `aal2` gate | Complete MFA enrollment/challenge/recovery and refresh flow; current access cookie expires and requires sign-in |
| AI | Mock + real Responses adapter, strict advisory schema, reviewed-image-only worker gate | Separate optional-consent/scheduling UI and assessment display/evaluation. Keep disabled; no live API call tested |
| OCR/speech | Explicit mocks and Google REST adapters with injected OAuth callback | Credentials, client workflow, consent, provider callbacks and language evaluation |
| SMS/IVR | Mock SMS without phone/OTP retention, contract transport interfaces, signed callback boundary | Enterprise contract, real transport/payload, sender registration, OTP flow, phone privacy, replay ledger and delivery testing |
| Analytics | Descriptive operational metrics, public aggregates, small-area suppression, safe CSV | Volume/performance/privacy study; no epidemiological or disease-risk claims |
| Operations | Durable jobs, bounded retries, worker metrics, retention dry-run/execute, health, runbook | Alerts, scheduled retention, dead-letter/replay tooling, restore drill, measured SLO/RPO/RTO |
| Delivery | Lockfile, non-root Docker targets, Compose, CI/staging/prod/security workflows, AWS Terraform | Docker daemon validation, GitHub/cloud execution, immutable action/image pinning, authenticated plan and staging deployment |

## Technical residual risks

- The PostgreSQL repository reads state snapshots and serializes transactions with one advisory lock. Provider network requests may hold that lock. Replace this with scoped queries, row locks/job leases, pagination and a proper outbox before large-scale or multi-tenant use.
- Public snapping reduces precision but does not guarantee anonymity; sparse areas, photos, descriptions and repeated duplicate probes can reveal a place. Assess minimum aggregation, duplicate-query abuse controls and rural privacy before rollout.
- The default anonymous limiter is shared per scope (20 auth / 120 other writes per ten minutes); it is process-local in demo and database-backed in Postgres. It is not fair per-IP protection. Configure trusted-proxy edge controls/WAF, read throttling and monitoring before launch. Terraform includes an IP WAF rule but was not applied.
- Object deletion happens during a DB transaction but storage and PostgreSQL are not a distributed atomic transaction. Failed commits may leave unavailable evidence or orphan objects. Use a durable object-cleanup outbox and reconciliation for production.
- Private original-quality images are sanitized/re-encoded; raw EXIF-bearing source bytes are not retained. Stored SHA-256 is the input content hash, not necessarily the sanitized object's hash. This is not forensic chain-of-custody certification.
- Human publication is an attestation, not automated redaction. Never release identifiable content merely to make the public evidence panel look complete. A new after-photo resets review.
- Immutable report event notes and audit identifiers survive primary deletion. Do not put citizen-identifying text in notes; implement a legally reviewed redactable/encrypted-note architecture if complete note erasure is required. Reports retain minimal tombstones and hashed credentials for rights verification; retention for those records needs review.
- The CSP currently permits inline scripts/styles for Next.js hydration. It has frame/object restrictions and no unsafe HTML rendering; nonce-based CSP and an independent XSS test remain hardening work. HSTS/TLS and custom tile-host policy must be verified at the deployed edge.
- BFF uploads/authorized no-store media work locally. They do not fulfill a direct-to-storage signed-upload design. Supabase/S3 signed-read helpers exist, but the browser uses authorization on every proxy read. Vercel plan/request-body limits may be below the advertised 8 MB application cap.
- Google/SMS/AI enable flags are not an end-to-end integration switch. No optional vendor is required for reporting, and no real vendor/government transmission is silently simulated.
- System admin/privacy/community-verifier roles are modeled and fail closed for officer-only capabilities; full administrative, verification-voting and privacy case-management screens are not implemented.
- Default offline caching requires a prior successful visit. Device drafts and tracking credentials are not encrypted from the local browser user. Clearing browser storage can lose anonymous access.
- Docker was unavailable. Terraform format/validate succeeded, but no plan/apply or paid cloud deployment occurred. CI workflows exist; their hosted runs are unverified. AWS reference uses a DB-owner credential until replaced, and single-NAT/egress/alert/state hardening needs completion.

## External production requirements

1. Vercel or approved AWS account, region/processor approval, DNS/TLS certificate, secret manager, private storage and dedicated PostgreSQL/PostGIS runtime credentials; backup/PITR capability and restore testing.
2. Supabase identity project or equivalent verified adapter; staff MFA enrollment/challenge/recovery, onboarding/offboarding and controlled authority membership provisioning.
3. Municipal/authority agreements, official licensed jurisdiction polygons, accountable cleanup teams, realistic response commitments and escalation owners. Synthetic Dhaka boxes are not official wards.
4. Staffed privacy/moderation contact, incident response owner, retention/legal-hold decisions, deletion/appeal process, shared-device and vulnerable-user review.
5. Bangladesh counsel review of current data protection/cybersecurity/communications obligations, consent/lawful basis, notices, children, authority data sharing, image/location sensitivity, cross-border processors, backups and breach notifications. No legal-compliance conclusion is made here.
6. Enterprise SMS/IVR contract, registered sender and approved callback authentication/replay contract if enabling those channels; credentials and bilingual delivery verification. Do not substitute guessed endpoints.
7. OpenAI/Google credentials, processor terms/transfer review, separate optional consent, tested safe image redaction and advisory-quality evaluation if enabling AI/OCR/speech.
8. Independent pentest, container/image/secret scans, real-device accessibility/usability testing, abuse/load/reliability tests, staging acceptance and a documented go/no-go review.
