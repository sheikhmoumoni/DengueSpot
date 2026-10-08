# Test design gate

Each P0 feature is exercised against happy, invalid, unauthorized, network failure, offline, Bangla, mobile and accessibility paths. Security/domain tests take priority over vanity coverage.

| Area | Unit/security | Integration | E2E |
|---|---|---|---|
| Report / tracking | Unicode, token hash, strict schema, idempotency | transaction rollback / replay | online Bangla and English |
| GPS / duplicate | coarsening, distance/window | ST_Covers, ST_DWithin, separation | duplicate suggestion / list fallback |
| Roles | full role matrix / foreign jurisdiction | private access and audit | unauthorized endpoint denied |
| Workflow | all transitions / proof required | event + status atomicity | verify → assign → working → resolve |
| Media | bytes, signature, pixels, no EXIF | ownership/storage access | before/after upload |
| Moderation / rights | hide, merge restrictions, ownership | deletion / audit preservation | hide and tracking-token deletion |
| Offline / QR | stable UUID / tampered QR | replay safe | disconnected draft → reconnect |
| Providers | malformed advisory / failure | durable jobs | AI absent still works |
| Accessibility | axe | n/a | keyboard, labels, mobile viewport |

Vitest unit and API integration suites; real PostgreSQL/PostGIS suite enabled only against TEST_DATABASE_URL, otherwise explicitly skipped and reported. Playwright Chromium desktop/mobile with axe. Manual release checks: screen reader/Bangla pronunciation, 200% zoom, Android performance, focus and shared-device behavior. Docker builds and Terraform validation require those tools. Never report skipped checks as passing.
