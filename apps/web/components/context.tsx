"use client";
import { createContext, useContext } from "react";
import {
  messages,
  type Locale,
  type MessageKey,
} from "../../../packages/i18n/src/index";
export const LocaleContext = createContext<Locale>("bn-BD");
export function useI18n() {
  const locale = useContext(LocaleContext);
  const copy = messages(locale);
  return {
    locale,
    t: (key: MessageKey) => copy[key],
    number: (value: number) => new Intl.NumberFormat(locale).format(value),
    date: (value: string) =>
      new Date(value).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      }),
  };
}
