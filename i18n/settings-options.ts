import type { useTranslations } from "next-intl";
import { PAYMENT_TERMS } from "@/lib/payment-terms";

type Translate = ReturnType<typeof useTranslations<"SettingsGeneral">>;
const paymentKeys = {
  due_on_receipt: "dueOnReceipt", net_7: "net7", net_15: "net15",
  net_30: "net30", net_45: "net45", net_60: "net60", net_90: "net90",
} as const;

export function paymentTermLabel(t: Translate, value: typeof PAYMENT_TERMS[number]["value"]) {
  return t(paymentKeys[value]);
}

// Country names are CLDR reference data, not persisted translations. Keep the
// English reference name in en-US and as fallback for unsupported runtime data.
export function addressCountryName(locale: string, country: { code: string; name: string }) {
  if (locale === "en-US" || !/^[A-Z]{2}$/.test(country.code)) return country.name;
  try {
    const name = new Intl.DisplayNames([locale], { type: "region", fallback: "none" }).of(country.code);
    return name ?? country.name;
  } catch {
    return country.name;
  }
}
