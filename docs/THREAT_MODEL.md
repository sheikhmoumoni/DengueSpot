# Threat model — ASVS 5.0 baseline

Assets: exact GPS, evidence, reporter credentials, authority sessions, jurisdictions, event integrity, service credentials and queue availability. Actors: public reporter, abusive reporter, scoped authority, moderator, privacy officer, infrastructure operator and compromised processor. DFD and trust boundaries are in ARCHITECTURE.md.

| STRIDE | Attack surface | Mitigation / verification |
|---|---|---|
| Spoofing | session, tracking, QR | verified server session; hashed tokens; expiring HMAC QR; tamper tests |
| Tampering | offline payload, status, media, webhook | strict schemas; server transitions; immutable events; actual decoding; signed webhook |
| Repudiation | privileged actions, private reads | append-only chained audit and immutable event trigger |
| Information disclosure | map, exports, media, caches, logs | DTO allowlist, separate GPS, private storage, scoped media checks, no-store, no GPS logs |
| Denial of service | image bombs, spatial query, submissions, AI | bounded bytes/pixels/radius/page; rate adapter; queue backoff; AI optional |
| Elevation | IDOR, cross-ward, mass assignment, admin | server RBAC; membership lookup; jurisdiction checks; no default infrastructure access |

Additional cases: stored Bangla/English XSS, SQL injection, CSRF, origin spoofing, phone enumeration, OTP brute force, path traversal, MIME/polyglot, signed URL leakage, QR replay, CSV formula injection, duplicate/offline replay, malicious model JSON and dependency compromise. React escapes text; SQL is parameterized; cookie writes require same-origin checks; no arbitrary redirects or wildcard CORS. OTP/live provider flows remain disabled pending contract and controls.

Residual risks: human redaction error, shared-device drafts, demo file storage unsuitable for horizontal scale, distributed rate limiting and malware detection need production configuration, lawful transfer and retention need counsel, privileged DB operators can bypass application safeguards. External pentest and restore exercises remain mandatory.
