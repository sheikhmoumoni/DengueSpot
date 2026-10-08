import { randomUUID, randomBytes } from "node:crypto";
import {
  repository,
  type Repository,
  type Transaction,
} from "../../../packages/db/src/index";
import {
  AppError,
  authorizeAuthority,
  assertTransition,
  coarsenLocation,
  duplicateCandidates,
  publicReport,
  reportInputSchema,
  type Actor,
  type Report,
  type State,
  type Status,
} from "../../../packages/domain/src/index";
import {
  auditHash,
  keyedHash,
  safeEqual,
  trackingToken,
} from "../../../packages/security/src/index";
import { secret, numeric } from "../../../packages/config/src/index";
export function audit(
  state: State,
  actor: Actor,
  action: string,
  recordId: string,
) {
  const entry = {
    id: randomUUID(),
    actorId: actor.id,
    action,
    recordId,
    createdAt: new Date().toISOString(),
  };
  const previousHash = state.audits.at(-1)?.hash || "";
  state.audits.push({
    ...entry,
    previousHash,
    hash: auditHash(entry, previousHash, secret("AUDIT_HASH_SECRET")),
  });
}
export function event(
  state: State,
  report: Report,
  actor: Actor,
  type: string,
  to: Status | null,
  note = "",
) {
  state.events.push({
    id: randomUUID(),
    reportId: report.id,
    type,
    from: report.status,
    to,
    actorId: actor.id,
    note,
    createdAt: new Date().toISOString(),
  });
}
export function findReport(state: State, id: string) {
  const r = state.reports.find((r) => r.id === id || r.publicId === id);
  if (!r) throw new AppError(404, "NOT_FOUND", "Report not found.");
  return r;
}
export function ownsReport(actor: Actor, r: Report, token: string | null) {
  return (
    (actor.role !== "guest" && r.ownerId === actor.id) ||
    (!!token &&
      safeEqual(
        keyedHash(token, secret("TRACKING_TOKEN_PEPPER")),
        r.trackingHash,
      ))
  );
}
export function assertOwner(actor: Actor, r: Report, token: string | null) {
  if (!ownsReport(actor, r, token))
    throw new AppError(
      403,
      "TRACKING_REQUIRED",
      "A valid private tracking credential is required.",
    );
}
export class ReportService {
  constructor(private repo: Repository = repository()) {}
  async create(raw: unknown, actor: Actor, key: string) {
    const input = reportInputSchema.parse(raw);
    if (key !== input.clientReportId)
      throw new AppError(
        400,
        "IDEMPOTENCY_KEY",
        "Idempotency-Key must match clientReportId.",
      );
    if (Date.parse(input.capturedAt) > Date.now() + 300000)
      throw new AppError(
        422,
        "INVALID_CAPTURE_TIME",
        "Capture time is in the future.",
      );
    return this.repo.transaction(async (tx) => {
      const requestHash = keyedHash(
        JSON.stringify(input),
        secret("TRACKING_TOKEN_PEPPER"),
      );
      const existing = tx.state.reports.find((r) => r.clientReportId === key);
      const token = trackingToken(key, secret("TRACKING_TOKEN_PEPPER"));
      if (existing) {
        if (
          existing.requestHash !== requestHash ||
          existing.ownerId !== (actor.role === "guest" ? null : actor.id)
        )
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This client report ID was already used with different content.",
          );
        if (["withdrawn", "archived"].includes(existing.status))
          throw new AppError(
            410,
            "REPORT_REMOVED",
            "This report has been removed.",
          );
        return {
          report: publicReport(existing),
          trackingToken: token,
          replayed: true,
        };
      }
      const media = tx.state.media.find(
        (m) =>
          m.id === input.mediaId &&
          m.ownerKey === key &&
          !m.reportId &&
          m.kind === "before",
      );
      if (!media)
        throw new AppError(
          422,
          "MEDIA_REQUIRED",
          "Upload evidence for this report first.",
        );
      const jurisdictionId = await tx.jurisdiction(input.location);
      if (!jurisdictionId)
        throw new AppError(
          422,
          "OUTSIDE_PILOT",
          "This location is outside the configured demonstration wards.",
        );
      const now = new Date().toISOString();
      const report: Report = {
        id: randomUUID(),
        publicId: "DSP-" + randomBytes(6).toString("hex").toUpperCase(),
        clientReportId: key,
        ownerId: actor.role === "guest" ? null : actor.id,
        trackingHash: keyedHash(token, secret("TRACKING_TOKEN_PEPPER")),
        category: input.category,
        description: input.description,
        locationNote: input.locationNote,
        locale: input.locale,
        publicLocation: coarsenLocation(
          input.location,
          numeric("PUBLIC_LOCATION_GRID_METERS", 150, 100, 1000),
        ),
        jurisdictionId,
        area: tx.state.jurisdictions.find((j) => j.id === jurisdictionId)!.name,
        status: "submitted",
        createdAt: now,
        updatedAt: now,
        capturedAt: input.capturedAt,
        closedAt: null,
        hidden: false,
        privacyReviewed: false,
        assignee: null,
        resolutionNote: null,
        duplicateOf: null,
        consentVersion: input.consentVersion,
        legalHold: false,
        requestHash,
      };
      tx.state.reports.push(report);
      tx.state.locations.push({ reportId: report.id, ...input.location });
      media.reportId = report.id;
      event(
        tx.state,
        report,
        actor,
        "submitted",
        "submitted",
        "Consent " + input.consentVersion,
      );
      audit(tx.state, actor, "report.submit", report.id);
      tx.state.jobs.push({
        id: randomUUID(),
        reportId: report.id,
        kind: "notification",
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
      });
      return {
        report: publicReport(report),
        trackingToken: token,
        replayed: false,
      };
    });
  }
  async publicList() {
    return this.repo.transaction(async (tx) =>
      tx.state.reports
        .filter(
          (r) =>
            !r.hidden &&
            !["withdrawn", "rejected", "archived"].includes(r.status),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200)
        .map(publicReport),
    );
  }
  async duplicates(point: { lat: number; lng: number }) {
    return this.repo.transaction(async (tx) => {
      const radius = numeric("DUPLICATE_RADIUS_METERS", 75, 10, 500);
      const days = numeric("DUPLICATE_WINDOW_DAYS", 7, 1, 30);
      const spatial = await tx.duplicates(point, radius, days);
      if (spatial)
        return tx.state.reports
          .filter(
            (r) =>
              spatial.includes(r.id) &&
              !r.hidden &&
              !["withdrawn", "rejected", "archived", "duplicate"].includes(
                r.status,
              ),
          )
          .map(publicReport);
      return duplicateCandidates(tx.state, point, Date.now(), radius, days);
    });
  }
  async privateDetail(id: string, actor: Actor) {
    return this.repo.transaction(async (tx) => {
      const r = findReport(tx.state, id);
      authorizeAuthority(actor, r);
      audit(tx.state, actor, "location.read", r.id);
      return {
        report: {
          ...publicReport(r),
          id: r.id,
          description: r.description,
          locationNote: r.locationNote,
          assignee: r.assignee,
          resolutionNote: r.resolutionNote,
          hidden: r.hidden,
          closedAt: r.closedAt,
        },
        exactLocation:
          tx.state.locations.find((l) => l.reportId === r.id) || null,
        events: tx.state.events.filter((e) => e.reportId === r.id),
        media: tx.state.media
          .filter((m) => m.reportId === r.id)
          .map((m) => ({
            id: m.id,
            kind: m.kind,
            safeForPublic: m.safeForPublic,
          })),
        aiAdvisory: null,
      };
    });
  }
  async transition(
    id: string,
    to: Status,
    actor: Actor,
    note = "",
    assignee?: string,
    mediaId?: string,
  ) {
    return this.repo.transaction(async (tx) => {
      const r = findReport(tx.state, id);
      authorizeAuthority(actor, r);
      const after = mediaId
        ? tx.state.media.find(
            (m) =>
              m.id === mediaId && m.reportId === r.id && m.kind === "after",
          )
        : null;
      assertTransition(
        r.status,
        to,
        actor,
        to === "resolved" ? !!after && !!note.trim() : false,
      );
      if (to === "assigned" && !assignee?.trim())
        throw new AppError(422, "ASSIGNEE_REQUIRED", "Choose a cleanup team.");
      if (to === "verified" && note.trim().length < 3)
        throw new AppError(
          422,
          "VERIFICATION_NOTE_REQUIRED",
          "Record the observed condition before verification.",
        );
      event(tx.state, r, actor, "status_changed", to, note);
      r.status = to;
      r.updatedAt = new Date().toISOString();
      if (assignee) r.assignee = assignee;
      if (to === "resolved") {
        r.privacyReviewed = false;
        r.closedAt = r.updatedAt;
        r.resolutionNote = note;
      } else if (to === "in_progress") r.closedAt = null;
      audit(tx.state, actor, "report." + to, r.id);
      tx.state.jobs.push({
        id: randomUUID(),
        reportId: r.id,
        kind: "notification",
        status: "pending",
        attempts: 0,
        nextAttemptAt: r.updatedAt,
        lastError: null,
      });
      return publicReport(r);
    });
  }
  async moderate(
    id: string,
    action: "hide" | "release" | "reject" | "duplicate",
    reason: string,
    actor: Actor,
    target?: string,
  ) {
    return this.repo.transaction(async (tx) => {
      if (actor.role !== "moderator")
        throw new AppError(
          actor.role === "guest" ? 401 : 403,
          "FORBIDDEN",
          "Moderator permission required.",
        );
      const r = findReport(tx.state, id);
      if (!reason.trim())
        throw new AppError(
          422,
          "REASON_REQUIRED",
          "A moderation reason is required.",
        );
      const previousStatus = r.status;
      if (
        action === "release" &&
        ["withdrawn", "rejected", "archived"].includes(r.status)
      )
        throw new AppError(
          409,
          "REMOVED_REPORT",
          "Removed reports cannot be published.",
        );
      if (action === "hide") r.hidden = true;
      if (action === "release") {
        r.hidden = false;
        r.privacyReviewed = true;
        tx.state.media
          .filter((m) => m.reportId === r.id)
          .forEach((m) => (m.safeForPublic = true));
      }
      if (
        ["reject", "duplicate"].includes(action) &&
        !["submitted", "under_review"].includes(r.status)
      )
        throw new AppError(
          409,
          "INVALID_TRANSITION",
          "Moderation requires a submitted or under-review report.",
        );
      if (action === "duplicate") {
        const parent = findReport(tx.state, target || "");
        if (
          parent.id === r.id ||
          parent.hidden ||
          ["duplicate", "withdrawn", "rejected", "archived"].includes(
            parent.status,
          )
        )
          throw new AppError(
            422,
            "DUPLICATE_TARGET",
            "Choose a valid original report.",
          );
        r.duplicateOf = parent.publicId;
        r.status = "duplicate";
      }
      if (action === "reject") r.status = "rejected";
      r.updatedAt = new Date().toISOString();
      event(tx.state, r, actor, "moderation_" + action, r.status, reason);
      tx.state.events[tx.state.events.length - 1].from = previousStatus;
      audit(tx.state, actor, "moderation." + action, r.id);
      return publicReport(r);
    });
  }
  async withOwner<T>(
    id: string,
    actor: Actor,
    token: string | null,
    fn: (tx: Transaction, r: Report) => Promise<T>,
  ) {
    return this.repo.transaction(async (tx) => {
      const r = findReport(tx.state, id);
      assertOwner(actor, r, token);
      return fn(tx, r);
    });
  }
}
