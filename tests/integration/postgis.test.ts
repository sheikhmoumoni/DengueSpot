import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PostgresRepository } from "../../packages/db/src/index";
import { migrate } from "../../packages/db/src/migrate";
import { demoSeed } from "../../packages/db/src/seed-data";
import { secret } from "../../packages/config/src/index";
import { ReportService } from "../../apps/web/lib/service";
import { guest, officer } from "../../packages/testing/src/fixtures";
import type { ReportInput } from "../../packages/domain/src/index";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)(
  "real PostgreSQL/PostGIS (requires a dedicated empty TEST_DATABASE_URL)",
  () => {
    let repo: PostgresRepository;
    beforeAll(async () => {
      await migrate(url);
      repo = new PostgresRepository(url);
      await repo.transaction(async (tx) => {
        if (!tx.state.reports.length)
          Object.assign(tx.state, demoSeed(secret("AUDIT_HASH_SECRET")));
      });
    });
    afterAll(async () => {
      await repo?.pool.end();
    });
    it("ST_Covers routes points and ST_DWithin finds recent duplicates", async () => {
      await repo.transaction(async (tx) => {
        const point = tx.state.locations[0];
        expect(await tx.jurisdiction(point)).toBe(
          tx.state.reports[0].jurisdictionId,
        );
        expect(await tx.duplicates(point, 75, 7)).toContain(point.reportId);
      });
    });
    it("public table has coarse geometry only and immutable logs reject edits", async () => {
      const rows = await repo.pool.query(
        "SELECT data,ST_AsText(public_location) public_location FROM reports LIMIT 1",
      );
      expect(rows.rows[0].data).not.toHaveProperty("exactLocation");
      await expect(
        repo.pool.query("UPDATE audit_logs SET data='{}'"),
      ).rejects.toThrow(/append-only/);
      await expect(
        repo.pool.query("DELETE FROM report_events"),
      ).rejects.toThrow(/append-only/);
    });
    it("report transaction, unique idempotency, audit and cross-ward RBAC", async () => {
      const clientReportId = randomUUID();
      const mediaId = randomUUID();
      await repo.transaction(async (tx) => {
        tx.state.media.push({
          id: mediaId,
          ownerKey: clientReportId,
          reportId: null,
          kind: "before",
          originalKey: null,
          derivativeKey: null,
          sha256: "test",
          bytes: 100,
          width: 10,
          height: 10,
          mime: "image/jpeg",
          createdAt: new Date().toISOString(),
          safeForPublic: false,
        });
      });
      const input: ReportInput = {
        clientReportId,
        mediaId,
        locale: "bn-BD",
        category: "standing_water",
        description: "পানি জমেছে",
        locationNote: "",
        location: {
          lat: 23.742,
          lng: 90.377,
          accuracyMeters: 10,
          source: "manual",
        },
        capturedAt: new Date().toISOString(),
        consentVersion: "2026-10-v1",
        consent: true,
      };
      const service = new ReportService(repo);
      const first = await service.create(input, guest, clientReportId);
      expect(
        (await service.create(input, guest, clientReportId)).replayed,
      ).toBe(true);
      const record = await repo.transaction(
        async (tx) =>
          tx.state.reports.find((r) => r.publicId === first.report.publicId)!,
      );
      await service.transition(record.id, "under_review", officer);
      await expect(
        service.privateDetail(record.id, {
          ...officer,
          jurisdictions: ["demo-ward-b"],
        }),
      ).rejects.toMatchObject({ status: 403 });
      const result = await repo.pool.query(
        "SELECT count(*) FROM reports WHERE data->>'clientReportId'=$1",
        [clientReportId],
      );
      expect(Number(result.rows[0].count)).toBe(1);
    });
    it("failed transaction rolls back report state and audit", async () => {
      const before = await repo.pool.query("SELECT count(*) FROM audit_logs");
      await expect(
        repo.transaction(async (tx) => {
          tx.state.reports[0].description = "must roll back";
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      const after = await repo.pool.query("SELECT count(*) FROM audit_logs");
      expect(after.rows[0].count).toBe(before.rows[0].count);
      const reports = await repo.pool.query(
        "SELECT 1 FROM reports WHERE data->>'description'='must roll back'",
      );
      expect(reports.rowCount).toBe(0);
    });
    it("runtime permission group reads required state but cannot rewrite identity or audit records", async () => {
      const client = await repo.pool.connect();
      try {
        await client.query("SET ROLE denguespot_runtime");
        expect(
          (await client.query("SELECT id FROM reports LIMIT 1")).rowCount,
        ).toBe(1);
        await expect(
          client.query("UPDATE profiles SET data='{}' WHERE false"),
        ).rejects.toThrow(/permission denied/);
        await expect(
          client.query("UPDATE audit_logs SET data='{}' WHERE false"),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await client.query("RESET ROLE");
        client.release();
      }
    });
  },
);
