# ADR 001 — dual backend and fail-closed publication

Accepted 2026-10-08. Use Next.js, strict TypeScript and PostgreSQL/PostGIS with private media. Provide a clearly marked file-backed synthetic demo because the build environment has no Docker or supplied database/storage credentials. The demo uses the same service rules, not pretend external integrations. Production startup rejects demo configuration unless intentionally enabled for a demonstration.

Without a validated face/plate detector, no new citizen evidence is automatically public. A moderator must affirm a derivative is privacy-safe. Public text is also withheld pending review. This keeps submission usable without claiming automated redaction. Supabase-compatible private object storage and verified auth are deployment adapters. Provider failures never gate core report creation.
