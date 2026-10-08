"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  ShieldCheck,
  Droplets,
  Container,
  TreePine,
  Camera,
  Download,
  Trash2,
  Check,
  Send,
  RefreshCw,
  WifiOff,
  ExternalLink,
  QrCode,
} from "lucide-react";
import type {
  Actor,
  PublicReport,
  Status,
} from "../../../packages/domain/src/index";
import { useI18n } from "./context";
import type { MessageKey } from "../../../packages/i18n/src/index";
import {
  PageHeading,
  Loading,
  Notice,
  Badge,
  ReportCard,
  statusKey,
  CategoryIcon,
} from "./ui";
import {
  api,
  savedReports,
  listDrafts,
  removeDraft,
  saveDraft,
  syncDraft,
  type Draft,
} from "../lib/client";
import { MapView } from "./map-view";
export function EvidenceImage({
  id,
  token,
  alt,
}: {
  id: string;
  token?: string;
  alt: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let object = "";
    fetch("/api/v1/media/" + id, {
      headers: token ? { "x-tracking-token": token } : {},
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) return;
        object = URL.createObjectURL(await r.blob());
        if (active) setUrl(object);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [id, token]);
  return url ? (
    <img src={url} alt={alt} />
  ) : (
    <div className="placeholder-box">
      <Camera size={24} style={{ margin: "0 auto 10px" }} />
      {alt}
    </div>
  );
}
interface Detail {
  report: PublicReport;
  events: { type: string; status: Status | null; createdAt: string }[];
  media: { id: string; kind: "before" | "after" }[];
  privateTracking: boolean;
  duplicateOf: string | null;
}
export function ReportDetail({ publicId }: { publicId: string }) {
  const { t, locale, date } = useI18n();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(false);
  const [token, setToken] = useState("");
  const [qr, setQr] = useState("");
  const [flag, setFlag] = useState("privacy");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const credential =
      savedReports().find((r) => r.publicId === publicId)?.trackingToken || "";
    setToken(credential);
    api<Detail>("reports/" + publicId, {
      headers: credential ? { "x-tracking-token": credential } : {},
    })
      .then(setDetail)
      .catch(() => setError(true));
    QRCode.toDataURL(window.location.origin + `/${locale}/r/${publicId}`, {
      margin: 1,
      width: 220,
      color: { dark: "#193b39", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => {});
  }, [publicId, locale]);
  if (error) return <Notice error>{t("notFound")}</Notice>;
  if (!detail) return <Loading />;
  const { report, events, media } = detail;
  return (
    <>
      <Link className="text-link mb-18" href={`/${locale}`}>
        <ArrowLeft size={14} />
        {t("backToMap")}
      </Link>
      <PageHeading
        eyebrow={t("reportDetails")}
        title={t(report.category)}
        description={report.area}
      >
        <Badge status={report.status} />
      </PageHeading>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <div className="detail-head">
              <span className="category-icon">
                <CategoryIcon category={report.category} />
              </span>
              <span className="detail-id">{publicId}</span>
              <Badge status={report.status} />
            </div>
            {media.length > 0 ? (
              <div className="evidence-grid">
                {media.map((m) => (
                  <figure key={m.id}>
                    <EvidenceImage
                      id={m.id}
                      token={token}
                      alt={t(m.kind === "before" ? "before" : "after")}
                    />
                    <figcaption>
                      {t(m.kind === "before" ? "before" : "after")}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <Notice>{t("awaitingPrivacy")}</Notice>
            )}
            {report.description && (
              <p className="description-text">{report.description}</p>
            )}
            {report.resolutionNote && <Notice>{report.resolutionNote}</Notice>}
            <dl className="details-dl">
              <div>
                <dt>{t("reportedAt")}</dt>
                <dd>{date(report.createdAt)}</dd>
              </div>
              <div>
                <dt>{t("category")}</dt>
                <dd>{t(report.category)}</dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <h2>{t("timeline")}</h2>
            <ol className="timeline">
              {events
                .filter((e) => e.status)
                .map((e, i) => (
                  <li key={i}>
                    <span className="timeline-icon">
                      <Check size={13} />
                    </span>
                    <div>
                      <strong>
                        {e.status ? t(statusKey[e.status]) : e.type}
                      </strong>
                      <small>{date(e.createdAt)}</small>
                    </div>
                  </li>
                ))}
            </ol>
            {detail.duplicateOf && (
              <Link
                className="text-link"
                href={`/${locale}/r/${detail.duplicateOf}`}
              >
                {t("followExisting")}
                <ArrowRight size={14} />
              </Link>
            )}
          </section>
          <section className="panel detail-map">
            <h2>{t("location")}</h2>
            <MapView reports={[report]} point={report.publicLocation} />
            <p>
              <ShieldCheck size={12} style={{ display: "inline" }} />{" "}
              {t("approximate")}
            </p>
          </section>
        </div>
        <aside className="detail-side">
          <section className="panel qr-panel">
            <h2>{t("qr")}</h2>
            {qr && <img src={qr} alt={t("qr")} />}
            <p>{t("qrBody")}</p>
            <span className="subtle-id">{publicId}</span>
          </section>
          <section className="panel">
            <h2>{t("flag")}</h2>
            <label>
              {t("flagReason")}
              <select value={flag} onChange={(e) => setFlag(e.target.value)}>
                <option value="privacy">{t("privacyConcern")}</option>
                <option value="spam">{t("spamConcern")}</option>
              </select>
            </label>
            <button
              className="btn mt-18"
              onClick={async () => {
                try {
                  await api(`reports/${publicId}/flags`, {
                    method: "POST",
                    body: JSON.stringify({ reason: flag }),
                  });
                  setMessage(t("flagged"));
                } catch {
                  setMessage(t("errorGeneric"));
                }
              }}
            >
              <Send size={14} />
              {t("flag")}
            </button>
            <p className="field-help mt-18" role="status">
              {message}
            </p>
          </section>
          {detail.privateTracking && (
            <section className="panel">
              <ShieldCheck size={23} />
              <h2 className="mt-18">{t("rights")}</h2>
              <p className="panel-description">{t("rightsExplain")}</p>
              <Link
                className="btn"
                href={`/${locale}/privacy?report=${publicId}`}
              >
                {t("rights")}
                <ArrowRight size={14} />
              </Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
export function MyReports() {
  const { t, locale, date } = useI18n();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const refresh = useCallback(async () => {
    setDrafts(await listDrafts());
    const locals = await Promise.all(
      savedReports().map((r) =>
        api<Detail>("reports/" + r.publicId, {
          headers: { "x-tracking-token": r.trackingToken },
        })
          .then((d) => d.report)
          .catch(() => null),
      ),
    );
    const account = await api<{ reports: PublicReport[] }>("my-reports")
      .then((r) => r.reports)
      .catch(() => []);
    const combined = [
      ...locals.filter((r): r is PublicReport => !!r),
      ...account,
    ];
    setReports([...new Map(combined.map((r) => [r.publicId, r])).values()]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const updated = () => void refresh();
    window.addEventListener("dsp-synced", updated);
    return () => window.removeEventListener("dsp-synced", updated);
  }, [refresh]);
  async function retry(d: Draft) {
    if (!d.input.consent && !consents[d.id]) {
      setMessage(t("consentRequired"));
      return;
    }
    setBusy(d.id);
    setMessage("");
    try {
      d.input.consent = true;
      await saveDraft(d);
      await syncDraft(d);
      setMessage(t("synced"));
    } catch (error) {
      setMessage(
        locale === "en-BD" && error instanceof Error
          ? error.message
          : t("needsAttention"),
      );
    } finally {
      setBusy("");
      await refresh();
    }
  }
  if (loading) return <Loading />;
  return (
    <>
      <PageHeading
        eyebrow={t("community")}
        title={t("myTitle")}
        description={t("myIntro")}
      >
        <Link className="btn btn-primary" href={`/${locale}/report`}>
          {t("report")}
          <ArrowRight size={15} />
        </Link>
      </PageHeading>
      {message && (
        <div className="mb-18">
          <Notice>{message}</Notice>
        </div>
      )}
      {drafts.length > 0 && (
        <section>
          <h2 className="mb-18">{t("offlineDrafts")}</h2>
          <Notice>{t("devicePrivacy")}</Notice>
          <div className="mt-18">
            {drafts.map((d) => (
              <div className="draft-card" key={d.id}>
                <div className="category-icon">
                  <WifiOff size={21} />
                </div>
                <div className="draft-card-content">
                  <h3>{t(d.input.category)}</h3>
                  <p>
                    {date(d.createdAt)} ·{" "}
                    {t(
                      d.syncState === "needsAttention"
                        ? "needsAttention"
                        : d.syncState === "uploading"
                          ? "uploading"
                          : "waiting",
                    )}
                  </p>
                  {!d.input.consent && (
                    <label className="consent-label mt-18">
                      <input
                        type="checkbox"
                        checked={!!consents[d.id]}
                        onChange={(e) =>
                          setConsents((p) => ({
                            ...p,
                            [d.id]: e.target.checked,
                          }))
                        }
                      />
                      <span>{t("consent")}</span>
                    </label>
                  )}
                  {d.lastError && (
                    <p role="status">
                      {locale === "en-BD" ? d.lastError : t("needsAttention")}
                    </p>
                  )}
                </div>
                <div className="draft-actions">
                  <button
                    className="btn btn-small"
                    disabled={busy === d.id}
                    onClick={async () => {
                      if (window.confirm(t("deleteDraftConfirm"))) {
                        await removeDraft(d.id);
                        await refresh();
                      }
                    }}
                  >
                    <Trash2 size={13} />
                    {t("discard")}
                  </button>
                  <button
                    className="btn btn-primary btn-small"
                    disabled={busy === d.id}
                    onClick={() => void retry(d)}
                  >
                    <RefreshCw size={13} />
                    {t("retry")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {reports.length > 0 ? (
        <section className="section-space">
          <div className="section-heading">
            <h2>{t("myReports")}</h2>
            <button className="text-link" onClick={() => void refresh()}>
              <RefreshCw size={13} />
              {t("refresh")}
            </button>
          </div>
          <div className="mine-grid">
            {reports.map((r) => (
              <ReportCard key={r.publicId} report={r} />
            ))}
          </div>
        </section>
      ) : (
        !drafts.length && (
          <div className="panel empty">
            <div className="empty-icon">
              <ClipboardList size={28} />
            </div>
            <h2>{t("emptyMine")}</h2>
            <p>{t("emptyMineBody")}</p>
            <Link href={`/${locale}/report`} className="btn btn-primary">
              {t("report")}
              <ArrowRight size={14} />
            </Link>
          </div>
        )
      )}
    </>
  );
}
export function LearnPage() {
  const { t, locale } = useI18n();
  return (
    <>
      <PageHeading
        eyebrow={t("learn")}
        title={t("learnTitle")}
        description={t("learnIntro")}
      />
      <div className="learn-grid">
        {[
          { Icon: Droplets, title: "tip1", body: "tip1Body" },
          { Icon: Container, title: "tip2", body: "tip2Body" },
          { Icon: TreePine, title: "tip3", body: "tip3Body" },
          { Icon: Camera, title: "tip4", body: "tip4Body" },
        ].map(({ Icon, title, body }) => (
          <section className="panel learn-card" key={title}>
            <span className="how-icon">
              <Icon size={24} />
            </span>
            <h2>{t(title as MessageKey)}</h2>
            <p>{t(body as MessageKey)}</p>
          </section>
        ))}
      </div>
      <div className="mt-18">
        <Notice>{t("environmental")}</Notice>
        <a
          className="text-link mt-18"
          href="https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("preventionSource")} <ExternalLink size={14} />
        </a>
      </div>
      <Link href={`/${locale}/report`} className="btn btn-primary mt-18">
        {t("report")}
        <ArrowRight size={15} />
      </Link>
    </>
  );
}
export function DataRightsForm() {
  const { t, locale } = useI18n();
  const [publicId, setPublicId] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("report");
    if (id) {
      setPublicId(id);
      setToken(
        savedReports().find((r) => r.publicId === id)?.trackingToken || "",
      );
    }
  }, []);
  async function request(action: "access" | "delete" | "withdraw" | "status") {
    if (action === "delete" && !window.confirm(t("confirmDelete"))) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{
        request: { id: string; status: string };
        information?: unknown;
      }>(
        action === "status"
          ? "data-rights/requests/" + encodeURIComponent(receipt)
          : "data-rights/" + action,
        {
          method: action === "status" ? "GET" : "POST",
          headers: { "x-tracking-token": token },
          body: action === "status" ? undefined : JSON.stringify({ publicId }),
        },
      );
      setReceipt(result.request.id);
      setMessage(t("requestComplete"));
      if (result.information) {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(result.information, null, 2)], {
            type: "application/json",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "denguespot-information.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      setMessage(
        locale === "en-BD" && error instanceof Error
          ? error.message
          : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <ShieldCheck size={27} style={{ color: "var(--teal)" }} />
      <h2 className="panel-title mt-18">{t("rights")}</h2>
      <p className="panel-description">{t("rightsExplain")}</p>
      <div className="rights-form">
        <label>
          {t("publicId")}
          <input
            value={publicId}
            maxLength={100}
            onChange={(e) => {
              setPublicId(e.target.value);
              setToken(
                savedReports().find((r) => r.publicId === e.target.value)
                  ?.trackingToken || "",
              );
            }}
            placeholder="DSP-…"
          />
        </label>
        <label>
          {t("trackingToken")}
          <input
            className="token-input"
            type="password"
            value={token}
            maxLength={200}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t("enterToken")}
            autoComplete="off"
          />
        </label>
        <div className="rights-actions">
          <button
            className="btn btn-primary"
            disabled={busy || !publicId}
            onClick={() => void request("access")}
          >
            <Download size={14} />
            {t("download")}
          </button>
          <button
            className="btn"
            disabled={busy || !publicId}
            onClick={() => void request("withdraw")}
          >
            {t("withdraw")}
          </button>
          <button
            className="btn btn-danger"
            disabled={busy || !publicId}
            onClick={() => void request("delete")}
          >
            <Trash2 size={14} />
            {t("delete")}
          </button>
        </div>
        <label className="mt-18">
          {t("receipt")}
          <input
            value={receipt}
            maxLength={36}
            onChange={(e) => setReceipt(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="btn mt-18"
          disabled={busy || !receipt}
          onClick={() => void request("status")}
        >
          {t("viewData")}
        </button>
        {message && (
          <div className="receipt" role="status">
            {message}{" "}
            {receipt && (
              <>
                <strong>{receipt}</strong>
                <p>
                  {t("viewData")}: {t("requestComplete")}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
export function PrivacyPage() {
  const { t } = useI18n();
  const [contact, setContact] = useState<string | null>(null);
  useEffect(() => {
    api<{ privacyContact: string | null }>("config")
      .then((c) => setContact(c.privacyContact))
      .catch(() => {});
  }, []);
  return (
    <>
      <PageHeading
        eyebrow={t("privacyTitle")}
        title={t("privacy")}
        description={t("privacyIntro")}
      />
      <div className="privacy-layout">
        <section className="panel privacy-copy">
          {["dataCollected", "publicData", "retention", "providers"].map(
            (key) => (
              <div key={key}>
                <h2>{t(key as MessageKey)}</h2>
                <p>{t((key + "Body") as MessageKey)}</p>
              </div>
            ),
          )}
          <div>
            <h2>{t("contact")}</h2>
            <p>{contact || t("contactBody")}</p>
          </div>
        </section>
        <aside>
          <DataRightsForm />
        </aside>
      </div>
    </>
  );
}
export function LoginPage() {
  const { t, locale } = useI18n();
  const [profileId, setProfile] = useState("demo-officer-a");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  useEffect(() => {
    api<{ demo: boolean }>("config")
      .then((c) => setDemo(c.demo))
      .catch(() => setDemo(false));
  }, []);
  const identities: [string, MessageKey][] = [
    ["demo-officer-a", "officerA"],
    ["demo-officer-b", "officerB"],
    ["demo-supervisor", "supervisor"],
    ["demo-moderator", "moderator"],
    ["demo-citizen", "citizen"],
    ["demo-admin", "admin"],
  ];
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ actor: Actor }>(
        demo ? "auth/demo" : "auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            demo ? { profileId, password } : { email, password },
          ),
        },
      );
      const target =
        result.actor.role === "moderator"
          ? "moderation"
          : ["authority_officer", "authority_supervisor"].includes(
                result.actor.role,
              )
            ? "authority"
            : "my-reports";
      window.location.assign(`/${locale}/${target}`);
    } catch {
      setError(t("loginError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel login-panel">
      <Link className="brand" href={`/${locale}`}>
        <img src="/icon.svg" width="42" height="42" alt="" />
        <span>{t("brand")}</span>
      </Link>
      <h1>{t("loginTitle")}</h1>
      <p className="page-description">
        {t(demo ? "loginBody" : "accessRequired")}
      </p>
      {error && (
        <div className="mt-18">
          <Notice error>{error}</Notice>
        </div>
      )}
      {demo !== false ? (
        <form onSubmit={login}>
          <label>
            {t("profile")}
            <select
              value={profileId}
              onChange={(e) => setProfile(e.target.value)}
            >
              {identities.map(([id, key]) => (
                <option key={id} value={id}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("password")}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <p className="field-help">{t("passwordHelp")}</p>
          <button className="btn btn-primary" disabled={busy}>
            {t("loginButton")}
            <ArrowRight size={15} />
          </button>
        </form>
      ) : (
        <form onSubmit={login}>
          <label>
            {t("email")}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {t("accountPassword")}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
            {t("signIn")}
          </button>
        </form>
      )}
    </div>
  );
}
export function QrPage() {
  const { t, locale } = useI18n();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  function open(value = link) {
    try {
      const url = new URL(value, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        !/^\/(bn-BD|en-BD)\/r\/DSP-[A-Z0-9]+$/.test(url.pathname)
      )
        throw new Error();
      location.assign(url.pathname.replace(/^\/(bn-BD|en-BD)/, "/" + locale));
    } catch {
      setError(t("invalidLink"));
    }
  }
  async function scan(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setError(t("qrScanFailed"));
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error();
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(pixels.data, pixels.width, pixels.height);
      if (!result) throw new Error();
      setLink(result.data);
      open(result.data);
    } catch {
      setError(t("qrScanFailed"));
    }
  }
  return (
    <div className="form-wrap">
      <PageHeading title={t("scan")} description={t("scanHelp")} />
      <section className="panel">
        <QrCode size={45} className="mb-18" />
        <label className="mb-18">
          {t("qrImage")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void scan(e.target.files?.[0])}
          />
          <small>{t("qrLocalOnly")}</small>
        </label>
        <label>
          {t("reportLink")}
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>
        <button className="btn btn-primary mt-18" onClick={() => open()}>
          {t("scanOpen")}
          <ExternalLink size={14} />
        </button>
        {error && <Notice error>{error}</Notice>}
      </section>
    </div>
  );
}
