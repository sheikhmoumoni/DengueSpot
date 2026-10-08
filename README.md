# DengueSpot

Bangla-first, mobile-friendly civic reporting for potential mosquito breeding environments in Bangladesh. Citizens submit a photo and location, track municipal handling, and see evidence of resolution. The default local demo uses 21 clearly synthetic reports and two fictional ward boundaries around Dhaka.

This is a working product scaffold, not a dengue diagnostic tool, a mosquito-species classifier, an official government service, or a production security/legal certification. Report counts describe environmental reports, not cases, infections or disease risk predictions. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for the precise release boundary.

## Run locally

Requires Node.js 24 and internet access for the first dependency installation. Run from the repository root in PowerShell, Bash or another shell:

```sh
npx pnpm@10.28.2 install --frozen-lockfile
npx pnpm@10.28.2 demo:setup
npx pnpm@10.28.2 dev
```

Open **http://localhost:3000/bn-BD** or **http://localhost:3000/en-BD**. No external account is needed for anonymous reporting. Local server state and private photos are stored under ignored `.data/`. The first request seeds the demo automatically. Keep the local server bound to loopback when using demo authentication.

Sign in at `/en-BD/login` with an identity selected in the form and the random `DEMO_LOGIN_PASSWORD` in the root `.env`. Available identities are `demo-officer-a`, `demo-officer-b`, `demo-supervisor`, `demo-moderator`, `demo-citizen`, and `demo-admin`. Ward A and B have different access scopes. Demo sessions expire after eight hours. The setup script preserves an existing `.env`; it does not print credentials.

Production-style local build:

```sh
npx pnpm@10.28.2 build
npx pnpm@10.28.2 start
```

Optional worker and retention commands, in a second terminal:

```sh
npx pnpm@10.28.2 worker
npx pnpm@10.28.2 retention:dry-run
npx pnpm@10.28.2 retention:execute
```

`retention:execute` deletes eligible evidence/location records; inspect the dry-run first. Use synthetic data for local exercises.

## Architecture

- `apps/web`: Next.js App Router, React, Tailwind CSS, bilingual PWA and same-origin API BFF.
- `packages/domain`, `security`, `i18n`, `config`: strict contracts, lifecycle, authorization, privacy grid, credentials and translations.
- `packages/db`: local demo repository or PostgreSQL/PostGIS; SQL migrations and seed data.
- `packages/providers`: private local/Supabase/S3 storage, optional OpenAI/OCR/speech adapters and explicit SMS/IVR mocks.
- `apps/worker`: durable provider jobs, retry handling and retention.
- `tests`, `.github/workflows`, `infra/terraform`: automated verification, delivery workflows and AWS infrastructure reference.

The Postgres scaffold uses JSONB application records with separate spatial columns/tables and transaction-scoped advisory locking. It is correct for the tested scaffold workflows but requires query-oriented repositories and load testing before a large rollout. [Architecture and ER diagram](docs/ARCHITECTURE.md), [UX flows](docs/UX_FLOWS.md), [complete file tree](docs/FILE_TREE.md).

## Configuration and database

`.env.example` contains the complete environment inventory. `demo:setup` generates local random signing/credential secrets. Never commit `.env`, `.data`, cloud credentials or Terraform state. Production requires `DEMO_MODE=false`, `DATA_BACKEND=postgres`, private storage, verified identity, and provisioned jurisdictions/memberships.

[Environment reference and deployment instructions](docs/DEPLOYMENT.md) cover all variables, PostGIS, TLS, Vercel/Supabase, Docker and AWS.

```sh
npx pnpm@10.28.2 db:migrate
npx pnpm@10.28.2 db:seed
```

Migration commands require `DIRECT_DATABASE_URL` or `DATABASE_URL`. Seed uses `DATABASE_URL` and `DATA_BACKEND=postgres`. Seed preserves an existing dataset; it creates only synthetic reports and must not be run as production onboarding. Migration `001_core.sql` creates the spatial schema, protected tables, public view and append-only triggers. `002_runtime_permissions.sql` creates a non-login least-privilege permission group; provision a separate database login and grant this group to it. Use schema-owner credentials only for migrations/controlled seed.

Docker Desktop with Linux containers is optional:

```sh
docker compose up -d postgres
docker compose run --rm worker pnpm db:migrate
docker compose run --rm worker pnpm db:seed
docker compose up --build -d web worker
```

The generated `.env` includes `POSTGRES_PASSWORD`. If your `.env` predates that variable, add a strong random value before running Compose. Docker was unavailable on the build machine; container builds remain an explicit unverified check, with a build job supplied in CI.

## Test

```sh
npx pnpm@10.28.2 lint
npx pnpm@10.28.2 typecheck
npx pnpm@10.28.2 test
npx pnpm@10.28.2 test:integration
npx pnpm@10.28.2 exec playwright install chromium
npx pnpm@10.28.2 test:e2e
npx pnpm@10.28.2 build
npx pnpm@10.28.2 audit --prod
npx pnpm@10.28.2 security:scan
```

Set `TEST_DATABASE_URL` to a **dedicated test database** to run the real PostGIS suite; otherwise those cases skip explicitly. Tests use synthetic fixtures. Playwright starts an isolated server on port 3100 and uses desktop Chrome and Pixel 7 emulation. Tests cover online/offline funnels, QR images, role isolation, resolution proof, Bangla preservation, privacy, media validation, idempotency, retention, map failure fallback and WCAG A/AA checks on home/reporting screens. [Test plan](docs/TEST_PLAN.md), [actual results and security review](docs/FINAL_SECURITY_REVIEW.md).

## Privacy, security and offline behavior

Public reports expose a fixed allowlist with a roughly 150 m snapped location. Exact GPS lives in a separate private table. Photo decoding rejects unsupported formats, spoofed MIME, oversized files, animation and excessive pixels; both stored variants lose EXIF. Original-quality evidence stays private. Derivatives and descriptions stay private until a human moderator attests that they are safe to publish. There is no automatic face/plate redactor: withhold unsafe images. New resolution evidence resets publication review.

Anonymous tracking uses a high-entropy credential stored hashed on the server. The browser retains the credential separately from drafts; public QR codes contain only a public report link. Keep the credential private. Owner rights actions require the credential or an authenticated owner session. Local deletion clears primary evidence/GPS/content, while minimal immutable accountability records and policy-bound backups may remain. These require a reviewed lawful retention basis before launch.

Offline drafts keep a photo, coordinates and consent state in IndexedDB on this device. Saving a draft does not upload it. Only a consented draft syncs on reconnection; a stable UUID/idempotency key protects retries. Drafts expire after seven days or can be discarded. Shared devices expose locally retained drafts/credentials to their browser user; no application encryption is claimed. The service worker caches anonymous shells/static assets only, never API responses, authority/moderation/privacy/report-detail pages or query-string requests. Offline support starts after a successful visit; a first-ever offline visit cannot load the app.

[Privacy model](docs/PRIVACY_MODEL.md), [data classification](docs/DATA_CLASSIFICATION.md), [threat model](docs/THREAT_MODEL.md), [retention policy](docs/RETENTION_POLICY.md), [incident response](docs/INCIDENT_RESPONSE.md), [operations runbook](docs/RUNBOOK.md).

## Providers and production prerequisites

Reporting works without AI, OCR, speech, SMS or geocoding. OpenAI uses an explicit model setting, structured advisory output and reviewed derivatives; it cannot change report status. OCR/speech have mock and REST adapters. SMS/IVR are contract placeholders that fail closed; they do not pretend to send messages or connect to government systems. There is no wired citizen opt-in/scheduling flow for AI yet, so keep it disabled.

Before public deployment: obtain hosting/auth/storage credentials, real municipal boundaries and authority onboarding, an MFA enrollment/challenge flow, privacy operations staffing, processor contracts/transfer assessment, Bangladesh legal review, an independent pentest, backup restoration proof and load testing. Provider APIs have not been called using live credentials. See [known limitations and external requirements](docs/IMPLEMENTATION_STATUS.md) and [deployment](docs/DEPLOYMENT.md).

API endpoint tables and examples are in [API.md](docs/API.md); the machine-readable contract is [openapi.json](docs/openapi.json). [Delivery report](docs/DELIVERY.md) collects the requested handover items.
