import { notFound } from "next/navigation";
import { Application } from "../../../components/application";
import type { Locale } from "../../../../../packages/i18n/src/index";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>;
}) {
  const p = await params;
  if (!["bn-BD", "en-BD"].includes(p.locale)) notFound();
  return <Application locale={p.locale as Locale} segments={p.slug || []} />;
}
