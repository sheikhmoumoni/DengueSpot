# Operational runbook

## Start and verify

Use README local commands, or DEPLOYMENT for managed environments. Start the web application and a separate worker. Check `/api/v1/health` for liveness and `/api/v1/ready` for repository readiness. Submit a synthetic test report, inspect it through a matching ward account, resolve with proof, and verify that anonymous/private scopes behave correctly. Delete the test through its tracking credential. Do not use a real citizen's record as a smoke test.

## Worker failure / backlog

Jobs are persisted with status, attempt count, next-attempt timestamp and generic error code. The worker processes batches of ten, retries with exponential delay and stops after five failures. In-app report status remains accessible if the worker or a vendor is down. Inspect job counts in the trusted database, verify provider credentials/configuration, and replay a failed job only after confirming the underlying operation is idempotent. No raw photo/GPS/phone/token belongs in a log or alert. Log output includes event/metrics/request IDs, not submitted bodies. Configure alerts for readiness failure, oldest pending job, failed jobs, unusual 401/403/429 rates, error rate and storage/database capacity; alert transports are not provisioned by the app.

The current worker holds the repository transaction lock while calling a provider. Keep providers disabled in the demo. For production concurrency, replace this with lease-based job claiming and a transactional outbox; do not increase replicas to mask lock contention.

## Retention

Run `pnpm retention:dry-run` on a controlled runner and review record IDs/policy decisions. Run `pnpm retention:execute` when authorized by the operating retention policy. Schedule daily after a successful staging exercise. Originals expire 30 days after **each media upload**, including late after-photos. Derivatives and exact GPS expire 180 days after closure. Public records archive at 730 days; orphan uploads expire after 24 hours. Legal hold suppresses report-linked automated deletions/archival. Monitor run failure and retain policy/run evidence. Current run output is structured records plus a chained execution audit; a dedicated retention-run dashboard is not implemented.

Primary object deletion does not necessarily erase old versions/backups immediately. Align S3 version expiration, Supabase policy and backup retention with the legal notice, and verify restoration does not republish deleted content. Report tombstones and accountability records need a documented separate retention basis. Immutable notes must not contain unnecessary personal information.

## Backup / restore / rollback

Managed production must enable encrypted automated backups and PITR where supported. Terraform references 14-day RDS backups, KMS and production deletion protection. Perform a restore into an isolated environment, restore required private object versions, apply rights/deletion tombstones, then test row counts, audit continuity, spatial routing and authorization. Record measured RPO/RTO; none has been demonstrated yet. Do not claim a successful backup merely because infrastructure configuration exists.

For a failed deployment, restore the previous immutable application image/Vercel deployment first. Keep schema changes additive/backward-compatible. Do not roll back a database by dropping tables or overwriting current citizen data. Disable optional processing, pause harmful workflows and coordinate a forward migration if a schema/data fix is needed. Use INCIDENT_RESPONSE for compromise.

## Identity and secrets

Provision verified Auth IDs, application profiles and jurisdiction memberships through controlled database administration. Runtime has no profile/role writes. Remove membership and revoke sessions when an officer changes duties. Staff require MFA in real mode. Provide a completed MFA recovery flow and a break-glass procedure with audited approvals before launch. Rotate secrets in the secret manager and restart tasks; tracking/audit key rotation needs a versioned migration to preserve existing credentials/history. Keep owner migration credentials outside the web/worker runtime.

## Privacy / moderation

Moderator hide immediately removes public access. Release means all derivatives and descriptions have been checked for people, plates, private property details and contact information. If content cannot be safely published, keep it private. The current system cannot blur a face or plate. Resolution adds new evidence and resets publication review. Data-rights requests use ownership verification; legal holds return a human-review error. A staffed privacy contact, queue, lawful retention/exemption process, appeals and abuse response must be operational before accepting real reports.

## Synthetic demo cleanup

Demo state lives in ignored `.data`; test/browser artifacts are ignored. Stop processes before changing demo datasets. Preserve any material you need first, then remove only the explicitly verified synthetic directory. No cleanup script recursively deletes arbitrary paths. Portable verification tools under `.tools` are local, ignored and not application dependencies. The portable database can be stopped with its `pg_ctl` executable and explicit data directory; do not stop unrelated PostgreSQL services.
