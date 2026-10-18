"use client";
import { useTranslations } from "next-intl";
import { documentPreviewMessage, type DocumentFormTranslate } from "@/i18n/document-form-presentation";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountPicker } from "./account-picker";
import { documentEditorPreview, documentEditorDecimal } from "@/lib/money/document-editor";
import { procurementPreview } from "@/lib/money/procurement-ui";
import { billEditorPreview } from "@/lib/money/bill-editor";
import { recurringInvoiceEditorPreview } from "@/lib/money/recurring-invoice-ui";
import { recurringBillEditorPreview } from "@/lib/money/recurring-bill-ui";

export interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  accountId: string;
  taxRateId: string;
}

// Mirrors the tax-rates API row shape ({ taxRates: [...] } from GET /api/v1/tax-rates).
// `rate` is in basis points (e.g. 2000 = 20%).
interface TaxRateOption {
  id: string;
  name: string;
  rate: number;
  kind?: string;
  recoverablePercent?: number;
}

interface LineItemsEditorProps {
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
  accountTypeFilter?: string[];
  // Intent of the document, so we can surface purchase-side reclaim hints.
  taxContext?: "sales" | "purchase";
  /** Explicit document currency; omitted retains the shared historical fixed-two preview. */
  currencyCode?: string | null;
  roundPriceFirst?: boolean;
  priceFractionDigits?: number;
  onValidityChange?: (valid: boolean) => void;
  documentKind?: "invoice" | "bill" | "recurringInvoice" | "recurringBill" | "purchaseOrder";
}

// Format a basis-point rate as a percentage (2000 -> "20", 1750 -> "17.5").
function formatRatePct(rate: number) {
  return (rate / 100).toFixed(rate % 100 === 0 ? 0 : 2);
}

// Whether a purchase-side rate's input VAT can be reclaimed. Rates that don't
// carry a recoverable portion (exempt/no-vat) or are explicitly partial are
// flagged so users understand what they'll actually get back.
function reclaimHint(t: DocumentFormTranslate, rate: TaxRateOption): string {
  const kind = rate.kind || "standard";
  if (rate.rate <= 0 || kind === "exempt" || kind === "no_vat" || kind === "sales_tax_us") {
    return t("notReclaimable");
  }
  const recoverable = rate.recoverablePercent ?? 10000;
  if (recoverable <= 0) return t("notReclaimable");
  if (recoverable < 10000) return t("partlyReclaimable", { percent: formatRatePct(recoverable) });
  return t("reclaimable");
}

export function LineItemsEditor({ lines, onChange, accountTypeFilter, taxContext, currencyCode, roundPriceFirst = false, priceFractionDigits = 2, onValidityChange, documentKind = "invoice" }: LineItemsEditorProps) {
  const t = useTranslations("DocumentForms");
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);

  // Fetch the org's tax rates once (org via x-organization-id, mirroring the
  // bank-flow tax dropdown). Best-effort: on failure only "No tax" is offered.
  useEffect(() => {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
    if (!orgId) return;
    fetch("/api/v1/tax-rates", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.taxRates) setTaxRates(data.taxRates); })
      .catch(() => {});
  }, []);

  function updateLine(index: number, field: keyof LineItem, value: string) {
    const updated = lines.map((l, i) =>
      i === index ? { ...l, [field]: value } : l
    );
    onChange(updated);
  }

  function addLine() {
    onChange([
      ...lines,
      { description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" },
    ]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    onChange(lines.filter((_, i) => i !== index));
  }

  const previewCurrency = currencyCode === undefined ? "USD" : currencyCode;
  const preview = useMemo(() => documentKind === "bill"
    ? billEditorPreview(lines, previewCurrency, taxRates)
    : documentKind === "recurringInvoice" ? recurringInvoiceEditorPreview(lines, previewCurrency, taxRates)
    : documentKind === "recurringBill" ? recurringBillEditorPreview(lines, previewCurrency, taxRates)
    : documentKind === "purchaseOrder" ? procurementPreview(lines, previewCurrency, taxRates)
    : documentEditorPreview(lines, previewCurrency, taxRates, roundPriceFirst), [lines, previewCurrency, taxRates, roundPriceFirst, documentKind]);
  useEffect(() => { onValidityChange?.(!preview.error); }, [onValidityChange, preview]);
  const decimal = (amount: bigint) => preview.error || !previewCurrency ? "—" : documentEditorDecimal(amount, previewCurrency);

  return (
    <div className="space-y-3">
      {documentKind === "recurringBill" && <p className="text-xs text-muted-foreground">{t("recurringBillScale", { currency: currencyCode ?? "" })}</p>}
      {preview.error && <p role="alert" className="text-xs text-red-600">{documentPreviewMessage(t, preview.error)}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <div className="grid min-w-[620px] grid-cols-[1fr_80px_100px_120px_40px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("description")}</span>
          <span className="text-right">{t("quantity")}</span>
          <span className="text-right">{documentKind === "recurringBill" ? t("priceFixedScale") : currencyCode ? t("priceCurrency", { currency: currencyCode }) : t("price")}</span>
          <span className="text-right">{t("amount")}</span>
          <span />
        </div>
        {lines.map((line, i) => {
          const selectedRate = line.taxRateId
            ? taxRates.find((t) => t.id === line.taxRateId)
            : undefined;
          const hint =
            taxContext === "purchase" && selectedRate ? reclaimHint(t, selectedRate) : null;
          return (
            <div
              key={i}
              className="grid min-w-[620px] grid-cols-[1fr_80px_100px_120px_40px] gap-2 border-b px-3 py-2 last:border-b-0"
            >
              <div className="space-y-1">
                <Input
                  className="h-8 text-sm"
                  value={line.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  placeholder={t("itemDescription")}
                />
                <AccountPicker
                  value={line.accountId}
                  onChange={(v) => updateLine(i, "accountId", v)}
                  typeFilter={accountTypeFilter}
                  placeholder={t("account")}
                />
                <Select
                  value={line.taxRateId || "none"}
                  onValueChange={(v) => updateLine(i, "taxRateId", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t("noTax")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noTax")}</SelectItem>
                    {taxRates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({formatRatePct(t.rate)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hint && (
                  <p className="text-[11px] text-muted-foreground">{hint}</p>
                )}
              </div>
              <Input
                className="h-8 text-right text-sm font-mono tabular-nums"
                aria-label={t("quantityLine", { number: i + 1 })}
                type="number"
                step="any"
                value={line.quantity}
                onChange={(e) => updateLine(i, "quantity", e.target.value)}
              />
              <CurrencyInput
                size="sm"
                aria-label={t("priceLine", { number: i + 1 })}
                fractionDigits={priceFractionDigits}
                value={line.unitPrice}
                onChange={(v) => updateLine(i, "unitPrice", v)}
              />
              <span className="flex h-8 items-center justify-end text-sm font-mono font-medium tabular-nums">
                {decimal(preview.lines[i]?.amountMinor ?? 0n)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => removeLine(i)}
                aria-label={t("removeLine", { number: i + 1 })}
                disabled={lines.length <= 1}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLine}
            className="text-xs"
          >
            <Plus className="mr-1 size-3" />
            {t("addLine")}
          </Button>
          <div className="space-y-0.5 text-right text-sm font-mono tabular-nums">
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">{t("subtotal")}</span>
              <span>{decimal(preview.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-muted-foreground">{t("tax")}</span>
              <span>{decimal(preview.taxTotal)}</span>
            </div>
            <div className="flex justify-between gap-6 font-semibold">
              <span>{t("total")}</span>
              <span>{decimal(preview.total)}</span>
            </div>
            {"amountDue" in preview && typeof preview.amountDue === "bigint" && <div className="flex justify-between gap-6 font-semibold">
              <span>{t("amountDue")}</span>
              <span>{decimal(preview.amountDue)}</span>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
