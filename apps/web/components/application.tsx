"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Map,
  Plus,
  ClipboardList,
  BookOpen,
  Building2,
  ShieldCheck,
  ArrowUpRight,
  Globe,
  MapPin,
  Menu,
  X,
  LogIn,
  LogOut,
  ChevronRight,
  WifiOff,
  Leaf,
} from "lucide-react";
import { LocaleContext, useI18n } from "./context";
import type { Locale, MessageKey } from "../../../packages/i18n/src/index";
import type { Actor } from "../../../packages/domain/src/index";
import { api, syncWaiting } from "../lib/client";
import { HomePage } from "./home";
import { ReportForm } from "./report-form";
import {
  MyReports,
  ReportDetail,
  LearnPage,
  PrivacyPage,
  LoginPage,
  QrPage,
} from "./pages";
import { AuthorityPage, AuthorityDetail, ModerationPage } from "./operations";
export function Application({
  locale,
  segments,
}: {
  locale: Locale;
  segments: string[];
}) {
  return (
    <LocaleContext.Provider value={locale}>
      <Shell segments={segments} />
    </LocaleContext.Provider>
  );
}
function Shell({ segments }: { segments: string[] }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [demo, setDemo] = useState(false);
  const [actor, setActor] = useState<Actor>({
    id: "guest",
    role: "guest",
    jurisdictions: [],
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    api<{ demo: boolean }>("config")
      .then((c) => setDemo(c.demo))
      .catch(() => {});
    api<{ actor: Actor }>("auth/session")
      .then((c) => setActor(c.actor))
      .catch(() => {});
    const connection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void syncWaiting();
    };
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    const interval = window.setInterval(() => void syncWaiting(), 30000);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.clearInterval(interval);
    };
  }, [locale]);
  const links: [MessageKey, string, typeof Map][] = [
    ["map", "", Map],
    ["myReports", "my-reports", ClipboardList],
    ["learn", "learn", BookOpen],
  ];
  const other: [MessageKey, string, typeof Map][] = [
    ["authority", "authority", Building2],
    ["moderation", "moderation", ShieldCheck],
  ];
  const nav = (items: typeof links) =>
    items.map(([label, slug, Icon]) => (
      <Link
        key={label}
        href={`/${locale}/${slug}`}
        className={
          "nav-item " + ((segments[0] || "") === slug ? "selected" : "")
        }
        onClick={() => setMobileOpen(false)}
      >
        <Icon size={19} />
        <span>{t(label)}</span>
        {(segments[0] || "") === slug && (
          <ChevronRight size={15} className="nav-arrow" />
        )}
      </Link>
    ));
  let content: React.ReactNode;
  const first = segments[0];
  if (!first) content = <HomePage />;
  else if (first === "report") content = <ReportForm />;
  else if (first === "r" && segments[1])
    content = <ReportDetail publicId={segments[1]} />;
  else if (first === "my-reports") content = <MyReports />;
  else if (first === "learn") content = <LearnPage />;
  else if (first === "privacy") content = <PrivacyPage />;
  else if (first === "login") content = <LoginPage />;
  else if (first === "qr") content = <QrPage />;
  else if (first === "authority" && segments[1] === "reports" && segments[2])
    content = <AuthorityDetail id={segments[2]} />;
  else if (first === "authority")
    content = <AuthorityPage queueOnly={segments[1] === "reports"} />;
  else if (first === "moderation") content = <ModerationPage />;
  else content = <h1>{t("routeNotFound")}</h1>;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t("home")}
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label={t("close")}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={"sidebar " + (mobileOpen ? "is-open" : "")}
        aria-label={t("menu")}
      >
        <Link className="brand" href={`/${locale}`}>
          <img src="/icon.svg" width="37" height="37" alt="" />
          <span>
            {t("brand")}
            <small>{t("tagline")}</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobileOpen(false)}
          aria-label={t("close")}
        >
          <X />
        </button>
        <p className="nav-section">{t("community")}</p>
        <nav>
          {nav(links)}
          <Link
            className={
              "nav-item report-nav " + (first === "report" ? "selected" : "")
            }
            href={`/${locale}/report`}
          >
            <Plus size={20} />
            {t("report")}
          </Link>
        </nav>
        <div className="sidebar-rule" />
        <p className="nav-section">{t("operations")}</p>
        <nav>{nav(other)}</nav>
        <div className="sidebar-bottom">
          <div className="community-card">
            <span className="leaf-circle">
              <Leaf size={22} />
            </span>
            <strong>{t("neighbors")}</strong>
            <p>{t("collectiveBody")}</p>
            <Link href={`/${locale}/learn`}>
              {t("learnMore")}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link className="nav-item privacy-nav" href={`/${locale}/privacy`}>
            <ShieldCheck size={18} />
            {t("privacy")}
          </Link>
          <span className="sidebar-footer">{t("footer")}</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("menu")}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span>{t("community")}</span>
            <ChevronRight size={14} />
            <strong>
              {t(
                first === "report"
                  ? "report"
                  : first === "authority"
                    ? "authority"
                    : first === "moderation"
                      ? "moderation"
                      : first === "my-reports"
                        ? "myReports"
                        : first === "learn"
                          ? "learn"
                          : first === "privacy"
                            ? "privacy"
                            : "home",
              )}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="location-chip">
              <MapPin size={15} />
              {t("demoShort")}
            </span>
            <Link
              className="language-button"
              href={pathname.replace(
                "/" + locale,
                "/" + (locale === "bn-BD" ? "en-BD" : "bn-BD"),
              )}
            >
              <Globe size={16} />
              {t("language")}
            </Link>
            {actor.role === "guest" ? (
              <Link
                className="account-button"
                href={`/${locale}/login`}
                aria-label={t("signIn")}
              >
                <LogIn size={18} />
                <span>{t("signIn")}</span>
              </Link>
            ) : (
              <button
                className="account-button"
                onClick={async () => {
                  await api("auth/logout", { method: "POST", body: "{}" });
                  location.href = `/${locale}`;
                }}
                aria-label={t("signOut")}
              >
                <LogOut size={18} />
                <span>{t("signOut")}</span>
              </button>
            )}
          </div>
        </header>
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            {t("connection")}
          </div>
        )}
        <main id="main" className="content" tabIndex={-1}>
          {content}
        </main>
        <footer className="page-footer">
          <span>
            <img src="/icon.svg" width="17" height="17" alt="" />
            {t("footer")}
          </span>
          {demo && <span className="demo-tag">{t("demo")}</span>}
        </footer>
      </div>
      <nav className="bottom-nav" aria-label={t("menu")}>
        {[
          ["map", "", Map],
          ["report", "report", Plus],
          ["myReports", "my-reports", ClipboardList],
          ["learn", "learn", BookOpen],
        ].map(([label, slug, Icon]) => {
          const NavIcon = Icon as typeof Map;
          return (
            <Link
              key={label as string}
              className={(segments[0] || "") === slug ? "active" : ""}
              href={`/${locale}/${slug}`}
            >
              <NavIcon size={21} />
              {t(label as MessageKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
