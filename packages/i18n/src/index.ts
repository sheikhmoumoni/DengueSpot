import en from "../messages/en-BD.json";
import bn from "../messages/bn-BD.json";
export type Locale = "bn-BD" | "en-BD";
export type MessageKey = keyof typeof en;
export function messages(locale: Locale): Record<MessageKey, string> {
  return locale === "bn-BD" ? bn : en;
}
