# API contract

Base path `/api/v1`. JSON requests and responses use UTF-8. All responses are `Cache-Control: no-store`. The BFF enforces access; browser UI visibility conveys no permission. Cookie sessions use HttpOnly/SameSite Strict; production cookies are Secure. Verified Supabase bearer tokens are also accepted. Roles and jurisdiction memberships are server-provisioned, never accepted from a request body.

Owner actions may send `x-tracking-token: <private credential>`; never put this credential in a URL, QR code, logs or analytics. State-changing browser requests must be same-origin. Strict Zod schemas reject unknown fields. Mutations are rate limited; production also needs edge per-IP control. JSON bodies are bounded to 32 KB while streaming; multipart to 8 MB + 32 KB; image decoding has independent limits. Errors have `{error:{code,message},requestId}`. Typical statuses: 400 invalid format, 401 missing session, 403 denied scope, 404 hidden/absent, 409 conflicting state/idempotency, 410 removed media, 413 size, 422 validation, 429 rate limit, 503 optional provider disabled.

## Endpoints

| Method | Route | Caller / behavior |
|---|---|---|
| GET | `/health`, `/ready` | Liveness; readiness checks repository/PostGIS |
| GET | `/config` | Public non-secret configuration only |
| GET | `/auth/session` | Current server-derived actor |
| POST | `/auth/demo` | Explicit demo mode only; `{profileId,password}` |
| POST | `/auth/login` | Configured Supabase password sign-in; `{email,password}` |
| POST | `/auth/logout` | Removes local session and clears cookies |
| POST | `/media/uploads` | Consented multipart image, client UUID, kind; after-photo requires scoped authority |
| GET | `/media/{mediaId}` | Authorized derivative or human-reviewed public derivative |
| GET | `/media/{mediaId}?original=true` | Owner or matching-jurisdiction officer/supervisor; audited |
| POST | `/reports` | Guest/citizen; photo/location/consent plus `Idempotency-Key` |
| GET | `/reports` | Public allowlisted report array; optional `status`, `category` filters |
| POST | `/reports/duplicates` | `{lat,lng}`; recent nearby public suggestions |
| GET | `/reports/{publicId}` | Public record and public timeline; removed reports return 404 |
| GET | `/reports/{id}/private` | Matching-jurisdiction officer/supervisor only; precise location and private evidence metadata |
| GET | `/reports/{id}/events` | Owner or scoped authority; private history |
| GET | `/my-reports` | Signed-in citizen's own reports; anonymous browser uses saved public IDs plus local credentials |
| PATCH or POST | `/reports/{id}/status` | Scoped authority; permitted ordinary lifecycle transition |
| POST | `/reports/{id}/verify` | Scoped authority; human verification note |
| POST | `/reports/{id}/assign` | Scoped authority; verified report and nonempty cleanup-team reference |
| POST | `/reports/{id}/resolve` | Scoped authority; in-progress report plus note and after-photo media ID |
| POST | `/reports/{id}/evidence` | Scoped authority; confirms attached after-photo |
| POST | `/reports/{id}/flags` | Public; reason enum, creates moderation signal |
| POST | `/reports/{id}/duplicate` | Moderator; valid target and reason |
| GET | `/authority/dashboard`, `/analytics/authority` | Scoped operational KPI, status/category/area data |
| GET | `/authority/reports` | Scoped queue with filters |
| GET | `/authority/export` | Supervisor only; safe CSV, coarse points, no reporter credentials |
| GET | `/analytics/public` | Public aggregate counts; area breakdown suppresses counts below five |
| GET | `/moderation` | Moderator; private moderation queue and derivative references |
| POST | `/moderation/{id}` | Moderator; hide/release/reject/duplicate plus reason |
| POST | `/qr/resolve` | Validates signed/expiring site token; returns site identity payload, not exact GPS |
| POST | `/data-rights/access` | Owner; receipt and information JSON |
| POST | `/data-rights/delete` | Owner; deletes primary content/GPS/evidence, hides report; legal hold returns 409 |
| POST | `/data-rights/withdraw` | Owner; withdraws optional processing consent |
| GET | `/data-rights/requests/{receiptId}` | Owner credential; minimal receipt status |
| POST | `/webhooks/sms/{provider}` | Disabled by default; HMAC contract boundary; live integration returns 501 until configured |
| any | `/internal/ai/assess` | Explicitly forbidden public HTTP entrypoint; worker is the trust boundary |

These are scaffold endpoints. Contract-specific SMS callbacks, direct-to-storage upload grants, privacy-officer case management and general admin CRUD are not implemented. The app proxies private media through authorized `no-store` responses. Storage adapters also offer 60-second signed-read helpers, but the browser flow does not receive object URLs or use direct signed uploads.

## Report creation

First submit `multipart/form-data` to `/media/uploads`: `photo` = JPEG/PNG/WebP file, `clientReportId` = random UUID, `kind=before`, `consent=true`. Receives `{mediaId,privacyReviewRequired:true}`. The client requires a real consent action before upload. Captured timestamps describe device-provided capture/submission time, not a forensic authenticity guarantee.

Then POST `/reports` with `Idempotency-Key` equal to `clientReportId`. The submitted device capture time is retained privately and included in the owner's information export; it is not a verified forensic timestamp:

```json
{
  "clientReportId": "4e4b27e8-8858-48cf-bd5b-f381e229ef05",
  "locale": "bn-BD",
  "category": "standing_water",
  "description": "বৃষ্টির পানি জমে আছে।",
  "locationNote": "রাস্তার পাশে",
  "location": {"lat":23.742,"lng":90.377,"accuracyMeters":15,"source":"manual"},
  "mediaId": "b82e59e8-f05a-453e-a671-23e6facddf78",
  "capturedAt": "2026-10-08T08:00:00.000Z",
  "consentVersion": "2026-10-v1",
  "consent": true
}
```

First creation returns 201; an identical retry returns the same public ID and private credential with `replayed:true`. Conflicting content for the same UUID returns 409. The server stores a hash of the tracking credential, never its plaintext. Its HMAC derivation from an unexposed random client UUID allows recovery after a lost successful response. The UUID, request hash and token hash are excluded from public and officer DTOs.

```json
{
  "report": {
    "publicId":"DSP-EXAMPLE",
    "category":"standing_water",
    "status":"submitted",
    "publicLocation":{"lat":23.7425,"lng":90.3768},
    "description":"",
    "area":"Demo Ward A"
  },
  "trackingToken":"<private high-entropy credential>",
  "replayed":false
}
```

Response example is abbreviated; see the actual public DTO and OpenAPI schema. The exact submitted point is never copied into a public response. Snapping reduces location precision; it is not a mathematical anonymity guarantee.

## Lifecycle and moderation

Normal sequence: `submitted → under_review → verified → assigned → in_progress → resolved`. Verification requires an observation note of at least three characters, assignment a nonempty team reference, resolution an uploaded after-photo belonging to the report plus an action note. Team references are officer-entered labels, not a validated team registry. Supervisor-only reopening is `resolved → in_progress`. Server transitions add events, chained audit records and durable notification jobs in a transaction. AI cannot invoke them.

```json
{"status":"under_review","note":"Inspect reported environment"}
```

```json
{"note":"Standing water observed; cleanup required"}
```

```json
{"assignee":"demo-officer-a","note":"Assigned for safe cleanup"}
```

```json
{"mediaId":"a6392159-1397-49c7-a87a-044b399b1eea","note":"Removed standing water and cleared the container"}
```

Moderation release is a **human privacy attestation** on all attached derivatives and description, not an automatic redaction step:

```json
{"action":"release","reason":"Checked description and every photo; no identifying content remains"}
```

Withdrawn, rejected and archived reports cannot be released. Hiding removes public access immediately. Only initial reports can be rejected or linked as duplicates. Before/after images remain private until reviewed.

## Rights and QR

Rights POST body is `{publicId:"DSP-…"}` with owner session or private tracking header. Access downloads the submitter's content, exact location, consent version, media hashes and status history. Deletion removes primary content and objects; immutable logs, minimal report tombstone/token hash, backups and object versions have separate retention obligations. Receipt retrieval requires ownership even after deletion. Legal holds need a human privacy review; no automated legal decision is claimed.

Public report QR codes encode a same-origin `/{locale}/r/{publicId}` URL. The scanner decodes images locally, validates the origin and path, discards query/hash components and never uploads the QR image. The separate signed site-token utility uses HMAC, schema/version and expiry checks; site provisioning/official QR deployment remains external.
