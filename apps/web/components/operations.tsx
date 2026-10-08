"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  Check,
  Download,
  Clock3,
  CheckCircle2,
  Users,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  EyeOff,
  Eye,
} from "lucide-react";
import type {
  Actor,
  PublicReport,
  PrivateLocation,
  ReportEvent,
  Status,
} from "../../../packages/domain/src/index";
import { categories } from "../../../packages/domain/src/index";
import { useI18n } from "./context";
import type { MessageKey } from "../../../packages/i18n/src/index";
import { api } from "../lib/client";
import {
  PageHeading,
  Loading,
  Notice,
  Badge,
  CategoryIcon,
  statusKey,
} from "./ui";
import { EvidenceImage } from "./pages";
import { MapView } from "./map-view";
interface QueueReport extends PublicReport {
  id: string;
  assignee: string | null;
  hidden: boolean;
  flags: number;
}
interface Dashboard {
  total: number;
  new: number;
  pending: number;
  assigned: number;
  overdue: number;
  resolvedToday: number;
  medianResolutionHours: number | null;
  proofOfResolutionRatio: number;
  verifiedRatio: number;
  duplicateRatio: number;
}
export function AccessRequired() {
  const { t, locale } = useI18n();
  return (
    <div className="panel empty">
      <div className="empty-icon">
        <ShieldCheck size={28} />
      </div>
      <h1>{t("signIn")}</h1>
      <p>{t("accessRequired")}</p>
      <Link href={`/${locale}/login`} className="btn btn-primary">
        {t("signIn")}
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
export function AuthorityPage({ queueOnly = false }: { queueOnly?: boolean }) {
  const { t, locale, number, date } = useI18n();
  const [reports, setReports] = useState<QueueReport[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [denied, setDenied] = useState(false);
  const [actor, setActor] = useState<Actor | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const load = useCallback(async () => {
    try {
      const [queue, dash, session] = await Promise.all([
        api<{ reports: QueueReport[] }>("authority/reports"),
        api<Dashboard>("authority/dashboard"),
        api<{ actor: Actor }>("auth/session"),
      ]);
      setReports(queue.reports);
      setDashboard(dash);
      setActor(session.actor);
    } catch {
      setDenied(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (denied) return <AccessRequired />;
  if (!dashboard) return <Loading />;
  const filtered = reports.filter(
    (r) =>
      (!filter || r.status === filter) &&
      (!category || r.category === category) &&
      (!search ||
        (r.publicId + " " + r.area)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const cards: [MessageKey, number, typeof ClipboardList][] = [
    ["new", dashboard.new, ClipboardList],
    ["pending", dashboard.pending, Clock3],
    ["assigned", dashboard.assigned, Users],
    ["overdue", dashboard.overdue, AlertCircle],
    ["resolvedToday", dashboard.resolvedToday, CheckCircle2],
  ];
  return (
    <>
      <PageHeading
        eyebrow={t("authority")}
        title={queueOnly ? t("queue") : t("authorityTitle")}
        description={t("authorityIntro")}
      >
        <div className="section-actions">
          {actor?.role === "authority_supervisor" && (
            <>
              <a className="btn" href="/api/v1/authority/export">
                <Download size={14} />
                {t("export")}
              </a>
              <a className="btn" href="/api/v1/authority/export?format=geojson">
                <Download size={14} />
                {t("exportGeo")}
              </a>
            </>
          )}
          <button className="btn" onClick={() => void load()}>
            <RefreshCw size={14} />
            {t("refresh")}
          </button>
        </div>
      </PageHeading>
      {!queueOnly && (
        <>
          <div className="stats-grid operations-stats">
            {cards.map(([key, value, Icon]) => (
              <div className="stat-card" key={key}>
                <div>
                  <span className="stat-label">{t(key)}</span>
                  <strong className="stat-number">{number(value)}</strong>
                </div>
                <span className="stat-icon">
                  <Icon size={18} />
                </span>
              </div>
            ))}
          </div>
          <div className="operations-meta">
            <span>
              {t("median")}
              <strong>
                {dashboard.medianResolutionHours === null
                  ? "—"
                  : number(dashboard.medianResolutionHours)}{" "}
                {t("hours")}
              </strong>
            </span>
            <span>
              {t("proof")}
              <strong>
                {number(Math.round(dashboard.proofOfResolutionRatio * 100))}%
              </strong>
            </span>
          </div>
        </>
      )}
      <div className="section-heading">
        <h2>{t("queue")}</h2>
        <span className="small muted">
          {number(filtered.length)} {t("showing")}
        </span>
      </div>
      <section className="table-wrap">
        <div className="table-toolbar">
          <label className="sr-only" htmlFor="queue-search">
            {t("search")}
          </label>
          <input
            id="queue-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
          />
          <select
            aria-label={t("status")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">{t("allStatuses")}</option>
            {[
              "submitted",
              "under_review",
              "verified",
              "assigned",
              "in_progress",
              "resolved",
              "rejected",
              "duplicate",
            ].map((s) => (
              <option key={s} value={s}>
                {t(statusKey[s as Status])}
              </option>
            ))}
          </select>
          <select
            aria-label={t("category")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </div>
        <table>
          <thead>
            <tr>
              {[
                "publicId",
                "category",
                "area",
                "age",
                "assignee",
                "status",
              ].map((key) => (
                <th key={key}>{t(key as MessageKey)}</th>
              ))}
              <th>
                <span className="sr-only">{t("open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link
                    className="text-link subtle-id"
                    href={`/${locale}/authority/reports/${r.id}`}
                  >
                    {r.publicId}
                  </Link>
                  {r.flags > 0 && (
                    <div className="flag-count">
                      {number(r.flags)} · {t("flag")}
                    </div>
                  )}
                </td>
                <td>
                  <span className="category-cell">
                    <span className="category-icon">
                      <CategoryIcon category={r.category} size={16} />
                    </span>
                    {t(r.category)}
                  </span>
                </td>
                <td>{r.area}</td>
                <td>{date(r.createdAt)}</td>
                <td>{r.assignee || t("unassigned")}</td>
                <td>
                  <Badge status={r.status} />
                </td>
                <td>
                  <Link
                    className="btn btn-small"
                    href={`/${locale}/authority/reports/${r.id}`}
                    aria-label={t("open") + " " + r.publicId}
                  >
                    <ArrowRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">{t("noReports")}</div>}
      </section>
    </>
  );
}
interface PrivateDetail {
  report: PublicReport & {
    id: string;
    locationNote: string;
    assignee: string | null;
    hidden: boolean;
    closedAt: string | null;
  };
  exactLocation: PrivateLocation | null;
  events: ReportEvent[];
  media: { id: string; kind: "before" | "after"; safeForPublic: boolean }[];
  aiAdvisory: null;
}
export function AuthorityDetail({ id }: { id: string }) {
  const { t, locale, date, number } = useI18n();
  const [detail, setDetail] = useState<PrivateDetail | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [after, setAfter] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actor, setActor] = useState<Actor | null>(null);
  const load = useCallback(async () => {
    try {
      setDetail(await api<PrivateDetail>("reports/" + id + "/private"));
      setActor((await api<{ actor: Actor }>("auth/session")).actor);
    } catch {
      setDenied(true);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(path: string, status?: Status) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const input: {
        status?: Status;
        note: string;
        assignee?: string;
        mediaId?: string;
      } = { note };
      if (status) input.status = status;
      if (path === "assign") input.assignee = assignee;
      if (path === "resolve") {
        if (!after || !note.trim()) {
          setError(t("resolutionRequired"));
          return;
        }
        const form = new FormData();
        form.set("photo", after);
        form.set("clientReportId", crypto.randomUUID());
        form.set("kind", "after");
        form.set("reportId", id);
        form.set("consent", "true");
        input.mediaId = (
          await api<{ mediaId: string }>("media/uploads", {
            method: "POST",
            body: form,
          })
        ).mediaId;
      }
      await api("reports/" + id + "/" + path, {
        method: path === "status" ? "PATCH" : "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input),
      });
      setMessage(t("updated"));
      setNote("");
      await load();
    } catch (error) {
      setError(
        locale === "en-BD" && error instanceof Error
          ? error.message
          : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }
  if (denied) return <AccessRequired />;
  if (!detail) return <Loading />;
  const { report, exactLocation, events, media } = detail;
  return (
    <>
      <Link className="text-link mb-18" href={`/${locale}/authority/reports`}>
        <ArrowLeft size={14} />
        {t("queue")}
      </Link>
      <PageHeading
        eyebrow={report.publicId}
        title={t(report.category)}
        description={report.area}
      >
        <Badge status={report.status} />
      </PageHeading>
      {message && (
        <div className="mb-18">
          <Notice>{message}</Notice>
        </div>
      )}
      {error && (
        <div className="mb-18">
          <Notice error>{error}</Notice>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2>{t("evidence")}</h2>
            {media.length > 0 ? (
              <div className="evidence-grid">
                {media.map((m) => (
                  <figure key={m.id}>
                    <EvidenceImage
                      id={m.id}
                      alt={t(m.kind === "before" ? "before" : "after")}
                    />
                    <figcaption>
                      {t(m.kind === "before" ? "before" : "after")} ·{" "}
                      {t(m.safeForPublic ? "approved" : "privacyPending")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <Notice>{t("source")}</Notice>
            )}
            {report.description && (
              <p className="description-text">{report.description}</p>
            )}
            {report.locationNote && (
              <p className="field-help">
                {t("locationNote")}: {report.locationNote}
              </p>
            )}
          </section>
          <section className="panel">
            <h2>{t("timeline")}</h2>
            <ol className="timeline">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="timeline-icon">
                    <Check size={13} />
                  </span>
                  <div>
                    <strong>{e.to ? t(statusKey[e.to]) : t("reported")}</strong>
                    <small>{date(e.createdAt)}</small>
                    {e.note && <p className="audit-timeline-note">{e.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel detail-map">
            <h2>{t("exactLocation")}</h2>
            {exactLocation ? (
              <>
                <div className="private-coordinates">
                  {exactLocation.lat.toFixed(6)}, {exactLocation.lng.toFixed(6)}
                </div>
                <MapView point={exactLocation} />
                <p>
                  {t("accuracy")}: {number(exactLocation.accuracyMeters)} ·{" "}
                  {t("exactWarning")}
                </p>
              </>
            ) : (
              <Notice>{t("notFound")}</Notice>
            )}
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>{t("operations")}</h2>
            <div className="operation-actions">
              <label>
                {t(
                  report.status === "in_progress"
                    ? "resolutionNote"
                    : "actionNote",
                )}
                <textarea
                  maxLength={1000}
                  disabled={busy}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                />
              </label>
              {report.status === "submitted" && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void action("status", "under_review")}
                >
                  {t("review")}
                  <ArrowRight size={14} />
                </button>
              )}
              {report.status === "under_review" && (
                <button
                  className="btn btn-primary"
                  disabled={busy || note.trim().length < 3}
                  onClick={() => void action("verify")}
                >
                  {t("verify")}
                  <Check size={15} />
                </button>
              )}
              {report.status === "verified" && (
                <>
                  <label>
                    {t("team")}
                    <input
                      value={assignee}
                      maxLength={120}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder={t("teamPlaceholder")}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !assignee.trim()}
                    onClick={() => void action("assign")}
                  >
                    {t("assign")}
                    <Users size={15} />
                  </button>
                </>
              )}
              {report.status === "assigned" && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void action("status", "in_progress")}
                >
                  {t("startWork")}
                  <ArrowRight size={14} />
                </button>
              )}
              {report.status === "in_progress" && (
                <>
                  <label>
                    {t("afterPhoto")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setAfter(e.target.files?.[0] || null)}
                    />
                    <small>{t("photoHelp")}</small>
                  </label>
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void action("resolve")}
                  >
                    {t("resolve")}
                    <CheckCircle2 size={15} />
                  </button>
                </>
              )}
              {report.status === "resolved" &&
                actor?.role === "authority_supervisor" && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => void action("status", "in_progress")}
                  >
                    {t("reopen")}
                    <RefreshCw size={14} />
                  </button>
                )}
              {["submitted", "under_review", "verified"].includes(
                report.status,
              ) && (
                <button
                  className="btn btn-danger"
                  disabled={busy || !note.trim()}
                  onClick={() => void action("status", "rejected")}
                >
                  {t("reject")}
                </button>
              )}
            </div>
          </section>
          <section className="panel">
            <ShieldCheck size={24} />
            <h2 className="mt-18">{t("advisory")}</h2>
            <p className="field-help">{t("aiDisabled")}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
interface ModerationReport extends PublicReport {
  id: string;
  description: string;
  hidden: boolean;
  media: { id: string; kind: "before" | "after" }[];
  flags: string[];
}
export function ModerationPage() {
  const { t, locale, number } = useI18n();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("pending");
  const load = useCallback(async () => {
    try {
      setReports(
        (await api<{ reports: ModerationReport[] }>("moderation")).reports,
      );
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function moderate(
    r: ModerationReport,
    action: "hide" | "release" | "reject" | "duplicate",
  ) {
    const reason = reasons[r.id];
    if (!reason?.trim()) {
      setMessage(t("reasonRequired"));
      return;
    }
    setBusy(r.id);
    try {
      await api("moderation/" + r.id, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason,
          ...(action === "duplicate" ? { target: targets[r.id] || "" } : {}),
        }),
      });
      setMessage(t("updated"));
      await load();
    } catch (error) {
      setMessage(
        locale === "en-BD" && error instanceof Error
          ? error.message
          : t("errorGeneric"),
      );
    } finally {
      setBusy("");
    }
  }
  if (denied) return <AccessRequired />;
  if (loading) return <Loading />;
  const filtered = reports.filter((r) =>
    filter === "all" || filter === "pending"
      ? !r.privacyReviewed || r.flags.length > 0 || filter === "all"
      : r.hidden,
  );
  return (
    <>
      <PageHeading
        eyebrow={t("moderation")}
        title={t("moderationTitle")}
        description={t("moderationIntro")}
      />
      {message && (
        <div className="mb-18">
          <Notice>{message}</Notice>
        </div>
      )}
      <div className="section-heading">
        <div className="segmented">
          {[
            ["pending", "privacyPending"],
            ["hidden", "hidden"],
            ["all", "allReports"],
          ].map(([value, key]) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {t(key as MessageKey)}
            </button>
          ))}
        </div>
        <span className="small muted">
          {number(filtered.length)} {t("showing")}
        </span>
      </div>
      <div className="moderation-grid">
        {filtered.map((r) => (
          <section className="panel moderation-card" key={r.id}>
            <div className="report-card-title">
              {t(r.category)}
              <Badge status={r.status} />
            </div>
            <span className="subtle-id">{r.publicId}</span>
            <p>
              {r.area} ·{" "}
              {t(
                r.hidden
                  ? "hidden"
                  : r.privacyReviewed
                    ? "approved"
                    : "privacyPending",
              )}
            </p>
            {r.flags.length > 0 && (
              <span className="flag-count">
                {t("flag")}: {r.flags.join(", ")}
              </span>
            )}
            {r.media.length > 0 && (
              <div className="evidence-grid">
                {r.media.map((m) => (
                  <figure key={m.id}>
                    <EvidenceImage
                      id={m.id}
                      alt={t(m.kind === "before" ? "before" : "after")}
                    />
                    <figcaption>
                      {t(m.kind === "before" ? "before" : "after")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            <p>{r.description}</p>
            <label>
              {t("moderationReason")}
              <textarea
                maxLength={500}
                value={reasons[r.id] || ""}
                onChange={(e) =>
                  setReasons((p) => ({ ...p, [r.id]: e.target.value }))
                }
              />
            </label>
            <div className="moderation-buttons">
              <button
                className="btn btn-small btn-primary"
                disabled={busy === r.id}
                onClick={() => void moderate(r, "release")}
              >
                <Eye size={13} />
                {t("release")}
              </button>
              <button
                className="btn btn-small"
                disabled={busy === r.id}
                onClick={() => void moderate(r, "hide")}
              >
                <EyeOff size={13} />
                {t("hide")}
              </button>
              {["submitted", "under_review"].includes(r.status) && (
                <button
                  className="btn btn-small btn-danger"
                  disabled={busy === r.id}
                  onClick={() => void moderate(r, "reject")}
                >
                  {t("reject")}
                </button>
              )}
            </div>
            {["submitted", "under_review"].includes(r.status) && (
              <details className="mt-18">
                <summary className="text-link">{t("merge")}</summary>
                <label className="mt-18">
                  {t("originalId")}
                  <input
                    maxLength={100}
                    value={targets[r.id] || ""}
                    onChange={(e) =>
                      setTargets((p) => ({ ...p, [r.id]: e.target.value }))
                    }
                  />
                </label>
                <button
                  className="btn btn-small"
                  disabled={busy === r.id}
                  onClick={() => void moderate(r, "duplicate")}
                >
                  {t("merge")}
                </button>
              </details>
            )}
          </section>
        ))}
      </div>
      {!filtered.length && (
        <div className="panel empty">
          <ShieldCheck size={35} style={{ margin: "0 auto 18px" }} />
          {t("noReports")}
        </div>
      )}
    </>
  );
}
