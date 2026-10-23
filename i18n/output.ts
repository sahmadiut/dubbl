import { createTranslator } from "next-intl";
import en from "@/messages/en-US.json";
import fa from "@/messages/fa-IR.json";
import type { AppLocale } from "./locale";

/** Explicit per-output locale; never depend on cookies in background jobs.
 * Existing callers retain English until recipient locale delivery is qualified.
 */
export function outputTranslator(locale: AppLocale = "en-US") {
  return createTranslator({ locale, messages: locale === "fa-IR" ? fa : en, namespace: "Output" });
}

const documentKinds = ["invoice", "quote", "credit_note", "purchase_order", "debit_note"] as const;
export function outputDocumentKind(value: string) {
  return documentKinds.find(kind => kind === value) ?? "document";
}
