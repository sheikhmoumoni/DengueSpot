# Final scaffold security review — 2026-10-08

Scope: generated local DengueSpot source, synthetic data, unit/API/PostGIS/browser checks, compiled browser bundle and Terraform configuration. Review follows `PENTEST_PLAN.md`. This is a developer self-review, not an independent penetration test, legal opinion or production certification. No third-party systems were attacked and no live provider credentials were used.

## Verification record

| Check | Actual result |
|---|---|
| Install / lockfile | pnpm 10.28.2 workspace installation succeeded; framework versions pinned, lockfile supplied |
| ESLint | Passed, including final source/tool additions |
| TypeScript strict | Passed for domain/worker/tests and Next web |
| Unit | 33 passed: privacy/workflow/schema/token/QR/CSV/media/retention/worker |
| Integration | 12 passed: 7 HTTP/service cases plus 5 real PostgreSQL/PostGIS cases, no skipped DB cases in verified run |
| Browser E2E | 20 passed across desktop Chromium and Pixel 7 emulation (2.6 minutes), including online/offline, full authority workflow, QR image, privacy, accessibility and unavailable-tile-provider fallback |
| Production build | Passed; standalone output starts successfully on loopback port 3000; health/readiness return success |
| Production browser smoke | Officer login passed; both homepages have zero automated WCAG A/AA violations; desktop/mobile screenshots reviewed with real map tiles |
| Production dependency audit | No known vulnerabilities reported after MapLibre/Sharp upgrades |
| Static security scan | Passed patterns for unsafe HTML, wildcard CORS, private logging, public service secrets, security TODOs, public storage and hard-coded provider keys |
| Browser bundle review | No service-role credential/signing pepper/audit key/OpenAI key names in compiled static chunks; 27 browser files checked against actual configured secret values with zero matches; no `.env` in standalone output |
| Terraform | `fmt`, backend-free `init` and `validate` passed using Terraform 1.13.5 / AWS provider 6.68.0; no authenticated plan/apply |
| Docker | Unverified: Docker executable/daemon unavailable; CI build targets supplied |
| Hosted CI / staging / production | Unverified: no GitHub execution or cloud credentials/deployment |

Fresh-database CLI verification also passed: both migrations applied, seed created 21 synthetic reports, second seed preserved the dataset, `worker --once` completed and retention dry-run completed without deletion.

After the selected-navigation contrast correction, the expanded home/report accessibility tests also passed on both browser projects (2 tests, four locale/page combinations per project).

## Passed behavioral controls

| Pentest case | Evidence / outcome |
|---|---|
| AUTH-01/02 | Anonymous private access 401; wrong-jurisdiction officer 403; role forged in payload rejected |
| AUTH-03 | Moderator cannot fetch original-quality evidence; system admin cannot fetch officer private GPS; runtime DB group cannot rewrite profiles |
| PRIV-01 | Explicit public serializer omits exact GPS, accuracy, owner, client UUID, hashes and object keys; text/images held until human privacy review |
| MEDIA-01 | JPEG/PNG/WebP signatures and MIME must match; SVG/oversize/pixel bombs rejected; EXIF absent from stored original and derivative |
| WEB-01/WRITE-01 | React text rendering, no unsafe HTML API, strict schemas, static identifiers/parameterized SQL; no request-provided role grants |
| WRITE-02/OFFLINE-01 | Stable client UUID/idempotency gives one report and same private credential; conflicting content rejects; offline retry tested |
| QR-01 | Signed site tokens reject tampering/expiry; public QR carries no private credential; scanner limits local navigation |
| AI-01 | Malformed assessment rejected; advisory schema cannot drive workflow; worker refuses disabled/without-consent/without-reviewed-media jobs |
| CSV-01 | Formula prefixes including leading whitespace/control characters receive safe quoting/apostrophe |
| RIGHTS-01 | Public ID alone cannot access/delete; owner token can download/delete and retrieve receipt; release after deletion is rejected |
| CSRF-01 | Cross-origin writes fail; strict cookies; no wildcard CORS |
| WEBHOOK-01 | Optional SMS callbacks fail closed while disabled; a configured contract remains required |
| AUDIT-01 | Real DB triggers reject event deletion/audit mutation; runtime role lacks update/delete grants; status+event+audit transaction rolls back together |
| AVAIL-01 | Streamed JSON/multipart bounded independently of Content-Length; optional provider failure does not block reporting; retry limit and legal hold tested |

Manual searches reviewed `exactLocation`/`exact_location` usage: only private domain state, authorized detail/owner export, internal spatial SQL and negative tests. Private responses and media use `no-store`; the service worker bypasses every API and private route. Log statements output error type/request ID or job/retention metrics, never raw request bodies, phone/OTP/token/GPS/photo. Storage buckets are private by design and neither checked-in code nor browser bundles contain real provider keys. Generated local `.env` is ignored; it contains demo-only random secrets and is not a repository artifact.

Redirect review: QR navigation checks same origin and a strict report path; login/logout navigate fixed local paths; signed media helpers do not accept arbitrary keys/hosts. Manual browser XSS/SQL adversarial testing remains part of the independent test scope. Source search alone does not prove the absence of every possible secret or injection flaw.

## Fixed findings

1. Upgraded MapLibre to 6.4.1 and Sharp to 0.35.5 after the production audit reported a sanitizer advisory and image-library advisories. The repeat audit is clean. Sources: [MapLibre advisory](https://github.com/advisories/GHSA-jrc7-96c5-q579), [Sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).
2. Awaited transactional API promises inside the error wrapper so rejected authorization/validation failures receive controlled responses.
3. Darkened muted UI labels and selected navigation after automated contrast failures; home and reporting screens are checked on desktop/mobile in both locales.
4. Re-encoded both image variants to remove EXIF, rather than retaining a private metadata-bearing original.
5. Added cross-process demo-file locking and deterministic ordering for chained DB audit records.
6. Reset public review after new resolution evidence; prohibit publishing withdrawn/rejected/archived content; preserve correct moderation event `from` state.
7. Bounded body reads during streaming; added minimal trusted-server DB permissions; included admin in real-mode MFA gate.
8. Corrected retention to use each photo's upload date, preserving fresh late after-photos; added legal-hold and worker-failure tests.
9. Replaced an unavailable default raster endpoint after visual production QA found API-key placeholder tiles. OSM attribution remains visible on mobile; cross-origin referrers send origin only. Automated E2E uses a local unavailable provider to test labeled fallback without accessing public tile infrastructure. Default-provider usage follows the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/); production needs an approved tile service.
10. Extended the map fallback deadline to cover dynamic library loading and renderer startup, not only tile loading; desktop/mobile failure-path retests pass.

## Open risks and human pentest scope

The release blockers and residual risks are enumerated in `IMPLEMENTATION_STATUS.md`; none is silently waived. Highest priorities are complete real MFA/session recovery, query/job-lock scale refactor, object-cleanup reconciliation, signed direct uploads/host limits, staffed privacy review or real redaction, immutable-note/tombstone/backup retention, edge abuse controls, deployed TLS/headers/CSP verification, container scans and backup restore drills.

Independent testers must exercise every role against every private endpoint/media variant; inspect live browser/cache/network traces; test Supabase/RDS/S3 grants with real runtime identities; probe IDOR/CSRF/XSS/SQL/error timing, duplicate-location inference, multipart/parser/resource exhaustion, lost-response concurrency, job replay and object deletion failure. Test signed URLs for lifetime/scope, custom map attribution, MFA recovery, key rotation, audit continuity, export abuse and operational incident controls. Broaden automated accessibility with screen readers, keyboard-only navigation, 200% zoom and actual low-end Bangla Android devices.

The app provides image validation, not antivirus certification or face/plate redaction. A human moderator can accidentally attest unsafe content. Snapped points and aggregate suppression do not guarantee anonymity. Demo memory throttling and shared anonymous DB counters are not a production abuse service. Current JSONB snapshots/global transactions are a bottleneck. Sentry/alert delivery, OTP, SMS/IVR, privacy case management and general admin screens remain unwired. Terraform's reference runtime still needs replacement of the DB-owner secret with the supported dedicated login.

## Bangladesh legal review

Counsel must establish current applicable law and review lawful basis/consent, notices and supported rights, image/location treatment, children/vulnerable users, municipal data sharing, cross-border storage/processors, optional AI/SMS handling, retention/holds/backups, immutable accountability records and incident notification obligations. Do not infer compliance from a consent checkbox or from this report. No statutory deadlines or legal interpretations from the supplied blueprint were assumed valid.

Environmental education links to [WHO prevention guidance](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue), checked 2026-10-08. Product wording makes no diagnosis, confirmed mosquito-species, outbreak or infection-risk claim.
