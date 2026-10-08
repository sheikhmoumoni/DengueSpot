# Generated source file tree

Complete deliverable source tree. Local secrets, dependencies, build output, downloaded verification runtimes, test artifacts and private state are deliberately excluded. Regenerate with `node scripts/generate-file-tree.mjs`.

```text
DengueSpot/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── production.yml
│       ├── security.yml
│       └── staging.yml
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── [locale]/
│   │   │   │   └── [[...slug]]/
│   │   │   │       └── page.tsx
│   │   │   ├── api/
│   │   │   │   └── v1/
│   │   │   │       └── [...path]/
│   │   │   │           └── route.ts
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── application.tsx
│   │   │   ├── context.tsx
│   │   │   ├── home.tsx
│   │   │   ├── map-view.tsx
│   │   │   ├── operations.tsx
│   │   │   ├── pages.tsx
│   │   │   ├── report-form.tsx
│   │   │   └── ui.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   ├── client.ts
│   │   │   ├── media.ts
│   │   │   └── service.ts
│   │   ├── public/
│   │   │   ├── fonts/
│   │   │   │   ├── noto-bengali.woff2
│   │   │   │   └── OFL.txt
│   │   │   ├── icon-192.png
│   │   │   ├── icon-512.png
│   │   │   ├── icon.svg
│   │   │   ├── manifest.webmanifest
│   │   │   └── sw.js
│   │   ├── AGENTS.md
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   ├── postcss.config.mjs
│   │   └── tsconfig.json
│   └── worker/
│       ├── src/
│       │   ├── index.ts
│       │   └── retention.ts
│       └── package.json
├── docs/
│   ├── adr/
│   │   └── 001-storage-and-privacy.md
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATA_CLASSIFICATION.md
│   ├── DELIVERY.md
│   ├── DEPLOYMENT.md
│   ├── FILE_TREE.md
│   ├── FINAL_SECURITY_REVIEW.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── INCIDENT_RESPONSE.md
│   ├── openapi.json
│   ├── PENTEST_PLAN.md
│   ├── PRE_CODE_REVIEW.md
│   ├── PRIVACY_MODEL.md
│   ├── PRODUCT_SPEC.md
│   ├── RETENTION_POLICY.md
│   ├── RUNBOOK.md
│   ├── TEST_PLAN.md
│   ├── THREAT_MODEL.md
│   └── UX_FLOWS.md
├── infra/
│   └── terraform/
│       ├── environments/
│       │   ├── production/
│       │   │   └── terraform.tfvars.example
│       │   └── staging/
│       │       └── terraform.tfvars.example
│       ├── modules/
│       │   ├── data/
│       │   │   └── main.tf
│       │   ├── network/
│       │   │   └── main.tf
│       │   └── runtime/
│       │       └── main.tf
│       ├── .terraform.lock.hcl
│       ├── main.tf
│       ├── README.md
│       ├── variables.tf
│       └── versions.tf
├── packages/
│   ├── config/
│   │   └── src/
│   │       └── index.ts
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 001_core.sql
│   │   │   └── 002_runtime_permissions.sql
│   │   ├── seeds/
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── demo-evidence.ts
│   │       ├── index.ts
│   │       ├── migrate.ts
│   │       └── seed-data.ts
│   ├── domain/
│   │   └── src/
│   │       └── index.ts
│   ├── i18n/
│   │   ├── messages/
│   │   │   ├── bn-BD.json
│   │   │   └── en-BD.json
│   │   └── src/
│   │       └── index.ts
│   ├── providers/
│   │   └── src/
│   │       ├── ai/
│   │       │   └── index.ts
│   │       ├── geocoding/
│   │       │   └── index.ts
│   │       ├── ocr/
│   │       │   └── index.ts
│   │       ├── sms/
│   │       │   └── index.ts
│   │       ├── speech/
│   │       │   └── index.ts
│   │       └── storage/
│   │           └── index.ts
│   ├── security/
│   │   └── src/
│   │       └── index.ts
│   └── testing/
│       └── src/
│           └── fixtures.ts
├── scripts/
│   ├── check-health.mjs
│   ├── generate-assets.mjs
│   ├── generate-file-tree.mjs
│   ├── generate-openapi.mjs
│   ├── security-scan.mjs
│   ├── setup-demo.mjs
│   └── start-production.mjs
├── tests/
│   ├── e2e/
│   │   └── workflow.spec.ts
│   ├── integration/
│   │   ├── api.test.ts
│   │   └── postgis.test.ts
│   ├── unit/
│   │   ├── domain.test.ts
│   │   ├── media.test.ts
│   │   └── worker.test.ts
│   └── setup.ts
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── eslint.config.mjs
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── tsconfig.json
└── vitest.config.ts
```
