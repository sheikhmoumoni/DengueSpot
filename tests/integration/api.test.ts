import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { handleApi } from "../../apps/web/lib/api";
import { demoLogin } from "../../apps/web/lib/auth";
import { repository } from "../../packages/db/src/index";
import { type ReportInput } from "../../packages/domain/src/index";
import { secret } from "../../packages/config/src/index";
import { keyedHash } from "../../packages/security/src/index";
const request = (
  route: string,
  method = "GET",
  data?: unknown,
  headers: Record<string, string> = {},
) =>
  handleApi(
    new Request("http://localhost:3000/api/v1/" + route, {
      method,
      headers: {
        ...(data instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...headers,
      },
      body:
        data === undefined
          ? undefined
          : data instanceof FormData
            ? data
            : JSON.stringify(data),
    }),
    route.split("?")[0].split("/"),
  );
let officerCookie: string;
let moderatorCookie: string;
beforeAll(async () => {
  officerCookie =
    "dsp_session=" +
    (await demoLogin("demo-officer-a", process.env.DEMO_LOGIN_PASSWORD!)).token;
  moderatorCookie =
    "dsp_session=" +
    (await demoLogin("demo-moderator", process.env.DEMO_LOGIN_PASSWORD!)).token;
});
async function submit() {
  const clientReportId = randomUUID();
  const photo = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "#8ba" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set(
    "photo",
    new Blob([new Uint8Array(photo)], { type: "image/png" }),
    "photo.png",
  );
  form.set("clientReportId", clientReportId);
  form.set("kind", "before");
  form.set("consent", "true");
  const upload = await request("media/uploads", "POST", form);
  expect(upload.status).toBe(201);
  const mediaId = ((await upload.json()) as { mediaId: string }).mediaId;
  const input: ReportInput = {
    clientReportId,
    mediaId,
    category: "standing_water",
    locale: "bn-BD",
    description: "বাংলা বিবরণ <script>alert(1)</script>",
    locationNote: "private note",
    location: {
      lat: 23.742,
      lng: 90.377,
      source: "manual",
      accuracyMeters: 10,
    },
    capturedAt: new Date().toISOString(),
    consentVersion: "2026-10-v1",
    consent: true,
  };
  const response = await request("reports", "POST", input, {
    "Idempotency-Key": clientReportId,
  });
  expect(response.status).toBe(201);
  return {
    ...((await response.json()) as {
      report: { publicId: string; status: string };
      trackingToken: string;
    }),
    input,
    mediaId,
  };
}
describe("HTTP security and transactional workflow", () => {
  it("public and foreign-jurisdiction private endpoints deny access", async () => {
    const records = await repository().transaction(
      async (tx) => tx.state.reports,
    );
    const foreign = records.find((r) => r.jurisdictionId === "demo-ward-b")!;
    expect(
      (await request("reports/" + foreign.publicId + "/private")).status,
    ).toBe(401);
    expect(
      (
        await request("reports/" + foreign.id + "/private", "GET", undefined, {
          Cookie: officerCookie,
        })
      ).status,
    ).toBe(403);
    const publicResponse = await request("reports");
    const content = await publicResponse.text();
    expect(content).not.toMatch(
      /exactLocation|trackingHash|ownerId|clientReportId|accuracyMeters|originalKey/,
    );
  });
  it("anonymous upload → report → retry → resolution → human privacy publication", async () => {
    const result = await submit();
    const replay = await request("reports", "POST", result.input, {
      "Idempotency-Key": result.input.clientReportId,
    });
    expect(replay.status).toBe(200);
    expect(
      ((await replay.json()) as { trackingToken: string }).trackingToken,
    ).toBe(result.trackingToken);
    const record = await repository().transaction(
      async (tx) =>
        tx.state.reports.find((r) => r.publicId === result.report.publicId)!,
    );
    expect(record.trackingHash).toBe(
      keyedHash(result.trackingToken, secret("TRACKING_TOKEN_PEPPER")),
    );
    expect(record.description).toContain("বাংলা");
    expect(
      (await request("media/" + result.mediaId + "?original=true")).status,
    ).toBe(401);
    expect((await request("media/" + result.mediaId)).status).toBe(401);
    expect(
      (
        await request(
          "media/" + result.mediaId + "?original=true",
          "GET",
          undefined,
          { "x-tracking-token": result.trackingToken },
        )
      ).status,
    ).toBe(200);
    for (const [route, data, method] of [
      ["status", { status: "under_review" }, "PATCH"],
      ["verify", { note: "Actionable condition" }, "POST"],
      ["assign", { assignee: "Synthetic crew" }, "POST"],
      ["status", { status: "in_progress" }, "PATCH"],
    ] as const) {
      expect(
        (
          await request(`reports/${record.id}/${route}`, method, data, {
            Cookie: officerCookie,
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await request(
          `reports/${record.id}/resolve`,
          "POST",
          { note: "Cleaned" },
          { Cookie: officerCookie },
        )
      ).status,
    ).toBe(422);
    const image = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "#faf" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set(
      "photo",
      new Blob([new Uint8Array(image)], { type: "image/png" }),
      "after.png",
    );
    form.set("clientReportId", randomUUID());
    form.set("kind", "after");
    form.set("reportId", record.id);
    form.set("consent", "true");
    const after = await request("media/uploads", "POST", form, {
      Cookie: officerCookie,
    });
    expect(after.status).toBe(201);
    const mediaId = ((await after.json()) as { mediaId: string }).mediaId;
    expect(
      (
        await request(
          `reports/${record.id}/resolve`,
          "POST",
          { note: "Water removed", mediaId },
          { Cookie: officerCookie },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "moderation/" + record.id,
          "POST",
          {
            action: "release",
            reason: "Reviewed: no faces, plates or identifying text",
          },
          { Cookie: moderatorCookie },
        )
      ).status,
    ).toBe(200);
    const publicDetail = await request("reports/" + result.report.publicId);
    expect(
      ((await publicDetail.json()) as { report: { status: string } }).report
        .status,
    ).toBe("resolved");
    expect((await request("media/" + mediaId)).status).toBe(200);
    const events = await repository().transaction(async (tx) =>
      tx.state.events.filter((e) => e.reportId === record.id),
    );
    expect(events.some((e) => e.to === "resolved")).toBe(true);
  });
  it("moderator cannot fetch originals, system admin cannot read private GPS", async () => {
    const report = await submit();
    const admin =
      "dsp_session=" +
      (await demoLogin("demo-admin", process.env.DEMO_LOGIN_PASSWORD!)).token;
    expect(
      (
        await request(
          "reports/" + report.report.publicId + "/private",
          "GET",
          undefined,
          { Cookie: admin },
        )
      ).status,
    ).toBe(403);
    const req = new Request(
      "http://localhost:3000/api/v1/media/" + report.mediaId + "?original=true",
      { headers: { Cookie: moderatorCookie } },
    );
    expect((await handleApi(req, ["media", report.mediaId])).status).toBe(403);
  });
  it("owner rights use private tracking, remove exact GPS/media and preserve only minimal audit", async () => {
    const result = await submit();
    expect(
      (
        await request("data-rights/access", "POST", {
          publicId: result.report.publicId,
        })
      ).status,
    ).toBe(403);
    const access = await request(
      "data-rights/access",
      "POST",
      { publicId: result.report.publicId },
      { "x-tracking-token": result.trackingToken },
    );
    expect(access.status).toBe(200);
    expect(
      ((await access.json()) as { information: { exactLocation: unknown } })
        .information.exactLocation,
    ).toBeTruthy();
    const deleted = await request(
      "data-rights/delete",
      "POST",
      { publicId: result.report.publicId },
      { "x-tracking-token": result.trackingToken },
    );
    expect(deleted.status).toBe(200);
    const receipt = (await deleted.json()) as { request: { id: string } };
    expect(
      (await request("data-rights/requests/" + receipt.request.id)).status,
    ).toBe(403);
    expect(
      (
        await request(
          "data-rights/requests/" + receipt.request.id,
          "GET",
          undefined,
          { "x-tracking-token": result.trackingToken },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "moderation/" + result.report.publicId,
          "POST",
          { action: "release", reason: "Must never republish deleted content" },
          { Cookie: moderatorCookie },
        )
      ).status,
    ).toBe(409);
    expect((await request("reports/" + result.report.publicId)).status).toBe(
      404,
    );
    const state = await repository().transaction(async (tx) => tx.state);
    const record = state.reports.find(
      (r) => r.publicId === result.report.publicId,
    )!;
    expect(state.locations.some((l) => l.reportId === record.id)).toBe(false);
    expect(record.description).toBe("");
    expect(
      state.audits.some(
        (a) => a.action === "rights.delete" && a.recordId === record.id,
      ),
    ).toBe(true);
  });
  it("moderator hides report and unauthenticated writes fail", async () => {
    const result = await submit();
    expect(
      (
        await request(
          "moderation/" + result.report.publicId,
          "POST",
          { action: "hide", reason: "Privacy concern" },
          { Cookie: moderatorCookie },
        )
      ).status,
    ).toBe(200);
    expect((await request("reports/" + result.report.publicId)).status).toBe(
      404,
    );
    expect(
      (
        await request("reports/" + result.report.publicId + "/assign", "POST", {
          assignee: "test",
        })
      ).status,
    ).toBe(401);
  });
  it("CSRF and disabled provider webhooks fail closed", async () => {
    expect(
      (
        await request(
          "auth/demo",
          "POST",
          { profileId: "demo-admin", password: "irrelevant" },
          { Origin: "https://attacker.invalid" },
        )
      ).status,
    ).toBe(403);
    expect((await request("webhooks/sms/mock", "POST", {})).status).toBe(503);
  });
  it("bounds chunked JSON bodies before parsing without trusting Content-Length", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(33000)));
        controller.close();
      },
    });
    const oversized = new Request("http://localhost:3000/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await handleApi(oversized, ["reports"])).status).toBe(413);
  });
});
