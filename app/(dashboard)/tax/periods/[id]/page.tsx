"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { useState, useEffect, useCallback, useId } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localeDirection } from "@/i18n/locale";
import { taxPeriodTypeKey, taxPeriodStatusKey } from "@/lib/i18n/tax-period-presentation";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaxSettlementPreview } from "@/components/dashboard/tax-settlement-preview";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { taxUiMinor, taxUiCurrency, taxUiRows, taxUiMoney, taxUiAbs, taxUiDecimal, taxUiSettlement } from "@/lib/money/tax-ui";
import { cn } from "@/lib/utils";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";

interface TaxReturnLine {
  id: string;
  boxNumber: string;
  label: string;
  amount: bigint; // organization base-currency minor units
  isCalculated: boolean;
  sourceDescription: string | null;
  sortOrder: number;
}

interface TaxPeriodDetail {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  filedAt: string | null;
  filedReference: string | null;
  notes: string | null;
  lines: TaxReturnLine[];
}

const STATUS_STYLES: Record<string, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  filed:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  amended:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Settlement Sheet                                                   */
/* ------------------------------------------------------------------ */

function SettleSheet({
  period,
  open,
  onClose,
  onSettled,
  orgId,
  defaultIsRefund,
  netAmount,
  currency,
}: {
  period: TaxPeriodDetail;
  open: boolean;
  onClose: () => void;
  onSettled: () => void;
  orgId: string | null;
  defaultIsRefund: boolean;
  netAmount: bigint | null;
  currency: string;
}) {
  const fieldId = useId();
  const controlDirection = localeDirection(useLocale() === "fa-IR" ? "fa-IR" : "en-US");

  const presentation = usePresentation();
  const t = useTranslations("TaxPeriods");
  const [bankGlAccountId, setBankGlAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"pay" | "refund">(
    defaultIsRefund ? "refund" : "pay"
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill amount + direction from the filed net (box 5) when the sheet opens.
  useEffect(() => {
    if (!open) return;
    setDirection(defaultIsRefund ? "refund" : "pay");
    if (netAmount != null) {
      setAmount(taxUiDecimal(taxUiAbs(netAmount), currency));
    }
  }, [open, defaultIsRefund, netAmount, currency]);

  const preview = taxUiSettlement(amount, currency);

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || localStorage.getItem("activeOrgId") !== orgId) return;
    if (!bankGlAccountId) {
      toast.error(t("chooseAccount"));
      return;
    }
    const parsed = taxUiSettlement(amount, currency);
    if (parsed.error) {
      toast.error(amount === "" ? t("enterAmount") : t("invalidAmount"));
      return;
    }
    setSaving(true);
    let mismatch = false;
    try {
      const res = await fetch(`/api/v1/tax-periods/${period.id}/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          mode: "settle",
          bankGlAccountId,
          amountMinor: parsed.amountMinor,
          isRefund: direction === "refund",
          date,
          reference: reference || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed");
      }
      const saved = await res.json();
      if (taxUiCurrency(saved.currencyCode) !== currency || taxUiMinor(saved.amount, saved.amountMinor) !== parsed.amount) {
        mismatch = true;
        throw new Error("Settlement mismatch");
      }
      toast.success(
        direction === "refund"
          ? t("refundRecorded")
          : t("paymentRecorded")
      );
      onClose();
      onSettled();
    } catch {
      toast.error(mismatch ? t("settlementMismatch") : t("settlementFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent dir={controlDirection} className="overflow-y-auto max-h-dvh">
        <SheetHeader>
          <SheetTitle>{t("settlementTitle")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSettle} className="space-y-4 px-4">
          <p className="text-sm text-muted-foreground">
            {t.rich("settlementHelp", { name: period.name, em: (chunks) => <BidiText>{chunks}</BidiText> })}
          </p>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-direction`}>{t("whatHappened")}</Label>
            <Select dir={controlDirection}
              value={direction}
              onValueChange={(v) => setDirection(v as "pay" | "refund")}
            >
              <SelectTrigger id={`${fieldId}-direction`} className="min-w-0 data-[size=default]:h-auto min-h-9 *:data-[slot=select-value]:line-clamp-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pay">{t("paidOffice")}</SelectItem>
                <SelectItem value="refund">
                  {t("receivedRefund")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label id={`${fieldId}-bankGlAccountId`}>
              {direction === "refund"
                ? t("refundAccount")
                : t("paymentAccount")}
            </Label>
            <div role="group" aria-labelledby={`${fieldId}-bankGlAccountId`}><AccountPicker
              value={bankGlAccountId}
              onChange={setBankGlAccountId}
              typeFilter={["asset"]}
              currencyFilter={currency}
              subTypeFilter="bank"
              placeholder={t("accountPlaceholder")}
            /></div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-settlement-amount">{t.rich("amountCurrency", { currency: currencyLabel(currency, presentation.locale), em: (chunks) => <BidiText>{chunks}</BidiText> })}</Label>
            <Input dir="ltr"
              id="tax-settlement-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <TaxSettlementPreview amount={amount} currency={currency} />

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-date`}>{t("date")}</Label>
            <Input dir="ltr" id={`${fieldId}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-reference`}>{t("reference")}</Label>
            <Input dir="ltr" id={`${fieldId}-reference`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("referencePlaceholder")}
            />
          </div>

          <Button
            type="submit"
            disabled={saving || !!preview.error || !bankGlAccountId}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {saving
              ? t("saving")
              : direction === "refund"
                ? t("recordRefund")
                : t("recordPayment")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function TaxPeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <TaxPeriodWorkspace key={`${orgId}:${id}`} id={id} orgId={orgId} />;
}

function TaxPeriodWorkspace({ id, orgId }: { id: string; orgId: string | null }) {
  const presentation = usePresentation();
  const t = useTranslations("TaxPeriods");
  const [period, setPeriod] = useState<TaxPeriodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [settleOpen, setSettleOpen] = useState(false);

  const [currency, setCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEntityTitle(period?.name);

  const fetchPeriod = useCallback(async (signal?: AbortSignal) => {
    if (!orgId) { setLoading(false); return; }
    try {
      const options = { headers: { "x-organization-id": orgId }, signal };
      const [res, orgRes] = await Promise.all([fetch(`/api/v1/tax-periods/${id}`, options), fetch("/api/v1/organization", options)]);
      if (!res.ok || !orgRes.ok) throw new Error("Could not load tax period currency or amounts");
      const data = await res.json(), orgData = await orgRes.json();
      const code = taxUiCurrency(orgData.organization?.defaultCurrency);
      const lines = taxUiRows(data.taxPeriod?.lines as (Omit<TaxReturnLine, "amount"> & { amount: number })[], ["amount"]);
      if (!signal?.aborted) { setPeriod({ ...data.taxPeriod, lines }); setCurrency(code); setError(null); }
    } catch {
      if (!signal?.aborted) { setPeriod(null); setError(t("loadDetailFailed")); }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id, orgId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPeriod(controller.signal);
    return () => controller.abort();
  }, [fetchPeriod]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("loading")} />
        <BrandLoader className="h-48" />
      </div>
    );
  }

  if (!period || !currency) {
    return (
      <div className="space-y-6">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <PageHeader title={t("notFound")}>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tax/periods">
              <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
              {t("back")}
            </Link>
          </Button>
        </PageHeader>
      </div>
    );
  }

  const lines = [...(period.lines || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const isFiled = period.status !== "open";

  // Box 5 is the filed net: positive = owed to the authority, negative = refund.
  const box5 = lines.find((l) => l.boxNumber === "5");
  const netAmount = box5 ? box5.amount : null;
  const defaultIsRefund = netAmount != null && netAmount < 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={period.name}
        description={`${fmtDate(period.startDate)} – ${fmtDate(period.endDate)}`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/tax/periods">
            <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
            {t("back")}
          </Link>
        </Button>
      </PageHeader>

      {/* Status + meta */}
      <div className="flex flex-wrap gap-y-2 flex-wrap items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className={cn(STATUS_STYLES[period.status] || "")}
        >
          {t(taxPeriodStatusKey(period.status))}
        </Badge>
        <span className="flex flex-wrap gap-y-2 items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {t(taxPeriodTypeKey(period.type))}
        </span>
        {period.filedAt && (
          <span className="text-xs sm:text-sm text-muted-foreground">
            {t.rich("submittedDate", { date: fmtDate(period.filedAt), em: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
          </span>
        )}
        {period.filedReference && (
          <span className="text-xs sm:text-sm text-muted-foreground">
            {t.rich("referenceValue", { reference: period.filedReference, em: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
          </span>
        )}
      </div>

      {/* Settle action */}
      {isFiled && (
        <div className="flex flex-wrap gap-y-2 flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
            <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("settleTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {netAmount == null
                ? t("settleHelp")
                : netAmount < 0
                  ? t.rich("refundDue", { amount: taxUiMoney(taxUiAbs(netAmount), currency, presentation), em: (chunks) => <BidiText>{chunks}</BidiText> })
                  : netAmount > 0
                    ? t.rich("paymentDue", { amount: taxUiMoney(netAmount, currency, presentation), em: (chunks) => <BidiText>{chunks}</BidiText> })
                    : t("nothingDue")}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setSettleOpen(true)}
          >
            <Banknote className="me-1.5 size-3.5" />
            {t("recordSettlement")}
          </Button>
        </div>
      )}

      {/* Filed boxes */}
      {lines.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("returnBoxes")}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-16 px-4 py-2.5 text-start text-xs font-medium text-muted-foreground">
                    {t("box")}
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-muted-foreground">
                    {t("boxDescription")}
                  </th>
                  <th className="px-4 py-2.5 text-end text-xs font-medium text-muted-foreground">
                    {t("amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const isTotal =
                    line.boxNumber === "3" || line.boxNumber === "5";
                  return (
                    <tr
                      key={line.id}
                      className={cn(
                        "border-b last:border-b-0",
                        isTotal && "bg-muted/20 font-medium"
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        <IdentifierText>{line.boxNumber}</IdentifierText>
                      </td>
                      <td className="px-4 py-2.5">
                        <BidiText>{line.label}</BidiText>
                        {line.sourceDescription && (
                          <span className="ms-2 text-[11px] text-muted-foreground">
                            <BidiText>{line.sourceDescription}</BidiText>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-end font-mono tabular-nums">
                        <BidiText>{taxUiMoney(line.amount, currency, presentation)}</BidiText>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {netAmount != null && (
            <p className="flex flex-wrap gap-y-2 items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {netAmount < 0
                ? t("negativeBoxHelp")
                : t("netBoxHelp")}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Receipt className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium">{t("noBoxes")}</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {isFiled
              ? t("noFrozenBoxes")
              : t("submitBoxesHelp")}
          </p>
        </div>
      )}

      {/* Notes */}
      {period.notes && (
        <div className="rounded-lg border p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t("notes")}</p>
          <p className="text-sm"><BidiText>{period.notes}</BidiText></p>
        </div>
      )}

      <SettleSheet
        key={`${period.id}:${settleOpen}`}
        period={period}
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        onSettled={() => { void fetchPeriod(); }}
        orgId={orgId}
        defaultIsRefund={defaultIsRefund}
        netAmount={netAmount}
        currency={currency}
      />
    </div>
  );
}
