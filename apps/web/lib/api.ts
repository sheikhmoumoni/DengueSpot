import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import {
  AppError,
  authorizeAuthority,
  publicReport,
  locationSchema,
  statuses,
  csvCell,
  type Actor,
  type Report,
} from "../../../packages/domain/src/index";
import { repository, PostgresRepository } from "../../../packages/db/src/index";
import {
  demoEnabled,
  secret,
  assertConfig,
} from "../../../packages/config/src/index";
import {
  assertSameOrigin,
  MemoryRateLimiter,
  keyedHash,
  safeEqual,
  verifyQr,
} from "../../../packages/security/src/index";
import { ReportService, findReport, ownsReport, audit, event } from "./service";
import { actorFor, demoLogin, passwordLogin } from "./auth";
import { storeImage, MAX_IMAGE_BYTES } from "./media";
import { storage } from "../../../packages/providers/src/storage/index";
const limiter = new MemoryRateLimiter();
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
async function boundedBytes(request: Request, maximum: number) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maximum)
    throw new AppError(413, "BODY_TOO_LARGE", "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new AppError(413, "BODY_TOO_LARGE", "Request too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks, size));
}
async function body(request: Request) {
  const raw = new TextDecoder().decode(await boundedBytes(request, 32000));
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError(400, "INVALID_JSON", "Send valid JSON.");
  }
}
async function rate(actor: Actor, scope: string, limit: number) {
  const key = keyedHash(
    actor.role === "guest" ? "shared-public:" + scope : actor.id + ":" + scope,
    secret("SESSION_SECRET"),
  );
  const repo = repository();
  if (repo instanceof PostgresRepository) {
    const result = await repo.pool.query<{ count: number }>(
      "INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+interval '10 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+interval '10 minutes' ELSE rate_limits.reset_at END RETURNING count",
      [key],
    );
    if (result.rows[0].count > limit)
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Try again shortly.",
      );
  } else await limiter.consume(key, limit, 600000);
}
function stats(reports: Report[]) {
  const resolved = reports.filter((r) => r.status === "resolved");
  const durations = resolved
    .filter((r) => r.closedAt)
    .map((r) => (Date.parse(r.closedAt!) - Date.parse(r.createdAt)) / 3600000)
    .sort((a, b) => a - b);
  return {
    total: reports.length,
    new: reports.filter((r) => r.status === "submitted").length,
    pending: reports.filter((r) =>
      ["submitted", "under_review"].includes(r.status),
    ).length,
    assigned: reports.filter((r) =>
      ["assigned", "in_progress"].includes(r.status),
    ).length,
    overdue: reports.filter(
      (r) =>
        ![
          "resolved",
          "rejected",
          "withdrawn",
          "duplicate",
          "archived",
        ].includes(r.status) &&
        Date.now() - Date.parse(r.createdAt) > 48 * 3600000,
    ).length,
    resolved: resolved.length,
    resolvedToday: resolved.filter(
      (r) =>
        new Date(r.closedAt || 0).toLocaleDateString("en-CA", {
          timeZone: "Asia/Dhaka",
        }) ===
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
    ).length,
    medianResolutionHours: durations.length
      ? Math.round(durations[Math.floor(durations.length / 2)])
      : null,
    verifiedRatio: reports.length
      ? reports.filter((r) =>
          ["verified", "assigned", "in_progress", "resolved"].includes(
            r.status,
          ),
        ).length / reports.length
      : 0,
    duplicateRatio: reports.length
      ? reports.filter((r) => r.status === "duplicate").length / reports.length
      : 0,
  };
}
export async function handleApi(
  request: Request,
  segments: string[],
): Promise<Response> {
  const requestId = randomUUID();
  try {
    assertConfig();
    assertSameOrigin(request);
    const url = new URL(request.url);
    const route = segments.join("/");
    const method = request.method;
    const actor = await actorFor(request);
    const service = new ReportService();
    const tracking = request.headers.get("x-tracking-token");
    if (method !== "GET")
      await rate(
        actor,
        route.startsWith("auth") ? "auth" : "write",
        route.startsWith("auth") ? 20 : 120,
      );
    if (route === "health")
      return json({ status: "ok", demo: demoEnabled(), requestId });
    if (route === "ready") {
      await repository().health();
      return json({ status: "ready" });
    }
    if (route === "config")
      return json({
        demo: demoEnabled(),
        mapTileUrl: process.env.MAP_TILE_URL || null,
        mapAttribution: process.env.MAP_ATTRIBUTION || null,
        privacyContact: process.env.PRIVACY_CONTACT || null,
        aiEnabled: process.env.AI_TRIAGE_ENABLED === "true",
        consentVersion: "2026-10-v1",
      });
    if (route === "auth/session" && method === "GET") return json({ actor });
    if (route === "auth/login" && method === "POST") {
      const input = z
        .object({
          email: z.email().max(254),
          password: z.string().min(8).max(200),
        })
        .strict()
        .parse(await body(request));
      const result = await passwordLogin(input.email, input.password);
      return json(
        { actor: { id: "authenticated", role: "citizen", jurisdictions: [] } },
        200,
        {
          "Set-Cookie": `dsp_access=${result.accessToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${result.expiresIn}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        },
      );
    }
    if (route === "auth/demo" && method === "POST") {
      const input = z
        .object({
          profileId: z.string().max(100),
          password: z.string().max(200),
        })
        .strict()
        .parse(await body(request));
      const result = await demoLogin(input.profileId, input.password);
      return json({ actor: result.profile }, 200, {
        "Set-Cookie": `dsp_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      });
    }
    if (route === "auth/logout" && method === "POST") {
      const raw = request.headers
        .get("cookie")
        ?.split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("dsp_session="))
        ?.slice(12);
      if (raw)
        await repository().transaction(async (tx) => {
          tx.state.sessions = tx.state.sessions.filter(
            (s) => s.hash !== keyedHash(raw, secret("SESSION_SECRET")),
          );
        });
      const response = json({ ok: true });
      response.headers.append(
        "Set-Cookie",
        "dsp_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      response.headers.append(
        "Set-Cookie",
        "dsp_access=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      );
      return response;
    }
    if (route === "media/uploads" && method === "POST") {
      if (
        Number(request.headers.get("content-length") || 0) >
        MAX_IMAGE_BYTES + 32000
      )
        throw new AppError(
          413,
          "MEDIA_SIZE",
          "Image must be smaller than 8 MB.",
        );
      const bytes = await boundedBytes(request, MAX_IMAGE_BYTES + 32000);
      const data = await new Response(bytes, {
        headers: { "Content-Type": request.headers.get("content-type") || "" },
      }).formData();
      const clientReportId = z.uuid().parse(data.get("clientReportId"));
      if (data.get("consent") !== "true")
        throw new AppError(
          422,
          "CONSENT_REQUIRED",
          "Consent is required before upload.",
        );
      const kind = z
        .enum(["before", "after"])
        .parse(data.get("kind") || "before");
      const file = data.get("photo");
      if (!(file instanceof File))
        throw new AppError(422, "MEDIA_REQUIRED", "Photo required.");
      if (file.size > MAX_IMAGE_BYTES)
        throw new AppError(
          413,
          "MEDIA_SIZE",
          "Image must be smaller than 8 MB.",
        );
      let reportId: string | null = null;
      if (kind === "after") {
        const report = await repository().transaction(async (tx) =>
          findReport(tx.state, String(data.get("reportId") || "")),
        );
        authorizeAuthority(actor, report);
        reportId = report.id;
      }
      const existing = await repository().transaction(async (tx) =>
        tx.state.media.find(
          (m) =>
            m.ownerKey === clientReportId &&
            m.kind === kind &&
            m.reportId === reportId,
        ),
      );
      if (existing) return json({ mediaId: existing.id, replayed: true });
      const media = await storeImage(
        Buffer.from(await file.arrayBuffer()),
        file.type,
        clientReportId,
        kind,
      );
      media.reportId = reportId;
      await repository().transaction(async (tx) => {
        tx.state.media.push(media);
        audit(tx.state, actor, "media.upload", media.id);
      });
      return json({ mediaId: media.id, privacyReviewRequired: true }, 201);
    }
    if (segments[0] === "media" && segments.length === 2 && method === "GET") {
      const result = await repository().transaction(async (tx) => {
        const m = tx.state.media.find((m) => m.id === segments[1]);
        if (!m || !m.reportId)
          throw new AppError(404, "NOT_FOUND", "Media not found.");
        const r = findReport(tx.state, m.reportId);
        const original = url.searchParams.get("original") === "true";
        const owner = ownsReport(actor, r, tracking);
        const officer =
          ["authority_officer", "authority_supervisor"].includes(actor.role) &&
          actor.jurisdictions.includes(r.jurisdictionId);
        const moderator = actor.role === "moderator" && !original;
        const publicAllowed =
          !original &&
          m.safeForPublic &&
          r.privacyReviewed &&
          !r.hidden &&
          !["rejected", "withdrawn", "archived"].includes(r.status);
        if (!owner && !officer && !moderator && !publicAllowed)
          throw new AppError(
            actor.role === "guest" ? 401 : 403,
            "FORBIDDEN",
            "Media access denied.",
          );
        if (original && !owner && !officer)
          throw new AppError(403, "FORBIDDEN", "Original media access denied.");
        if (!publicAllowed) audit(tx.state, actor, "media.read", m.id);
        return {
          key: original ? m.originalKey : m.derivativeKey,
          mime: original ? m.mime : "image/jpeg",
        };
      });
      if (!result.key)
        throw new AppError(410, "MEDIA_REMOVED", "Media has been removed.");
      const bytes = await storage().get(result.key);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": result.mime,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (route === "reports" && method === "POST") {
      const result = await service.create(
        await body(request),
        actor,
        request.headers.get("idempotency-key") || "",
      );
      return json(result, result.replayed ? 200 : 201);
    }
    if (route === "reports" && method === "GET") {
      const all = await service.publicList();
      const category = url.searchParams.get("category");
      const status = url.searchParams.get("status");
      const since = url.searchParams.get("since");
      return json({
        reports: all.filter(
          (r) =>
            (!category || r.category === category) &&
            (!status || r.status === status) &&
            (!since || r.createdAt >= since),
        ),
      });
    }
    if (route === "reports/duplicates" && method === "POST") {
      const p = locationSchema
        .pick({ lat: true, lng: true })
        .parse(await body(request));
      return json({ reports: await service.duplicates(p) });
    }
    if (route === "my-reports" && method === "GET") {
      if (actor.role === "guest")
        throw new AppError(
          401,
          "AUTH_REQUIRED",
          "Sign in to see account reports.",
        );
      return await repository().transaction(async (tx) =>
        json({
          reports: tx.state.reports
            .filter((r) => r.ownerId === actor.id)
            .map(publicReport),
        }),
      );
    }
    if (segments[0] === "reports" && segments.length >= 2) {
      const id = segments[1];
      const action = segments[2];
      if (!action && method === "GET")
        return await repository().transaction(async (tx) => {
          const r = findReport(tx.state, id);
          const owner = ownsReport(actor, r, tracking);
          if (
            (r.hidden ||
              ["withdrawn", "rejected", "archived"].includes(r.status)) &&
            !owner
          )
            throw new AppError(404, "NOT_FOUND", "Report not found.");
          return json({
            report: publicReport(r),
            events: tx.state.events
              .filter((e) => e.reportId === r.id)
              .map((e) => ({
                type: e.type,
                status: e.to,
                createdAt: e.createdAt,
              })),
            media: tx.state.media
              .filter(
                (m) =>
                  m.reportId === r.id &&
                  (owner || (m.safeForPublic && r.privacyReviewed)),
              )
              .map((m) => ({ id: m.id, kind: m.kind })),
            privateTracking: owner,
            duplicateOf: r.duplicateOf,
          });
        });
      if (action === "private" && method === "GET")
        return json(await service.privateDetail(id, actor));
      if (action === "events" && method === "GET")
        return await repository().transaction(async (tx) => {
          const r = findReport(tx.state, id);
          if (!ownsReport(actor, r, tracking)) authorizeAuthority(actor, r);
          return json({
            events: tx.state.events.filter((e) => e.reportId === r.id),
          });
        });
      if (
        ["verify", "assign", "status", "resolve"].includes(action) &&
        ["POST", "PATCH"].includes(method)
      ) {
        const input = z
          .object({
            status: z.enum(statuses).optional(),
            note: z.string().max(1000).optional(),
            assignee: z.string().max(120).optional(),
            mediaId: z.uuid().optional(),
          })
          .strict()
          .parse(await body(request));
        const to =
          action === "verify"
            ? "verified"
            : action === "assign"
              ? "assigned"
              : action === "resolve"
                ? "resolved"
                : input.status;
        if (!to) throw new AppError(422, "STATUS_REQUIRED", "Status required.");
        if (
          action === "status" &&
          ["verified", "assigned", "resolved"].includes(to)
        )
          throw new AppError(
            422,
            "SPECIALIZED_ACTION_REQUIRED",
            "Use the verification, assignment or resolution endpoint.",
          );
        const current = await repository().transaction(async (tx) => {
          const r = findReport(tx.state, id);
          authorizeAuthority(actor, r);
          return r;
        });
        if (current.status === to)
          return json({ report: publicReport(current), replayed: true });
        return json({
          report: await service.transition(
            id,
            to,
            actor,
            input.note || "",
            input.assignee,
            input.mediaId,
          ),
        });
      }
      if (action === "evidence" && method === "POST") {
        const input = z
          .object({ mediaId: z.uuid() })
          .strict()
          .parse(await body(request));
        return await repository().transaction(async (tx) => {
          const r = findReport(tx.state, id);
          authorizeAuthority(actor, r);
          const media = tx.state.media.find(
            (m) =>
              m.id === input.mediaId &&
              m.reportId === r.id &&
              m.kind === "after",
          );
          if (!media)
            throw new AppError(
              422,
              "MEDIA_REQUIRED",
              "Upload resolution evidence first.",
            );
          audit(tx.state, actor, "evidence.attach", r.id);
          return json({ ok: true });
        });
      }
      if (action === "flags" && method === "POST") {
        const input = z
          .object({
            reason: z.enum([
              "spam",
              "duplicate",
              "privacy",
              "harassment",
              "illegal_content",
              "unrelated",
              "unsafe_media",
              "misleading",
              "other",
            ]),
          })
          .strict()
          .parse(await body(request));
        return await repository().transaction(async (tx) => {
          const r = findReport(tx.state, id);
          event(tx.state, r, actor, "flagged", null, input.reason);
          audit(tx.state, actor, "report.flag", r.id);
          return json({ ok: true }, 201);
        });
      }
      if (action === "duplicate" && method === "POST") {
        const input = z
          .object({
            target: z.string().max(100),
            reason: z.string().min(1).max(500),
          })
          .strict()
          .parse(await body(request));
        return json({
          report: await service.moderate(
            id,
            "duplicate",
            input.reason,
            actor,
            input.target,
          ),
        });
      }
    }
    if (
      [
        "authority/dashboard",
        "authority/reports",
        "analytics/authority",
        "authority/export",
      ].includes(route) &&
      method === "GET"
    ) {
      authorizeAuthority(actor);
      return await repository().transaction(async (tx) => {
        const reports = tx.state.reports.filter((r) =>
          actor.jurisdictions.includes(r.jurisdictionId),
        );
        if (route === "authority/dashboard" || route === "analytics/authority")
          return json({
            ...stats(reports),
            proofOfResolutionRatio: reports.filter(
              (r) => r.status === "resolved",
            ).length
              ? reports.filter(
                  (r) =>
                    r.status === "resolved" &&
                    tx.state.media.some(
                      (m) => m.reportId === r.id && m.kind === "after",
                    ),
                ).length / reports.filter((r) => r.status === "resolved").length
              : 0,
            jurisdictions: tx.state.jurisdictions
              .filter((j) => actor.jurisdictions.includes(j.id))
              .map((j) => ({ id: j.id, name: j.name })),
          });
        if (route === "authority/reports")
          return json({
            reports: reports.map((r) => ({
              ...publicReport(r),
              id: r.id,
              assignee: r.assignee,
              hidden: r.hidden,
              flags: tx.state.events.filter(
                (e) => e.reportId === r.id && e.type === "flagged",
              ).length,
            })),
          });
        if (actor.role !== "authority_supervisor")
          throw new AppError(
            403,
            "FORBIDDEN",
            "Supervisor export permission required.",
          );
        audit(tx.state, actor, "reports.export", actor.jurisdictions.join(","));
        if (url.searchParams.get("format") === "geojson") {
          const exact = url.searchParams.get("exact") === "true";
          return json({
            type: "FeatureCollection",
            features: reports.map((r) => {
              const p = exact
                ? tx.state.locations.find((l) => l.reportId === r.id) ||
                  r.publicLocation
                : r.publicLocation;
              return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [p.lng, p.lat] },
                properties: {
                  publicId: r.publicId,
                  category: r.category,
                  status: r.status,
                },
              };
            }),
          });
        }
        const csv = [
          ["Public ID", "Category", "Area", "Status", "Assignee"]
            .map(csvCell)
            .join(","),
          ...reports.map((r) =>
            [r.publicId, r.category, r.area, r.status, r.assignee || ""]
              .map(csvCell)
              .join(","),
          ),
        ].join("\r\n");
        return new Response("\uFEFF" + csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="denguespot-demo.csv"',
            "Cache-Control": "no-store",
          },
        });
      });
    }
    if (route === "analytics/public" && method === "GET")
      return await repository().transaction(async (tx) => {
        const reports = tx.state.reports.filter(
          (r) =>
            !r.hidden &&
            !["withdrawn", "rejected", "archived"].includes(r.status),
        );
        return json({
          total: reports.length,
          resolved: reports.filter((r) => r.status === "resolved").length,
          working: reports.filter((r) =>
            ["assigned", "in_progress"].includes(r.status),
          ).length,
          byArea: tx.state.jurisdictions
            .map((j) => ({
              area: j.name,
              count: reports.filter((r) => r.jurisdictionId === j.id).length,
            }))
            .filter((a) => a.count >= 5),
        });
      });
    if (route === "moderation" && method === "GET") {
      if (actor.role !== "moderator")
        throw new AppError(
          actor.role === "guest" ? 401 : 403,
          "FORBIDDEN",
          "Moderator permission required.",
        );
      return await repository().transaction(async (tx) =>
        json({
          reports: tx.state.reports
            .filter((r) => !["withdrawn", "archived"].includes(r.status))
            .map((r) => ({
              ...publicReport(r),
              id: r.id,
              description: r.description,
              hidden: r.hidden,
              media: tx.state.media
                .filter((m) => m.reportId === r.id)
                .map((m) => ({ id: m.id, kind: m.kind })),
              flags: tx.state.events
                .filter((e) => e.reportId === r.id && e.type === "flagged")
                .map((e) => e.note),
            })),
        }),
      );
    }
    if (segments[0] === "moderation" && segments[1] && method === "POST") {
      const input = z
        .object({
          action: z.enum(["hide", "release", "reject", "duplicate"]),
          reason: z.string().min(1).max(500),
          target: z.string().max(100).optional(),
        })
        .strict()
        .parse(await body(request));
      return json({
        report: await service.moderate(
          segments[1],
          input.action,
          input.reason,
          actor,
          input.target,
        ),
      });
    }
    if (route === "qr/resolve" && method === "POST") {
      const input = z
        .object({ token: z.string().max(2000) })
        .strict()
        .parse(await body(request));
      return json({
        location: verifyQr(input.token, secret("QR_SIGNING_SECRET")),
      });
    }
    if (
      segments[0] === "data-rights" &&
      segments[1] === "requests" &&
      method === "GET"
    ) {
      const receiptId = z.uuid().parse(segments[2]);
      return await repository().transaction(async (tx) => {
        const receipt = tx.state.requests.find((r) => r.id === receiptId);
        if (!receipt)
          throw new AppError(404, "NOT_FOUND", "Request not found.");
        const report = findReport(tx.state, receipt.reportId);
        if (!ownsReport(actor, report, tracking))
          throw new AppError(
            403,
            "TRACKING_REQUIRED",
            "Tracking credential required.",
          );
        return json({
          request: {
            id: receipt.id,
            type: receipt.type,
            status: receipt.status,
            createdAt: receipt.createdAt,
          },
        });
      });
    }
    if (route.startsWith("data-rights/") && method === "POST") {
      const input = z
        .object({ publicId: z.string().max(100) })
        .strict()
        .parse(await body(request));
      const action = z
        .enum(["access", "delete", "withdraw"])
        .parse(segments[1]);
      return await service.withOwner(
        input.publicId,
        actor,
        tracking,
        async (tx, r) => {
          const receipt = {
            id: randomUUID(),
            reportId: r.id,
            type: action,
            status: "completed" as const,
            createdAt: new Date().toISOString(),
          };
          tx.state.requests.push(receipt);
          audit(tx.state, actor, "rights." + action, r.id);
          if (action === "access")
            return json({
              request: receipt,
              information: {
                report: publicReport(r),
                submittedDescription: r.description,
                submittedCaptureTime: r.capturedAt || null,
                exactLocation: tx.state.locations.find(
                  (l) => l.reportId === r.id,
                ),
                consent: { version: r.consentVersion, createdAt: r.createdAt },
                media: tx.state.media
                  .filter((m) => m.reportId === r.id)
                  .map((m) => ({
                    id: m.id,
                    sha256: m.sha256,
                    createdAt: m.createdAt,
                  })),
                events: tx.state.events
                  .filter((e) => e.reportId === r.id)
                  .map((e) => ({
                    type: e.type,
                    createdAt: e.createdAt,
                    status: e.to,
                  })),
              },
            });
          if (action === "delete") {
            if (r.legalHold)
              throw new AppError(
                409,
                "LEGAL_HOLD",
                "This request needs a privacy officer review due to a legal hold.",
              );
            for (const m of tx.state.media.filter((m) => m.reportId === r.id)) {
              if (m.originalKey) await storage().remove(m.originalKey);
              if (m.derivativeKey) await storage().remove(m.derivativeKey);
              m.originalKey = null;
              m.derivativeKey = null;
              m.safeForPublic = false;
              m.ownerKey = "deleted";
            }
            tx.state.locations = tx.state.locations.filter(
              (l) => l.reportId !== r.id,
            );
            r.description = "";
            r.locationNote = "";
            r.ownerId = null;
            r.resolutionNote = null;
            r.hidden = true;
            event(tx.state, r, actor, "data_deleted", "withdrawn");
            r.status = "withdrawn";
          } else
            event(
              tx.state,
              r,
              actor,
              "optional_consent_withdrawn",
              null,
              "Optional processing disabled",
            );
          return json({ request: { ...receipt, reportId: undefined } });
        },
      );
    }
    if (route.startsWith("webhooks/sms/") && method === "POST") {
      if (process.env.SMS_ENABLED !== "true")
        throw new AppError(503, "PROVIDER_DISABLED", "SMS is not configured.");
      const raw = new TextDecoder().decode(await boundedBytes(request, 32000));
      const signature = request.headers.get("x-dsp-signature") || "";
      if (
        !safeEqual(signature, keyedHash(raw, secret("WEBHOOK_SIGNING_SECRET")))
      )
        throw new AppError(
          401,
          "WEBHOOK_SIGNATURE",
          "Invalid webhook signature.",
        );
      throw new AppError(
        501,
        "CONTRACT_REQUIRED",
        "Provider payload mapping requires a contracted adapter.",
      );
    }
    if (route === "internal/ai/assess")
      throw new AppError(
        403,
        "INTERNAL_ONLY",
        "Assessment is available only to the background worker.",
      );
    throw new AppError(404, "NOT_FOUND", "Endpoint not found.");
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Check the submitted fields.",
            fieldErrors: z.flattenError(error).fieldErrors,
          },
          requestId,
        },
        422,
      );
    if (error instanceof AppError)
      return json(
        {
          error: { code: error.code, message: error.message, fieldErrors: {} },
          requestId,
        },
        error.status,
      );
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        event: "api_failure",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    return json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "The request could not be completed.",
          fieldErrors: {},
        },
        requestId,
      },
      500,
    );
  }
}
