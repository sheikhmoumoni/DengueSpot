import { randomUUID } from "node:crypto";
import {
  repository,
  PostgresRepository,
  type Repository,
} from "../../../packages/db/src/index";
import {
  retentionDecision,
  type Actor,
} from "../../../packages/domain/src/index";
import {
  storage,
  type PrivateStorage,
} from "../../../packages/providers/src/storage/index";
import { audit, event } from "../../web/lib/service";
import { assertConfig } from "../../../packages/config/src/index";
import { fileURLToPath } from "node:url";
import path from "node:path";
export async function retention(
  execute = false,
  now = Date.now(),
  repo: Repository = repository(),
  evidence: Pick<PrivateStorage, "remove"> = storage(),
) {
  assertConfig();
  const worker: Actor = {
    id: "retention-worker",
    role: "system_admin",
    jurisdictions: [],
  };
  return repo.transaction(async (tx) => {
    const decisions: {
      recordId: string;
      policy: string;
      decision: "delete" | "archive";
      timestamp: string;
      execute: boolean;
    }[] = [];
    for (const report of tx.state.reports) {
      const policy = retentionDecision(
        report.createdAt,
        report.closedAt,
        now,
        report.legalHold,
      );
      for (const media of tx.state.media.filter(
        (m) => m.reportId === report.id,
      )) {
        // Late after-photos retain their own full retention window.
        const mediaPolicy = retentionDecision(
          media.createdAt,
          report.closedAt,
          now,
          report.legalHold,
        );
        if (mediaPolicy.original && media.originalKey) {
          decisions.push({
            recordId: media.id,
            policy: "original-30-days",
            decision: "delete",
            timestamp: new Date(now).toISOString(),
            execute,
          });
          if (execute) {
            await evidence.remove(media.originalKey);
            media.originalKey = null;
          }
        }
        if (policy.private && media.derivativeKey) {
          decisions.push({
            recordId: media.id,
            policy: "derivative-180-days-after-close",
            decision: "delete",
            timestamp: new Date(now).toISOString(),
            execute,
          });
          if (execute) {
            await evidence.remove(media.derivativeKey);
            media.derivativeKey = null;
            media.safeForPublic = false;
          }
        }
      }
      if (
        policy.private &&
        tx.state.locations.some((l) => l.reportId === report.id)
      ) {
        decisions.push({
          recordId: report.id,
          policy: "gps-180-days-after-close",
          decision: "delete",
          timestamp: new Date(now).toISOString(),
          execute,
        });
        if (execute)
          tx.state.locations = tx.state.locations.filter(
            (l) => l.reportId !== report.id,
          );
      }
      if (policy.archive && report.status !== "archived") {
        decisions.push({
          recordId: report.id,
          policy: "public-two-years",
          decision: "archive",
          timestamp: new Date(now).toISOString(),
          execute,
        });
        if (execute) {
          event(tx.state, report, worker, "retention_archived", "archived");
          report.status = "archived";
          report.hidden = true;
          report.description = "";
          report.locationNote = "";
          report.ownerId = null;
          report.resolutionNote = null;
        }
      }
    }
    // Unattached uploads are removed after 24 hours, including abandoned submissions.
    for (const media of tx.state.media.filter(
      (m) => !m.reportId && now - Date.parse(m.createdAt) > 86400000,
    )) {
      decisions.push({
        recordId: media.id,
        policy: "orphan-media-24-hours",
        decision: "delete",
        timestamp: new Date(now).toISOString(),
        execute,
      });
      if (execute) {
        if (media.originalKey) await evidence.remove(media.originalKey);
        if (media.derivativeKey) await evidence.remove(media.derivativeKey);
        tx.state.media = tx.state.media.filter((m) => m.id !== media.id);
      }
    }
    if (execute) audit(tx.state, worker, "retention.execute", randomUUID());
    return decisions;
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const repo = repository();
  retention(process.argv.includes("--execute"))
    .then((decisions) => {
      for (const decision of decisions) console.info(JSON.stringify(decision));
      console.info(
        JSON.stringify({
          event: "retention.complete",
          execute: process.argv.includes("--execute"),
          decisions: decisions.length,
        }),
      );
    })
    .catch(() => {
      console.error("Retention failed; inspect operational health.");
      process.exitCode = 1;
    })
    .finally(async () => {
      if (repo instanceof PostgresRepository) await repo.pool.end();
    });
}
