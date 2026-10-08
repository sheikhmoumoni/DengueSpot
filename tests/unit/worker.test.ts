import { describe, it, expect, vi } from "vitest";
import { MemoryRepository } from "../../packages/testing/src/fixtures";
import { retention } from "../../apps/worker/src/retention";
import { runJobs } from "../../apps/worker/src/index";
import type { Media } from "../../packages/domain/src/index";
describe("retention and durable worker", () => {
  it("dry-run never deletes; fresh after-photos retain their full 30 days", async () => {
    const repo = new MemoryRepository();
    const now = Date.now();
    const report = repo.state.reports[0];
    report.createdAt = new Date(now - 60 * 86400000).toISOString();
    report.closedAt = new Date(now).toISOString();
    const photo = (id: string, age: number): Media => ({
      id,
      reportId: report.id,
      ownerKey: "test",
      kind: "after",
      originalKey: "originals/" + id + ".jpg",
      derivativeKey: null,
      sha256: "test",
      bytes: 1,
      width: 1,
      height: 1,
      mime: "image/jpeg",
      safeForPublic: false,
      createdAt: new Date(now - age * 86400000).toISOString(),
    });
    repo.state.media = [photo("fresh", 1), photo("old", 31)];
    const remove = vi.fn(async () => {});
    const preview = await retention(false, now, repo, { remove });
    expect(
      preview
        .filter((d) => d.policy === "original-30-days")
        .map((d) => d.recordId),
    ).toEqual(["old"]);
    expect(remove).not.toHaveBeenCalled();
    await retention(true, now, repo, { remove });
    expect(remove).toHaveBeenCalledExactlyOnceWith("originals/old.jpg");
    expect(repo.state.media[0].originalKey).not.toBeNull();
    expect(repo.state.media[1].originalKey).toBeNull();
  });
  it("legal hold prevents original, derivative, location and public archival changes", async () => {
    const repo = new MemoryRepository();
    repo.state.reports = [repo.state.reports[0]];
    const report = repo.state.reports[0];
    report.legalHold = true;
    report.createdAt = report.closedAt = "2020-01-01T00:00:00.000Z";
    const remove = vi.fn(async () => {});
    expect(await retention(true, Date.now(), repo, { remove })).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
    expect(repo.state.locations.some((l) => l.reportId === report.id)).toBe(
      true,
    );
  });
  it("notification jobs append in-app events; disabled providers retry without changing report status", async () => {
    const repo = new MemoryRepository();
    const report = repo.state.reports[0];
    const originalStatus = report.status;
    repo.state.jobs = [
      {
        id: "notify",
        reportId: report.id,
        kind: "notification",
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(0).toISOString(),
        lastError: null,
      },
      {
        id: "ai",
        reportId: report.id,
        kind: "ai",
        status: "pending",
        attempts: 4,
        nextAttemptAt: new Date(0).toISOString(),
        lastError: null,
      },
    ];
    vi.stubEnv("AI_TRIAGE_ENABLED", "false");
    try {
      expect(await runJobs(repo)).toEqual({ done: 1, failed: 1, pending: 0 });
      expect(repo.state.jobs.map((j) => j.status)).toEqual(["done", "failed"]);
      expect(repo.state.events.some((e) => e.type === "in_app_update")).toBe(
        true,
      );
      expect(repo.state.reports[0].status).toBe(originalStatus);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
