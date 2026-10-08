import { setTimeout as delay } from "node:timers/promises";
import {
  repository,
  PostgresRepository,
  type Repository,
} from "../../../packages/db/src/index";
import { assertConfig } from "../../../packages/config/src/index";
import { OpenAiEvidenceAiProvider } from "../../../packages/providers/src/ai/index";
import { storage } from "../../../packages/providers/src/storage/index";
import { audit, event } from "../../web/lib/service";
import type { Actor } from "../../../packages/domain/src/index";
const worker: Actor = { id: "worker", role: "system_admin", jurisdictions: [] };
export async function runJobs(repo: Repository = repository()) {
  return repo.transaction(async (tx) => {
    let done = 0;
    let failed = 0;
    for (const job of tx.state.jobs
      .filter(
        (j) =>
          j.status === "pending" && Date.parse(j.nextAttemptAt) <= Date.now(),
      )
      .slice(0, 10)) {
      try {
        const report = tx.state.reports.find((r) => r.id === job.reportId);
        if (!report || report.status === "withdrawn") {
          job.status = "done";
          continue;
        }
        if (job.kind === "notification") {
          event(
            tx.state,
            report,
            worker,
            "in_app_update",
            null,
            "Status available in tracking timeline",
          );
        }
        if (job.kind === "ai") {
          if (process.env.AI_TRIAGE_ENABLED !== "true")
            throw new Error("AI_DISABLED");
          if (
            !tx.state.events.some(
              (e) =>
                e.reportId === report.id && e.type === "optional_ai_consent",
            ) ||
            tx.state.events.some(
              (e) =>
                e.reportId === report.id &&
                e.type === "optional_consent_withdrawn",
            )
          )
            throw new Error("OPTIONAL_CONSENT_REQUIRED");
          const media = tx.state.media.find(
            (m) =>
              m.reportId === report.id && m.safeForPublic && m.derivativeKey,
          );
          if (!media?.derivativeKey || !report.privacyReviewed)
            throw new Error("PRIVACY_REVIEW_REQUIRED");
          const assessment =
            await new OpenAiEvidenceAiProvider().assessEvidence({
              redactedImage: await storage().get(media.derivativeKey),
              locale: report.locale,
            });
          // Advisory information never updates report state. No input text/GPS/identity is sent.
          event(
            tx.state,
            report,
            worker,
            "ai_advisory",
            null,
            JSON.stringify(assessment),
          );
        }
        if (job.kind === "webhook")
          throw new Error("WEBHOOK_CONTRACT_REQUIRED");
        job.status = "done";
        job.lastError = null;
        done++;
        audit(tx.state, worker, "job.completed", job.id);
      } catch {
        job.attempts++;
        job.lastError = "PROVIDER_JOB_FAILED";
        job.status = job.attempts >= 5 ? "failed" : "pending";
        job.nextAttemptAt = new Date(
          Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts),
        ).toISOString();
        failed++;
      }
    }
    return {
      done,
      failed,
      pending: tx.state.jobs.filter((j) => j.status === "pending").length,
    };
  });
}
let running = true;
process.on("SIGINT", () => (running = false));
process.on("SIGTERM", () => (running = false));
if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("apps/worker/src/index.ts")
) {
  assertConfig();
  const repo = repository();
  try {
    while (running) {
      const metrics = await runJobs().catch(() => ({
        error: "WORKER_TICK_FAILED",
      }));
      console.info(
        JSON.stringify({
          event: "worker.tick",
          timestamp: new Date().toISOString(),
          ...metrics,
        }),
      );
      if (process.argv.includes("--once")) break;
      await delay(5000);
    }
  } finally {
    if (repo instanceof PostgresRepository) await repo.pool.end();
  }
}
