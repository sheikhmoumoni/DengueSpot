# DengueSpot delivery report

The workspace contains a runnable, tested bilingual civic-reporting scaffold and its security/privacy/deployment handover. Real public-service rollout remains gated by the limitations and external work below.

## 1. Architecture

Next.js/React PWA → same-origin validated API → domain authorization/lifecycle → PostgreSQL/PostGIS or explicit local demo repository. Exact location is separate from public snapped geometry. Private local/Supabase/S3 evidence passes bounded decoding/EXIF removal and a human publication gate. A separate worker processes durable jobs and retention. Optional provider adapters cannot decide status. See `ARCHITECTURE.md` for system and ER Mermaid diagrams.

## 2. Complete generated file tree

See `FILE_TREE.md`. It includes every deliverable source/config/document/font/icon file and excludes only local secrets/state, dependencies, build/test output and downloaded verification runtimes. Regenerate with `node scripts/generate-file-tree.mjs`.

## 3 and 10. Exact local setup/run commands

From the repository root:

```sh
npx pnpm@10.28.2 install --frozen-lockfile
npx pnpm@10.28.2 demo:setup
npx pnpm@10.28.2 dev
```

Open `http://localhost:3000/bn-BD` or `/en-BD`. Demo identities are selectable at `/en-BD/login`; use the generated `DEMO_LOGIN_PASSWORD` in `.env`. Production-style local run is `npx pnpm@10.28.2 build` then `npx pnpm@10.28.2 start`. Optional worker: `npx pnpm@10.28.2 worker`. README contains test/retention/Compose commands.

## 4. Required environment

Local setup generates `.env` from `.env.example`, including independent random secrets. Real hosting requires PostgreSQL/PostGIS runtime URL, verified Supabase identity settings, private Supabase or S3 storage, independent tracking/QR/audit/session secrets, canonical HTTPS origin and `DEMO_MODE=false`. Full variable-by-variable inventory is in `DEPLOYMENT.md`. Provider credentials remain optional and disabled; the random local `.env` is ignored and values were not printed.

## 5. Migrations

`packages/db/migrations/001_core.sql`: requested application table contracts, private/public spatial storage, GiST, RLS/revocation, immutable event/audit triggers and public view. `002_runtime_permissions.sql`: trusted-server permission group with RLS policies and constrained grants. Run `npx pnpm@10.28.2 db:migrate` with controlled owner credentials, then use a separate runtime login granted `denguespot_runtime`. `db:seed` is only for synthetic demo/staging data. Some reserved contract tables are not yet populated by dedicated normalized repositories; operational scaffold facts live in report JSONB/events/jobs.

## 6. Major routes

UI: `/{bn-BD|en-BD}`, `/report`, `/r/{publicId}`, `/my-reports`, `/learn`, `/privacy`, `/qr`, `/login`, `/authority`, `/authority/reports/{id}`, `/moderation`.

API: `/api/v1/reports`, `/reports/duplicates`, `/reports/{id}/private`, `/media/uploads`, `/media/{id}`, `/reports/{id}/{status|verify|assign|resolve}`, `/authority/{dashboard|reports|export}`, `/moderation`, `/data-rights/{access|delete|withdraw}`, `/data-rights/requests/{receiptId}`, `/qr/resolve`, `/analytics/{public|authority}`, `/health`, `/ready`. See `API.md` for methods/access/examples and `openapi.json` for the machine-readable inventory.

## 7. Verification

33 unit, 12 API/real PostGIS and 20 desktop/mobile browser tests passed. Lint, strict typecheck, production build, production dependency audit and static security scan passed. The standalone production server started successfully, with healthy liveness/readiness. Fresh CLI migration/seed, repeat seed preservation, worker one-tick and retention dry-run passed. Terraform initialized/formatted/validated; it was not applied. Docker was unavailable, so image builds remain unverified locally. GitHub workflows were generated but not run remotely. Browser screenshots/HTML reports are generated under ignored `artifacts/` and `playwright-report/`.

Final verification status: local checks above passed; Docker, remote CI, live vendors and hosted deployment remain unverified.

Final production-browser smoke passed officer login and both homepage accessibility scans with zero automated violations. Desktop/mobile screenshots were reviewed with real map tiles. The expanded bilingual home/report accessibility tests also passed on both browser projects after the final contrast correction.

## 8. Security review

`FINAL_SECURITY_REVIEW.md` records tested controls, fixed findings, residual risks, human pentest scope and legal review. Key protections include location separation, public allowlists, hashed credentials, server RBAC/jurisdiction checks, bounded image/body decoding, no-store private responses, explicit consent, immutable audit/events, human publication, strict schemas, parameterized SQL and formula-safe CSV. This is a developer self-review, not certification.

## 9. Known limitations

`IMPLEMENTATION_STATUS.md` is the full implementation matrix. Material blockers include the globally locked snapshot repository, incomplete real MFA UX/refresh, manual privacy attestation without redaction, storage/DB reconciliation, production abuse/alerting/restore evidence, host upload limits/direct upload flow, incomplete governance/admin screens and untested cloud/container delivery. AI/OCR/speech adapters are optional scaffolding; separate citizen opt-in/scheduling and provider UI are not integrated. SMS/IVR are explicit contract mocks, never simulated real deliveries.

## 11. Exact demo deployment commands

After configuring your Vercel project at `apps/web` and a private Supabase demo database/buckets as described in `DEPLOYMENT.md`:

```sh
npx pnpm@10.28.2 db:migrate
npx pnpm@10.28.2 db:seed
npx pnpm@10.28.2 dlx vercel link
npx pnpm@10.28.2 dlx vercel pull --yes --environment=preview
npx pnpm@10.28.2 dlx vercel build
npx pnpm@10.28.2 dlx vercel deploy --prebuilt
```

This requires your cloud credentials and prior environment configuration. Keep hosted demo data synthetic. A separate persistent worker/scheduled retention runtime is required; the web deploy does not run it. No hosted demo or paid resource was created.

## 12. External production requirements

Cloud/database/storage/auth credentials; region/DNS/TLS/secret store; completed MFA and authority onboarding; official licensed jurisdiction boundaries and municipal service agreements; private storage/version/backup policy and restore proof; staffed privacy/moderation/incident operations; SMS/IVR enterprise transport contracts if enabled; processor/transfer review and optional-consent flow for AI/Google; independent pentest, accessibility/real-device/load tests; Bangladesh-qualified counsel's review and documented release approval. See the complete checklist in `IMPLEMENTATION_STATUS.md`.
