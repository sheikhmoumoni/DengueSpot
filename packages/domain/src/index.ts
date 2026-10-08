import { z } from "zod";
export const categories = [
  "standing_water",
  "water_container",
  "construction",
  "drain",
  "tire_or_waste",
  "rooftop",
  "public_space",
  "other",
] as const;
export const statuses = [
  "draft",
  "submitted",
  "under_review",
  "verified",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
  "duplicate",
  "withdrawn",
  "archived",
] as const;
export type Category = (typeof categories)[number];
export type Status = (typeof statuses)[number];
export const roles = [
  "guest",
  "citizen",
  "community_verifier",
  "authority_officer",
  "authority_supervisor",
  "moderator",
  "privacy_security_officer",
  "system_admin",
] as const;
export type Role = (typeof roles)[number];
export interface Actor {
  id: string;
  role: Role;
  jurisdictions: string[];
}
export interface Point {
  lat: number;
  lng: number;
}
export const locationSchema = z
  .object({
    lat: z.number().min(20).max(27),
    lng: z.number().min(88).max(93),
    accuracyMeters: z.number().min(0).max(10000),
    source: z.enum(["gps", "manual"]),
  })
  .strict();
export const reportInputSchema = z
  .object({
    clientReportId: z.uuid(),
    locale: z.enum(["bn-BD", "en-BD"]),
    category: z.enum(categories),
    description: z.string().max(1000),
    locationNote: z.string().max(160),
    location: locationSchema,
    mediaId: z.uuid(),
    capturedAt: z.iso.datetime(),
    consentVersion: z.literal("2026-10-v1"),
    consent: z.literal(true),
    website: z.string().max(0).optional(),
  })
  .strict();
export type ReportInput = z.infer<typeof reportInputSchema>;
export interface Report {
  id: string;
  publicId: string;
  clientReportId: string;
  ownerId: string | null;
  trackingHash: string;
  category: Category;
  description: string;
  locationNote: string;
  locale: "bn-BD" | "en-BD";
  publicLocation: Point;
  jurisdictionId: string;
  area: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  capturedAt?: string;
  closedAt: string | null;
  hidden: boolean;
  privacyReviewed: boolean;
  assignee: string | null;
  resolutionNote: string | null;
  duplicateOf: string | null;
  consentVersion: string;
  legalHold: boolean;
  requestHash: string;
}
export interface PrivateLocation extends Point {
  reportId: string;
  accuracyMeters: number;
  source: "gps" | "manual";
}
export interface Media {
  id: string;
  ownerKey: string;
  reportId: string | null;
  kind: "before" | "after";
  originalKey: string | null;
  derivativeKey: string | null;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  mime: string;
  createdAt: string;
  safeForPublic: boolean;
}
export interface ReportEvent {
  id: string;
  reportId: string;
  type: string;
  from: Status | null;
  to: Status | null;
  actorId: string;
  note: string;
  createdAt: string;
}
export interface Audit {
  id: string;
  actorId: string;
  action: string;
  recordId: string;
  createdAt: string;
  previousHash: string;
  hash: string;
}
export interface Jurisdiction {
  id: string;
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  organizationId: string;
}
export interface Profile extends Actor {
  name: string;
}
export interface Session {
  hash: string;
  actorId: string;
  expiresAt: string;
}
export interface DataRequest {
  id: string;
  reportId: string;
  type: "access" | "delete" | "withdraw";
  status: "completed";
  createdAt: string;
}
export interface ProviderJob {
  id: string;
  reportId: string;
  kind: "notification" | "ai" | "webhook";
  status: "pending" | "done" | "failed";
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
}
export interface State {
  reports: Report[];
  locations: PrivateLocation[];
  media: Media[];
  events: ReportEvent[];
  audits: Audit[];
  jurisdictions: Jurisdiction[];
  profiles: Profile[];
  sessions: Session[];
  requests: DataRequest[];
  jobs: ProviderJob[];
}
export const emptyState = (): State => ({
  reports: [],
  locations: [],
  media: [],
  events: [],
  audits: [],
  jurisdictions: [],
  profiles: [],
  sessions: [],
  requests: [],
  jobs: [],
});
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const transitions: Record<Status, readonly Status[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "rejected", "duplicate", "withdrawn"],
  under_review: ["verified", "rejected", "duplicate"],
  verified: ["assigned", "rejected"],
  assigned: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["in_progress", "archived"],
  rejected: [],
  duplicate: [],
  withdrawn: [],
  archived: [],
};
export function assertTransition(
  from: Status,
  to: Status,
  actor: Actor,
  proof = false,
) {
  if (!transitions[from].includes(to))
    throw new AppError(
      409,
      "INVALID_TRANSITION",
      "This status change is not allowed.",
    );
  if (!["authority_officer", "authority_supervisor"].includes(actor.role))
    throw new AppError(403, "FORBIDDEN", "Authority permission required.");
  if (from === "resolved" && actor.role !== "authority_supervisor")
    throw new AppError(
      403,
      "FORBIDDEN",
      "Supervisor permission required to reopen or archive.",
    );
  if (to === "resolved" && !proof)
    throw new AppError(
      422,
      "RESOLUTION_EVIDENCE_REQUIRED",
      "An after-photo and resolution note are required.",
    );
}
export function authorizeAuthority(
  actor: Actor,
  report?: Pick<Report, "jurisdictionId">,
) {
  if (actor.role === "guest")
    throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  if (!["authority_officer", "authority_supervisor"].includes(actor.role))
    throw new AppError(403, "FORBIDDEN", "Authority permission required.");
  if (report && !actor.jurisdictions.includes(report.jurisdictionId))
    throw new AppError(
      403,
      "WRONG_JURISDICTION",
      "This report is outside your assigned jurisdiction.",
    );
}
export function coarsenLocation(p: Point, meters = 150): Point {
  // Mercator metric grid: constant projection, avoiding a latitude-dependent longitude grid that leaks latitude.
  const r = 6378137;
  const x = (r * p.lng * Math.PI) / 180;
  const y = r * Math.log(Math.tan(Math.PI / 4 + (p.lat * Math.PI) / 360));
  const localMeters = meters / Math.cos((23.8 * Math.PI) / 180);
  return {
    lng: (((Math.round(x / localMeters) * localMeters) / r) * 180) / Math.PI,
    lat:
      ((2 *
        Math.atan(Math.exp((Math.round(y / localMeters) * localMeters) / r)) -
        Math.PI / 2) *
        180) /
      Math.PI,
  };
}
export function distanceMeters(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function duplicateCandidates(
  state: State,
  p: Point,
  now = Date.now(),
  radius = 75,
  days = 7,
) {
  return state.reports
    .filter(
      (r) =>
        !r.hidden &&
        !["withdrawn", "rejected", "archived", "duplicate"].includes(
          r.status,
        ) &&
        now - new Date(r.createdAt).getTime() <= days * 86400000,
    )
    .map((r) => ({
      report: r,
      distance: distanceMeters(
        p,
        state.locations.find((l) => l.reportId === r.id) || { lat: 0, lng: 0 },
      ),
    }))
    .filter((r) => r.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((x) => publicReport(x.report));
}
export function publicReport(r: Report) {
  return {
    publicId: r.publicId,
    category: r.category,
    description: r.privacyReviewed ? r.description : "",
    publicLocation: r.publicLocation,
    area: r.area,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    privacyReviewed: r.privacyReviewed,
    resolutionNote: r.privacyReviewed ? r.resolutionNote : null,
  };
}
export type PublicReport = ReturnType<typeof publicReport>;
export function retentionDecision(
  createdAt: string,
  closedAt: string | null,
  now = Date.now(),
  hold = false,
) {
  if (hold) return { original: false, private: false, archive: false };
  return {
    original: now - Date.parse(createdAt) > 30 * 86400000,
    private: !!closedAt && now - Date.parse(closedAt) > 180 * 86400000,
    archive: now - Date.parse(createdAt) > 730 * 86400000,
  };
}
export function csvCell(value: string) {
  // Control characters can precede spreadsheet formula payloads.
  // eslint-disable-next-line no-control-regex
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export const assessmentSchema = z
  .object({
    imageQuality: z.enum(["poor", "acceptable", "good"]),
    possibleStandingWater: z.boolean().nullable(),
    suggestedCategory: z.enum(categories).nullable(),
    actionability: z.enum(["low", "medium", "high", "unknown"]),
    confidence: z.number().min(0).max(1),
    signals: z.array(z.string().max(200)).max(10),
    needsHumanReview: z.literal(true),
  })
  .strict();
export type EvidenceAssessment = z.infer<typeof assessmentSchema>;
export function parseAssessment(input: string): EvidenceAssessment | null {
  try {
    return assessmentSchema.parse(JSON.parse(input));
  } catch {
    return null;
  }
}
