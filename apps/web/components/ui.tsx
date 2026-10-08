"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Droplets,
  Construction,
  Container,
  Trash2,
  House,
  TreePine,
  HelpCircle,
  Clock3,
  Check,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type {
  Category,
  Status,
  PublicReport,
} from "../../../packages/domain/src/index";
import { useI18n } from "./context";
import type { MessageKey } from "../../../packages/i18n/src/index";
export const statusKey: Record<Status, MessageKey> = {
  draft: "draft",
  submitted: "reported",
  under_review: "inReview",
  verified: "verified",
  assigned: "assigned",
  in_progress: "working",
  resolved: "resolved",
  rejected: "rejected",
  duplicate: "duplicate",
  withdrawn: "withdrawn",
  archived: "archived",
};
export function CategoryIcon({
  category,
  size = 20,
}: {
  category: Category;
  size?: number;
}) {
  const Icon = {
    standing_water: Droplets,
    water_container: Container,
    construction: Construction,
    drain: Droplets,
    tire_or_waste: Trash2,
    rooftop: House,
    public_space: TreePine,
    other: HelpCircle,
  }[category];
  return <Icon size={size} aria-hidden="true" />;
}
export function Badge({ status }: { status: Status }) {
  const { t } = useI18n();
  return (
    <span className={"badge status-" + status}>
      {status === "resolved" ? (
        <Check size={12} />
      ) : status === "in_progress" ? (
        <LoaderCircle size={12} />
      ) : (
        <span className="badge-dot" />
      )}
      {t(statusKey[status])}
    </span>
  );
}
export function ReportCard({
  report,
  compact = false,
}: {
  report: PublicReport;
  compact?: boolean;
}) {
  const { t, locale, date } = useI18n();
  return (
    <Link
      className={"report-card " + (compact ? "compact" : "")}
      href={`/${locale}/r/${report.publicId}`}
    >
      <span className={"category-icon cat-" + report.category}>
        <CategoryIcon category={report.category} />
      </span>
      <div className="report-card-main">
        <div className="report-card-title">
          {t(report.category)}
          <ArrowUpRight size={16} />
        </div>
        <span className="report-area">{report.area}</span>
        <div className="report-card-bottom">
          <Badge status={report.status} />
          <span className="small muted">
            <Clock3 size={12} />
            {date(report.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={"notice " + (error ? "error" : "")}
      role={error ? "alert" : "status"}
    >
      <ShieldCheck size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {t("loading")}
    </div>
  );
}
