import type { useTranslations } from "next-intl";

type Translator = ReturnType<typeof useTranslations<"GoodsReceipts">>;

/** Display labels only; request/filter values keep their canonical status codes. */
export function goodsReceiptStatusLabel(t: Translator, status: string) {
  switch (status) {
    case "draft": return t("draft");
    case "received": return t("receivedStatus");
    case "billed": return t("billedStatus");
    case "void": return t("cancelledStatus");
    default: return status;
  }
}
