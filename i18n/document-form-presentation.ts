import type { useTranslations } from "next-intl";

export type DocumentFormTranslate = ReturnType<typeof useTranslations<"DocumentForms">>;

/** Localize reviewed editor failures without exposing parser or future server prose. */
export function documentPreviewMessage(t: DocumentFormTranslate, message: string) {
  switch (message) {
    case "Enter a decimal price with at most 18 fractional digits": return t("priceError");
    case "Add between 1 and 1000 invoice lines": return t("lineCountError");
    case "Enter a valid decimal quantity": return t("quantityError");
    case "Select a customer or invoice currency to preview totals": return t("invoiceCurrencyError");
    case "Select a supplier or bill currency to preview totals": return t("billCurrencyError");
    case "Select a template currency to preview totals": return t("templateCurrencyError");
    case "Select a procurement currency": return t("procurementCurrencyError");
    case "Reload tax rates before previewing this bill": return t("reloadTaxError");
    case "Check the line quantity, account and tax selection": return t("lineSelectionError");
    case "Check line quantities, accounts and tax selection": return t("procurementSelectionError");
    case "Add a description for every line": return t("descriptionError");
    case "Invoice amount, product or sum exceeds the safe numeric workflow range":
    case "Minor-unit overflow": return t("rangeError");
    default: return t("amountError");
  }
}
