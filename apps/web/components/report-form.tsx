"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ArrowRight,
  ArrowLeft,
  LocateFixed,
  Save,
  ShieldCheck,
  Send,
  CheckCircle2,
  Copy,
  MapPin,
  LoaderCircle,
} from "lucide-react";
import {
  categories,
  type Category,
  type PublicReport,
} from "../../../packages/domain/src/index";
import { useI18n } from "./context";
import { CategoryIcon, PageHeading, Notice, ReportCard } from "./ui";
import { MapView } from "./map-view";
import { api, saveDraft, syncDraft, type Draft } from "../lib/client";
export function ReportForm() {
  const { t, locale, number } = useI18n();
  const [step, setStep] = useState(1);
  const [clientId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "",
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [category, setCategory] = useState<Category>("standing_water");
  const [description, setDescription] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [point, setPoint] = useState({ lat: 23.742, lng: 90.377 });
  const [accuracy, setAccuracy] = useState(0);
  const [source, setSource] = useState<"gps" | "manual">("manual");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [duplicates, setDuplicates] = useState<PublicReport[] | null>(null);
  const [success, setSuccess] = useState<{
    report: PublicReport;
    trackingToken: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [capturedAt, setCapturedAt] = useState("");
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  function choose(file: File | undefined) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setErrors([t("photoRequired")]);
      return;
    }
    setPhoto(file);
    setCapturedAt(new Date().toISOString());
    setErrors([]);
    setDuplicates(null);
  }
  function validate() {
    const result: string[] = [];
    if (!photo) result.push(t("photoRequired"));
    if (
      step > 1 &&
      (!Number.isFinite(point.lat) ||
        !Number.isFinite(point.lng) ||
        point.lat < 23.725 ||
        point.lat > 23.76 ||
        point.lng < 90.36 ||
        point.lng > 90.42)
    )
      result.push(t("locationInvalid"));
    return result;
  }
  function next() {
    const invalid = validate();
    if (invalid.length) {
      setErrors(invalid);
      return;
    }
    setErrors([]);
    setStep((s) => Math.min(3, s + 1));
    setTimeout(() => headingRef.current?.focus(), 0);
  }
  function draft(requireConsent: boolean): Draft | null {
    if (!photo) return null;
    const input: Draft['input'] = {
      clientReportId: clientId,
      locale,
      category,
      description,
      locationNote,
      location: { ...point, accuracyMeters: accuracy, source },
      mediaId: "00000000-0000-4000-8000-000000000000",
      capturedAt,
      consentVersion: "2026-10-v1",
      consent: requireConsent,
    };
    return {
      id: clientId,
      input,
      photo,
      syncState: "waiting",
      createdAt: new Date().toISOString(),
      attempts: 0,
      nextRetryAt: 0,
    };
  }
  async function save() {
    const d = draft(false);
    if (!d) {
      setErrors([t("photoRequired")]);
      return;
    }
    await saveDraft(d);
    setMessage(t("savedDraft"));
  }
  async function submit(skipDuplicates = false) {
    const invalid = validate();
    if (!consent) invalid.push(t("consentRequired"));
    if (invalid.length) {
      setErrors(invalid);
      return;
    }
    const d = draft(true);
    if (!d) return;
    setBusy(true);
    setErrors([]);
    setMessage("");
    try {
      if (!navigator.onLine) {
        await saveDraft(d);
        setMessage(t("offlineSaved"));
        return;
      }
      if (!skipDuplicates && duplicates === null) {
        const candidates = await api<{ reports: PublicReport[] }>(
          "reports/duplicates",
          { method: "POST", body: JSON.stringify(point) },
        );
        if (candidates.reports.length) {
          setDuplicates(candidates.reports);
          return;
        }
      }
      await saveDraft(d);
      setSuccess(await syncDraft(d));
    } catch (error) {
      if (!navigator.onLine) {
        await saveDraft(d);
        setMessage(t("offlineSaved"));
      } else
        setErrors([
          locale === "bn-BD"
            ? t("errorGeneric")
            : error instanceof Error
              ? error.message
              : t("errorGeneric"),
        ]);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      setErrors([t("gpsDenied")]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPoint({
          lat: Number(p.coords.latitude.toFixed(6)),
          lng: Number(p.coords.longitude.toFixed(6)),
        });
        setAccuracy(Math.round(p.coords.accuracy));
        setSource("gps");
        setLocating(false);
        setErrors([]);
        setDuplicates(null);
      },
      () => {
        setLocating(false);
        setErrors([t("gpsDenied")]);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  if (success)
    return (
      <div className="panel success-panel">
        <div className="success-check">
          <CheckCircle2 size={40} />
        </div>
        <h1>{t("success")}</h1>
        <p>{t("successBody")}</p>
        <div className="credential">
          <label>{t("trackingId")}</label>
          <code>{success.report.publicId}</code>
        </div>
        <div className="credential">
          <div className="credential-row">
            <label>{t("trackingToken")}</label>
            <button
              className="text-link"
              onClick={async () => {
                await navigator.clipboard.writeText(success.trackingToken);
                setCopied(true);
              }}
            >
              <Copy size={13} />
              {t(copied ? "copied" : "copy")}
            </button>
          </div>
          <code>{success.trackingToken}</code>
        </div>
        <Notice>{t("keepToken")}</Notice>
        <div className="success-actions">
          <Link
            className="btn btn-primary"
            href={`/${locale}/r/${success.report.publicId}`}
          >
            {t("track")}
            <ArrowRight size={15} />
          </Link>
          <Link className="btn" href={`/${locale}`}>
            {t("backToMap")}
          </Link>
        </div>
      </div>
    );
  return (
    <div className="form-wrap">
      <PageHeading
        eyebrow={t("community")}
        title={t("reportTitle")}
        description={t("reportIntro")}
      />
      <ol
        className="steps"
        aria-label={`${t("step")} ${number(step)} ${t("of")} ${number(3)}`}
      >
        {[1, 2, 3].map((s) => (
          <li
            className={
              "step-item " +
              (s === step ? "active" : s < step ? "complete" : "")
            }
            key={s}
            aria-current={s === step ? "step" : undefined}
          >
            <span className="step-number">
              {s < step ? <Check size={14} /> : number(s)}
            </span>
            <span>{t(s === 1 ? "step1" : s === 2 ? "step2" : "step3")}</span>
          </li>
        ))}
      </ol>
      {errors.length > 0 && (
        <div ref={errorRef} tabIndex={-1} className="error-summary">
          <Notice error>
            <strong>{t("checkFields")}</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}
      {message && (
        <div className="mb-18">
          <Notice>
            {message}
            {message === t("offlineSaved") && (
              <>
                <br />
                <Link className="text-link" href={`/${locale}/my-reports`}>
                  {t("myReports")} →
                </Link>
              </>
            )}
          </Notice>
        </div>
      )}
      <section className="panel">
        <h2 className="panel-title" ref={headingRef} tabIndex={-1}>
          {t(step === 1 ? "step1" : step === 2 ? "step2" : "reviewTitle")}
        </h2>
        <p className="panel-description">
          {t(
            step === 1
              ? "photoHelp"
              : step === 2
                ? "locationHelp"
                : "reviewBody",
          )}
        </p>
        {step === 1 && (
          <>
            <label className="photo-upload">
              {preview ? (
                <div className="photo-preview-wrap">
                  <img
                    src={preview}
                    alt={t("photoAlt")}
                    className="photo-preview"
                  />
                  <span className="photo-state">
                    <Check size={15} />
                    {t("photoReady")} · {t("changePhoto")}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="upload-icon">
                    <Camera size={28} />
                  </span>
                  <strong>{t("choosePhoto")}</strong>
                  <small>{t("photoHelp")}</small>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label={t("choosePhoto")}
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </label>
            <p className="field-help mt-18">
              <ShieldCheck
                size={12}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              />
              {t("devicePrivacy")}
            </p>
          </>
        )}
        {step === 2 && (
          <div className="form-fields">
            <div className="location-box">
              <button
                className="btn btn-soft"
                onClick={locate}
                disabled={locating}
              >
                {locating ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <LocateFixed size={16} />
                )}
                {t(locating ? "locating" : "locate")}
              </button>
              <MapView
                point={point}
                onPoint={(p) => {
                  setPoint(p);
                  setSource("manual");
                  setAccuracy(0);
                  setDuplicates(null);
                }}
              />
              <div className="coordinates">
                <label>
                  {t("latitude")}
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.000001"
                    value={point.lat}
                    onChange={(e) => {
                      setPoint((p) => ({ ...p, lat: Number(e.target.value) }));
                      setSource("manual");
                      setDuplicates(null);
                    }}
                  />
                </label>
                <label>
                  {t("longitude")}
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.000001"
                    value={point.lng}
                    onChange={(e) => {
                      setPoint((p) => ({ ...p, lng: Number(e.target.value) }));
                      setSource("manual");
                      setDuplicates(null);
                    }}
                  />
                </label>
                <label>
                  {t("accuracy")}
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={accuracy}
                    onChange={(e) => setAccuracy(Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
            <label>
              {t("locationNote")}
              <input
                maxLength={160}
                placeholder={t("locationPlaceholder")}
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
              />
            </label>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend
                style={{ fontSize: 13, fontWeight: 550, marginBottom: 9 }}
              >
                {t("category")}
              </legend>
              <div className="category-grid">
                {categories.map((c) => (
                  <button
                    type="button"
                    aria-pressed={category === c}
                    className={
                      "category-option " + (category === c ? "selected" : "")
                    }
                    key={c}
                    onClick={() => {
                      setCategory(c);
                      setDuplicates(null);
                    }}
                  >
                    <CategoryIcon category={c} size={20} />
                    {t(c)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              {t("description")} <small>{t("optional")}</small>
              <textarea
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
              />
            </label>
          </div>
        )}
        {step === 3 && (
          <>
            <div className="review-grid">
              <img src={preview} alt={t("photoAlt")} />
              <dl className="review-data">
                <div>
                  <dt>{t("category")}</dt>
                  <dd>{t(category)}</dd>
                </div>
                <div>
                  <dt>{t("location")}</dt>
                  <dd>
                    <MapPin size={12} style={{ display: "inline" }} />{" "}
                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </dd>
                </div>
                <div>
                  <dt>{t("accuracy")}</dt>
                  <dd>{number(accuracy)}</dd>
                </div>
                {description && (
                  <div>
                    <dt>{t("description")}</dt>
                    <dd>{description}</dd>
                  </div>
                )}
              </dl>
            </div>
            <label className="consent-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {t("consent")}
                <Link
                  href={`/${locale}/privacy`}
                  className="text-link"
                  style={{ display: "block", marginTop: 7 }}
                >
                  {t("privacy")} ↗
                </Link>
              </span>
            </label>
            <small className="consent-detail">{t("consentVersion")}</small>
            {duplicates && duplicates.length > 0 && (
              <div className="duplicate-box" role="status">
                <h2>{t("possibleDuplicate")}</h2>
                <p>{t("duplicateBody")}</p>
                {duplicates.map((r) => (
                  <ReportCard key={r.publicId} report={r} />
                ))}
                <button
                  className="btn btn-primary mt-18"
                  disabled={busy}
                  onClick={() => void submit(true)}
                >
                  {t("submitAnyway")}
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
        <div className="form-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={
              step === 1
                ? () => void save()
                : () => {
                    setStep((s) => s - 1);
                    setErrors([]);
                  }
            }
          >
            {step === 1 ? <Save size={15} /> : <ArrowLeft size={15} />}
            {t(step === 1 ? "saveDraft" : "back")}
          </button>
          <div className="form-actions-group">
            {step > 1 && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => void save()}
              >
                <Save size={15} />
                <span>{t("saveDraft")}</span>
              </button>
            )}
            {step < 3 ? (
              <button className="btn btn-primary" onClick={next}>
                {t("continue")}
                <ArrowRight size={15} />
              </button>
            ) : (
              !duplicates?.length && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {t(busy ? "submitting" : "submit")}
                </button>
              )
            )}
          </div>
        </div>
      </section>
      <p className="field-help mt-18">{t("unsafe")}</p>
    </div>
  );
}
