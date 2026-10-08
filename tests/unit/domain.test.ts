import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { ReportService } from "../../apps/web/lib/service";
import {
  MemoryRepository,
  inputFixture,
  officer,
  guest,
} from "../../packages/testing/src/fixtures";
import {
  publicReport,
  coarsenLocation,
  distanceMeters,
  duplicateCandidates,
  assertTransition,
  authorizeAuthority,
  parseAssessment,
  csvCell,
  retentionDecision,
  roles,
  reportInputSchema,
} from "../../packages/domain/src/index";
import {
  trackingToken,
  keyedHash,
  signQr,
  verifyQr,
  assertSameOrigin,
  MemoryRateLimiter,
} from "../../packages/security/src/index";
import { secret } from "../../packages/config/src/index";
import {
  MockSmsGateway,
  statusTemplate,
} from "../../packages/providers/src/sms/index";
describe("privacy and workflow contracts", () => {
  it("public serializer never includes exactLocation, identity, hash or private text", () => {
    const repo = new MemoryRepository();
    const r = repo.state.reports[0];
    r.privacyReviewed = false;
    const dto = publicReport(r);
    expect(Object.keys(dto)).not.toEqual(
      expect.arrayContaining([
        "exactLocation",
        "ownerId",
        "trackingHash",
        "clientReportId",
        "locationNote",
      ]),
    );
    expect(dto.description).toBe("");
    expect(JSON.stringify(dto)).not.toContain("exactLocation");
  });
  it("grid is deterministic and separates exact GPS", () => {
    const exact = { lat: 23.742145, lng: 90.37784 };
    const grid = coarsenLocation(exact);
    expect(grid).not.toEqual(exact);
    expect(distanceMeters(grid, exact)).toBeLessThan(120);
    expect(coarsenLocation(grid)).toEqual(grid);
  });
  it("nearby recent duplicate is suggested but hidden/old reports are omitted", () => {
    const repo = new MemoryRepository();
    const loc = repo.state.locations[0];
    expect(
      duplicateCandidates(repo.state, loc).map((r) => r.publicId),
    ).toContain(repo.state.reports[0].publicId);
    repo.state.reports[0].hidden = true;
    expect(
      duplicateCandidates(repo.state, loc).map((r) => r.publicId),
    ).not.toContain(repo.state.reports[0].publicId);
  });
  it("idempotency creates one report and recovers the same high-entropy tracking credential", async () => {
    const repo = new MemoryRepository();
    const service = new ReportService(repo);
    const input = inputFixture(repo);
    const first = await service.create(input, guest, input.clientReportId);
    const second = await service.create(input, guest, input.clientReportId);
    expect(second.replayed).toBe(true);
    expect(second.trackingToken).toBe(first.trackingToken);
    expect(
      repo.state.reports.filter(
        (r) => r.clientReportId === input.clientReportId,
      ),
    ).toHaveLength(1);
    expect(repo.state.reports.at(-1)?.trackingHash).toBe(
      keyedHash(first.trackingToken, secret("TRACKING_TOKEN_PEPPER")),
    );
    expect(JSON.stringify(repo.state)).not.toContain(first.trackingToken);
  });
  it("rejects an idempotency key reused for changed content", async () => {
    const repo = new MemoryRepository();
    const service = new ReportService(repo);
    const input = inputFixture(repo);
    await service.create(input, guest, input.clientReportId);
    await expect(
      service.create(
        { ...input, description: "changed" },
        guest,
        input.clientReportId,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("Bangla submission survives storage exactly", async () => {
    const repo = new MemoryRepository();
    const input = inputFixture(repo);
    await new ReportService(repo).create(input, guest, input.clientReportId);
    expect(repo.state.reports.at(-1)?.description).toBe(input.description);
    expect(repo.state.reports.at(-1)?.capturedAt).toBe(input.capturedAt);
  });
  it("resolution requires after evidence and creates an immutable event", async () => {
    const repo = new MemoryRepository();
    const service = new ReportService(repo);
    const input = inputFixture(repo);
    const result = await service.create(input, guest, input.clientReportId);
    const id = repo.state.reports.find(
      (r) => r.publicId === result.report.publicId,
    )!.id;
    await service.transition(id, "under_review", officer);
    await expect(
      service.transition(id, "verified", officer),
    ).rejects.toMatchObject({ code: "VERIFICATION_NOTE_REQUIRED" });
    await service.transition(
      id,
      "verified",
      officer,
      "Water-holding condition observed",
    );
    await service.transition(id, "assigned", officer, "", "Team A");
    await service.transition(id, "in_progress", officer);
    await expect(
      service.transition(id, "resolved", officer, "cleaned"),
    ).rejects.toMatchObject({ code: "RESOLUTION_EVIDENCE_REQUIRED" });
    const mediaId = randomUUID();
    repo.state.media.push({
      ...repo.state.media.at(-1)!,
      id: mediaId,
      reportId: id,
      kind: "after",
    });
    await service.transition(
      id,
      "resolved",
      officer,
      "Water removed",
      undefined,
      mediaId,
    );
    expect(repo.state.events.at(-1)?.to).toBe("resolved");
    expect(repo.state.audits.at(-1)?.action).toBe("report.resolved");
  });
  it.each(
    roles.filter(
      (r) => !["authority_officer", "authority_supervisor"].includes(r),
    ),
  )("role %s cannot view exact GPS", (role) => {
    expect(() =>
      authorizeAuthority(
        { id: "test", role, jurisdictions: ["demo-ward-a"] },
        { jurisdictionId: "demo-ward-a" },
      ),
    ).toThrow();
  });
  it("cross-jurisdiction authority fails with 403", () => {
    expect(() =>
      authorizeAuthority(officer, { jurisdictionId: "demo-ward-b" }),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
  it("disallows skipping lifecycle and officer reopening", () => {
    expect(() =>
      assertTransition("submitted", "resolved", officer, true),
    ).toThrow();
    expect(() =>
      assertTransition("resolved", "in_progress", officer),
    ).toThrow();
  });
  it("tampered and expired QR signatures fail", () => {
    const now = Math.floor(Date.now() / 1000);
    const key = secret("QR_SIGNING_SECRET");
    const qr = signQr(
      { siteId: "demo-site", version: 1, issuedAt: now, expiresAt: now + 60 },
      key,
    );
    expect(verifyQr(qr, key).siteId).toBe("demo-site");
    expect(() => verifyQr(qr + "x", key)).toThrow();
    expect(() => verifyQr(qr, key, now + 61)).toThrow();
  });
  it("AI malformed JSON and privileged extra fields cannot change state", () => {
    const repo = new MemoryRepository();
    const before = JSON.stringify(repo.state);
    expect(parseAssessment("{bad json")).toBeNull();
    expect(
      parseAssessment(
        JSON.stringify({ status: "resolved", needsHumanReview: true }),
      ),
    ).toBeNull();
    expect(JSON.stringify(repo.state)).toBe(before);
  });
  it.each(["=cmd()", "+SUM(A1)", "-1+2", "@formula", "\t=cmd()", "  +cmd()"])(
    "escapes CSV formula %s",
    (payload) => {
      expect(csvCell(payload)).toMatch(/^"'/);
    },
  );
  it("tracking is deterministic for safe retry but differs per UUID", () => {
    const key = secret("TRACKING_TOKEN_PEPPER");
    expect(trackingToken("a", key)).toBe(trackingToken("a", key));
    expect(trackingToken("a", key)).not.toBe(trackingToken("b", key));
    expect(trackingToken("a", key).length).toBeGreaterThanOrEqual(43);
  });
  it("strict boundaries reject role and jurisdiction injection", () => {
    const repo = new MemoryRepository();
    expect(
      reportInputSchema.safeParse({
        ...inputFixture(repo),
        role: "system_admin",
        jurisdictionId: "demo-ward-b",
      }).success,
    ).toBe(false);
  });
  it("retention respects legal holds and closure dates", () => {
    const now = Date.now();
    const created = new Date(now - 800 * 86400000).toISOString();
    const closed = new Date(now - 181 * 86400000).toISOString();
    expect(retentionDecision(created, closed, now)).toEqual({
      original: true,
      private: true,
      archive: true,
    });
    expect(retentionDecision(created, closed, now, true)).toEqual({
      original: false,
      private: false,
      archive: false,
    });
  });
  it("rejects CSRF and enforces rate limits", async () => {
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost/api", {
          method: "POST",
          headers: { origin: "https://attacker.invalid" },
        }),
      ),
    ).toThrow();
    const limiter = new MemoryRateLimiter();
    await limiter.consume("test", 1, 10000);
    await expect(limiter.consume("test", 1, 10000)).rejects.toMatchObject({
      status: 429,
    });
  });
  it("mock SMS does not retain phone or OTP secrets", async () => {
    const sms = new MockSmsGateway();
    await sms.sendOtp("+8801700000000", "123456");
    expect(JSON.stringify(sms.sent)).not.toMatch(/123456|88017/);
    expect(statusTemplate("DSP-A", "যাচাই হয়েছে", "bn-BD")).toContain(
      "যাচাই হয়েছে",
    );
  });
});
