import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"AgingVendorReports">>;
const buckets = {
  Current: "current",
  "1-30 days": "days1to30",
  "31-60 days": "days31to60",
  "61-90 days": "days61to90",
  "90+ days": "daysOver90",
} as const;

/** Translate display labels only; service keys and CSV bucket values stay canonical. */
export function agingBucketLabel(t: Translate, label: string): string {
  return Object.hasOwn(buckets, label) ? t(buckets[label as keyof typeof buckets]) : label;
}
