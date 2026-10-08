"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  ArrowRight,
  ShieldCheck,
  MapPin,
  ClipboardCheck,
  Sparkles,
  Droplets,
  Camera,
  CheckCircle2,
  Users,
  Map,
  LayoutList,
  ArrowUpRight,
} from "lucide-react";
import {
  categories,
  type PublicReport,
} from "../../../packages/domain/src/index";
import { useI18n } from "./context";
import { ReportCard, Loading } from "./ui";
import { MapView } from "./map-view";
import { api } from "../lib/client";
export function CommunityArt() {
  return (
    <svg viewBox="0 0 280 240" fill="none" aria-hidden="true">
      <ellipse cx="145" cy="212" rx="115" ry="11" fill="#cadcc9" opacity=".7" />
      <path
        d="M45 173V94l58-32 53 31v80"
        fill="#f8fbf3"
        stroke="#9dbb9f"
        strokeWidth="1.5"
      />
      <path
        d="m32 103 71-43 68 42"
        stroke="#3e7e62"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M93 173v-41h25v41" fill="#9ac1a3" />
      <rect
        x="57"
        y="111"
        width="22"
        height="26"
        rx="2"
        fill="#cfe4c8"
        stroke="#7da987"
      />
      <path d="M68 111v26m-11-13h22" stroke="#7da987" />
      <rect
        x="129"
        y="111"
        width="17"
        height="26"
        rx="2"
        fill="#cfe4c8"
        stroke="#7da987"
      />
      <path d="M138 111v26" stroke="#7da987" />
      <path d="M188 199v-58" stroke="#7f9e6f" strokeWidth="5" />
      <path
        d="M188 169c-36-12-39-46-11-58 6-21 32-24 40-1 25 13 20 50-29 59Z"
        fill="#9dbe83"
      />
      <path
        d="M188 158v-32m0 25 13-15m-13 5-9-9"
        stroke="#6c9660"
        strokeWidth="2"
      />
      <rect x="169" y="193" width="35" height="14" rx="4" fill="#a1b993" />
      <path
        d="M30 199c-4-15-15-18-15-32 17 1 23 19 20 32m0 0c0-19 5-30 17-31 2 13-9 22-13 31"
        fill="#88b28a"
      />
      <path
        d="M230 198c0-22 10-32 18-38 8 16-3 28-10 38m-4-7c-15-3-16-14-15-20 12 1 17 13 15 20"
        fill="#88b28a"
      />
      <circle cx="166" cy="149" r="10" fill="#deb795" />
      <path
        d="M155 147c-1-13 9-18 18-10 3 2 4 6 3 10-9 0-11-4-13-6l-3 6Z"
        fill="#365a44"
      />
      <path d="M154 162h21l9 31h-34Z" fill="#157d6b" />
      <path
        d="m156 192-2 19m20-19 4 19"
        stroke="#3c5d4b"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="m154 168-10 13-14-7m44-5 8 11 8-4"
        stroke="#deb795"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect
        x="125"
        y="161"
        width="12"
        height="18"
        rx="3"
        fill="#f7fcf4"
        stroke="#3b6e53"
        strokeWidth="2"
        transform="rotate(-15 130 170)"
      />
      <path
        d="M218 34c-18 0-32 14-32 31 0 24 32 51 32 51s31-27 31-51c0-17-14-31-31-31Z"
        fill="#087e75"
      />
      <circle cx="218" cy="65" r="15" fill="#e6f4d8" />
      <path
        d="m210 65 6 6 11-13"
        stroke="#087e75"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="55" cy="41" r="3" fill="#99b78c" />
      <circle cx="253" cy="142" r="3" fill="#99b78c" />
      <path d="m149 41 5 2 2 5 2-5 5-2-5-2-2-5-2 5-5 2Z" fill="#a6bd89" />
    </svg>
  );
}
export function HomePage() {
  const { t, locale, number } = useI18n();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [error, setError] = useState(false);
  useEffect(() => {
    api<{ reports: PublicReport[] }>("reports")
      .then((r) => setReports(r.reports))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (!category || r.category === category) &&
          (!status ||
            (status === "active"
              ? ![
                  "resolved",
                  "rejected",
                  "withdrawn",
                  "archived",
                  "duplicate",
                ].includes(r.status)
              : r.status === status)),
      ),
    [reports, category, status],
  );
  const stats = [
    {
      key: "total" as const,
      value: reports.length,
      Icon: MapPin,
      bottom: "community" as const,
    },
    {
      key: "resolvedCount" as const,
      value: reports.filter((r) => r.status === "resolved").length,
      Icon: CheckCircle2,
      bottom: "reviewBadge" as const,
    },
    {
      key: "actionCount" as const,
      value: reports.filter((r) =>
        ["in_progress", "assigned"].includes(r.status),
      ).length,
      Icon: Users,
      bottom: "collective" as const,
    },
  ];
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <div className="eyebrow">
            <span className="dot resolved" />
            {t("community")}
          </div>
          <h1>{t("welcome")}</h1>
          <p>{t("intro")}</p>
          <Link href={`/${locale}/report`} className="btn btn-primary">
            <Plus size={18} />
            {t("newReport")}
            <ArrowUpRight size={15} />
          </Link>
          <p className="hero-note">
            <ShieldCheck size={12} />
            {t("anonymous")}
          </p>
        </div>
        <div className="hero-art">
          <CommunityArt />
        </div>
      </section>
      <div className="stats-grid">
        {stats.map(({ key, value, Icon, bottom }) => (
          <div className="stat-card" key={key}>
            <div>
              <span className="stat-label">{t(key)}</span>
              <strong className="stat-number">{number(value)}</strong>
              <span className="stat-bottom">
                <span className="dot resolved" />
                {t(bottom)}
              </span>
            </div>
            <span className="stat-icon">
              <Icon size={22} />
            </span>
          </div>
        ))}
      </div>
      <section>
        <div className="section-heading">
          <div>
            <h2>{t("liveMap")}</h2>
            <p>{t("mapIntro")}</p>
          </div>
          <div className="segmented">
            <button
              className={view === "map" ? "active" : ""}
              onClick={() => setView("map")}
              aria-pressed={view === "map"}
            >
              <Map size={13} />
              {t("mapView")}
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <LayoutList size={13} />
              {t("list")}
            </button>
          </div>
        </div>
        <div className="map-section">
          <div className="map-toolbar">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={t("category")}
            >
              <option value="">{t("allCategories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={t("status")}
            >
              <option value="">{t("allReports")}</option>
              <option value="active">{t("active")}</option>
              <option value="resolved">{t("resolved")}</option>
              <option value="in_progress">{t("working")}</option>
            </select>
            <span className="toolbar-label">
              <span className="dot resolved" />
              {number(filtered.length)} {t("showing")}
            </span>
          </div>
          {loading ? (
            <Loading />
          ) : error ? (
            <div className="empty">{t("errorGeneric")}</div>
          ) : view === "map" ? (
            <div className="map-and-list">
              <MapView reports={filtered} />
              <aside className="map-recent">
                <div className="map-recent-heading">
                  {t("recent")}
                  <span className="count-pill">{number(filtered.length)}</span>
                </div>
                <div className="recent-scroll">
                  {filtered.slice(0, 8).map((r) => (
                    <ReportCard key={r.publicId} report={r} compact />
                  ))}
                  {!filtered.length && (
                    <div className="empty">{t("noReports")}</div>
                  )}
                </div>
                <div className="map-recent-footer">
                  <button className="text-link" onClick={() => setView("list")}>
                    {t("viewAll")}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="list-grid">
              {filtered.map((r) => (
                <ReportCard key={r.publicId} report={r} />
              ))}
              {!filtered.length && (
                <div className="empty">{t("noReports")}</div>
              )}
            </div>
          )}
          <div className="privacy-strip">
            <ShieldCheck size={14} />
            <span>{t("privacyShort")}</span>
            <Link href={`/${locale}/privacy`}>{t("learnMore")} ↗</Link>
          </div>
        </div>
      </section>
      <section className="how-section">
        <div className="section-heading">
          <h2>{t("how")}</h2>
          <Link href={`/${locale}/learn`} className="text-link">
            {t("learnMore")}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="how-grid">
          {[
            { icon: Droplets, title: "how1", body: "how1Body" },
            { icon: Camera, title: "how2", body: "how2Body" },
            { icon: ClipboardCheck, title: "how3", body: "how3Body" },
          ].map(({ icon: Icon, title, body }) => (
            <div className="how-card" key={title}>
              <div className="how-icon">
                <Icon size={19} />
              </div>
              <div>
                <h3>{t(title as "how1")}</h3>
                <p>{t(body as "how1Body")}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <span className="sr-only">
        <Sparkles />
        {t("source")}
      </span>
    </>
  );
}
