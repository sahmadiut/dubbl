import type { useTranslations } from "next-intl";
import type { StatementFormat } from "@/app/(dashboard)/accounting/banking/[id]/_components";

type Translate = ReturnType<typeof useTranslations<"BankImports">>;

// Format values remain machine identifiers; only automatic detection is prose.
export function bankImportFormatLabels(t: Translate): Record<StatementFormat, string> {
  return {
    auto: t("autoDetect"), csv: "CSV", tsv: "TSV", qif: "QIF", ofx: "OFX",
    qfx: "QFX", qbo: "QBO", camt052: "CAMT.052", camt053: "CAMT.053",
    camt054: "CAMT.054", mt940: "MT940", mt942: "MT942", bai2: "BAI2",
  };
}

const warningKeys = {
  "No statement lines were parsed from the delimited file.": "noDelimitedLines",
  "No transactions were found in the QIF file.": "noQifTransactions",
  "No transaction entries were found in the OFX/QFX/QBO file.": "noOfxTransactions",
  "No transaction entries were found in the CAMT file.": "noCamtTransactions",
  "No :61: transaction lines were found in the MT statement.": "noMtTransactions",
  "No transaction detail lines were found in the BAI2 file.": "noBaiTransactions",
} as const;

// Parser/storage/REST/MCP warnings retain their existing English contract.
export function bankImportWarning(t: Translate, warning: string) {
  return Object.hasOwn(warningKeys, warning)
    ? t(warningKeys[warning as keyof typeof warningKeys])
    : t("unknownWarning");
}
