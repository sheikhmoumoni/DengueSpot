# DengueSpot product contract

Bangla-first environmental reporting PWA, piloting synthetic Demo City in Dhaka. Reports describe suspected breeding conditions; verification means an actionable environmental condition, never a diagnosis. No government endorsement, patient records, NID, phone requirement, payment or AI dependency.

## P0 acceptance

Anonymous or development-authenticated citizens submit a JPEG/PNG/WebP photo, GPS/manual coordinate and accuracy, category, optional Unicode description and explicit versioned consent. Server assigns jurisdiction, separates exact GPS from a 150 m public grid and issues a random private tracking credential stored as a keyed hash. A stable client UUID makes network retries idempotent. Nearby reports within 75 m and seven days are suggestions, never automatically merged.

Public users see approved sanitized evidence, public IDs, coarse positions and status only. New evidence is withheld from public release pending human privacy review when automated redaction is unavailable. Lists remain usable when maps fail. No contact details or exact household addresses are public.

Jurisdiction-authorized officers review, verify, assign, start work and resolve with an after-photo and note. Moderators hide/reject or merge with a reason. State changes and private access create audit events. System administrators have no ordinary private-report privilege. Citizens track and request access/deletion with their credential. A stalled case remains visibly unresolved; configurable age targets are operational targets, not legal deadlines.

## Delivery modes

`DATA_BACKEND=demo` uses an explicitly labeled synthetic local dataset and development sessions; only enabled with `DEMO_MODE=true`. It is not a municipal integration. Production requires PostgreSQL/PostGIS, Supabase bearer authentication, private media storage, configured secrets and a staffed privacy review process. All external vendors are optional adapters. Offline drafts are stored on the device with a clear discard action, then retried after reconnection. Authority and private API responses are never cached by the service worker.

## Success and boundaries

Measure completed submissions, review backlog, evidence coverage and resolution time. Report density is not dengue incidence. Legal review, native Bangla copy review, manual accessibility review, independent pentest, real jurisdiction polygons and processor contracts are release prerequisites. No claim of production certification follows from this scaffold.
