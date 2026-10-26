"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { useState, useEffect, useMemo, useId } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localeDirection } from "@/i18n/locale";
import { taxUiMinor, taxUiCurrency, taxUiMoney, taxUiRate, taxUiRateInput } from "@/lib/money/tax-ui";
import {
  Plus,
  Search,
  Coins,
  ArrowRightLeft,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { PageHeader } from "@/components/dashboard/page-header";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { CurrencySelect } from "@/components/ui/currency-select";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

interface ExchangeRate {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  rateExact?: string | null;
  date: string;
  source: "manual" | "api";
}

interface UnrealizedFxItem {
  type: "invoice" | "bill";
  id: string;
  number: string;
  currencyCode: string;
  amountDue: bigint;
  unrealizedGainLoss: bigint | null;
}

interface UnrealizedFxReport {
  defaultCurrency: string;
  items: UnrealizedFxItem[];
  summary: {
    totalItems: number;
    missingRateItems: number;
    totalUnrealizedGain: bigint;
    totalUnrealizedLoss: bigint;
    netUnrealizedGainLoss: bigint;
  };
}

function AddCurrencySheet({
  open,
  setOpen,
  onCreated,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreated: () => void;
}) {
  const fieldId = useId();
  const controlDirection = localeDirection(useLocale() === "fa-IR" ? "fa-IR" : "en-US");

  const t = useTranslations("TaxCurrencies");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault?.();
    if (!code || !name || !symbol) return;
    setSaving(true);
    try {
      const res = await fetch("/api/currencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          symbol,
          decimalPlaces: parseInt(decimalPlaces),
        }),
      });
      if (!res.ok) {
        throw new Error("Request failed");
      }
      toast.success(t("currencyAdded"));
      setOpen(false);
      setCode("");
      setName("");
      setSymbol("");
      setDecimalPlaces("2");
      onCreated();
    } catch {
      toast.error(t("currencyFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent dir={controlDirection} className="overflow-y-auto max-h-dvh">
        <SheetHeader>
          <SheetTitle>{t("addCurrency")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleCreate} className="space-y-4 px-4">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-code`}>{t("code")}</Label>
            <Input dir="ltr" id={`${fieldId}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("codePlaceholder")}
              maxLength={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-name`}>{t("name")}</Label>
            <Input dir="auto" id={`${fieldId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-symbol`}>{t("symbol")}</Label>
            <Input dir="auto" id={`${fieldId}-symbol`}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t("symbolPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-decimalPlaces`}>{t("decimalPlaces")}</Label>
            <Input dir="ltr" id={`${fieldId}-decimalPlaces`}
              type="number"
              min="0"
              max="4"
              value={decimalPlaces}
              onChange={(e) => setDecimalPlaces(e.target.value)}
              required
            />
          </div>
        </form>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button
            onClick={handleCreate}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? t("adding") : t("addCurrency")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AddRateSheet({
  open,
  setOpen,
  onCreated,
  orgId,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreated: () => void;
  orgId: string | null;
}) {
  const fieldId = useId();
  const controlDirection = localeDirection(useLocale() === "fa-IR" ? "fa-IR" : "en-US");

  const t = useTranslations("TaxCurrencies");
  const [baseCurrency, setBaseCurrency] = useState("");
  const [targetCurrency, setTargetCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function handleCreate(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault?.();
    if (!orgId || !baseCurrency || !targetCurrency || !rate || !date) return;
    setSaving(true);
    try {
      const exact = taxUiRateInput(rate);
      const res = await fetch("/api/v1/exchange-rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          rates: [
            {
              baseCurrency,
              targetCurrency,
              ...exact,
              date,
              source: "manual",
            },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error("Request failed");
      }
      toast.success(t("rateCreated"));
      setOpen(false);
      setBaseCurrency("");
      setTargetCurrency("");
      setRate("");
      setDate(new Date().toISOString().slice(0, 10));
      onCreated();
    } catch {
      toast.error(t("rateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent dir={controlDirection} className="overflow-y-auto max-h-dvh">
        <SheetHeader>
          <SheetTitle>{t("newRate")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleCreate} className="space-y-4 px-4">
          <div className="space-y-2">
            <Label id={`${fieldId}-baseCurrency`}>{t("baseCurrency")}</Label>
            <div role="group" aria-labelledby={`${fieldId}-baseCurrency`}><CurrencySelect value={baseCurrency} onValueChange={setBaseCurrency} /></div>
          </div>
          <div className="space-y-2">
            <Label id={`${fieldId}-targetCurrency`}>{t("targetCurrency")}</Label>
            <div role="group" aria-labelledby={`${fieldId}-targetCurrency`}><CurrencySelect value={targetCurrency} onValueChange={setTargetCurrency} /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-rate`}>{t("rate")}</Label>
            <Input dir="ltr" id={`${fieldId}-rate`}
              type="number"
              step="0.000001"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="1.234567"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              {t("rateHelp")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-date`}>{t("date")}</Label>
            <Input dir="ltr" id={`${fieldId}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </form>
        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button
            onClick={handleCreate}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? t("creating") : t("create")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function CurrenciesPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <CurrenciesWorkspace key={orgId} orgId={orgId} />;
}

function CurrenciesWorkspace({ orgId }: { orgId: string | null }) {
  const presentation = usePresentation();
  const t = useTranslations("TaxCurrencies");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [fxError, setFxError] = useState(false);
  const [fxReport, setFxReport] = useState<UnrealizedFxReport | null>(null);
  useDocumentTitle(t("documentTitle"));


  async function fetchOrganization() {
    try {
      const res = await fetch("/api/v1/organization", {
        headers: orgId ? { "x-organization-id": orgId } : {},
      });
      const data = await res.json();
      if (res.ok && data.organization?.defaultCurrency) {
        setBaseCurrency(data.organization.defaultCurrency);
      }
    } catch {
      /* ignore */
    }
  }

  async function fetchExchangeRates() {
    if (!orgId) {
      setRatesLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/v1/exchange-rates", {
        headers: { "x-organization-id": orgId },
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.data)) throw new Error("Invalid rates response");
      for (const row of data.data as ExchangeRate[]) taxUiRate(row.rate, row.rateExact);
      setExchangeRates(data.data);
    } catch {
      setExchangeRates([]);
      toast.error(t("ratesFailed"));
    } finally {
      setRatesLoading(false);
    }
  }

  async function fetchCurrencies() {
    try {
      const res = await fetch("/api/currencies");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.currencies)) throw new Error("Invalid currencies response");
      setCurrencies(data.currencies);
    } catch {
      toast.error(t("currenciesFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function fetchFxReport() {
    if (!orgId) return;
    try {
      const res = await fetch("/api/v1/reports/unrealized-gains-losses", {
        headers: { "x-organization-id": orgId },
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Invalid FX response");
      const defaultCurrency = taxUiCurrency(data.defaultCurrency);
      const summary = { ...data.summary };
      for (const key of ["totalUnrealizedGain", "totalUnrealizedLoss", "netUnrealizedGainLoss"]) summary[key] = taxUiMinor(data.summary[key], data.summary[`${key}Minor`]);
      const items = data.items.map((item: Record<string, unknown>) => ({ ...item, currencyCode: taxUiCurrency(item.currencyCode), amountDue: taxUiMinor(item.amountDue, item.amountDueMinor),
        unrealizedGainLoss: item.unrealizedGainLoss === null && (item.unrealizedGainLossMinor === undefined || item.unrealizedGainLossMinor === null) ? null : taxUiMinor(item.unrealizedGainLoss, item.unrealizedGainLossMinor) }));
      setFxReport({ ...data, defaultCurrency, summary, items });
      setFxError(false);
    } catch {
      setFxReport(null);
      setFxError(true);
    }
  }

  useEffect(() => {
    fetchOrganization();
    fetchExchangeRates();
    fetchCurrencies();
    fetchFxReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return currencies;
    const q = search.toLowerCase();
    return currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        currencyLabel(c.code, presentation.locale, c.name).toLowerCase().includes(q) ||
        c.symbol.includes(q)
    );
  }, [currencies, search, presentation.locale]);

  const isLoading = loading || ratesLoading;

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
        />
        <BrandLoader className="h-48" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCurrencySheetOpen(true)}
        >
          <Plus className="me-1.5 size-3.5" />
          {t("addCurrency")}
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="me-1.5 size-3.5" />
          {t("addRate")}
        </Button>
      </PageHeader>

      {/* Base Currency Card */}
      {baseCurrency && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">
            {t("organizationCurrency")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            <BidiText>{currencyLabel(baseCurrency, presentation.locale)}</BidiText>
          </p>
          <p className="mt-1 text-[12px] text-emerald-600/60 dark:text-emerald-400/50">
            {t("baseHelp")}
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/20 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700/70 dark:text-blue-400/70">
            {t("exchangeRates")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
            {exchangeRates.length}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">
            {t("currencyPairs")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
            {new Set(
              exchangeRates.map((r) => `${r.baseCurrency}/${r.targetCurrency}`)
            ).size}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700/70 dark:text-amber-400/70">
            {t("isoCurrencies")}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {currencies.length}
          </p>
        </div>
      </div>

      {/* Unrealised FX Gains & Losses */}
      {fxReport && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-y-2 items-center gap-2">
            <ArrowRightLeft className="size-4 text-muted-foreground" />
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("fxTitle")}
            </h3>
            <span className="text-[11px] text-muted-foreground/70">
              {t.rich("fxEstimate", { currency: currencyLabel(fxReport.defaultCurrency, presentation.locale), em: (chunks) => <BidiText>{chunks}</BidiText> })}
            </span>
          </div>

          {fxReport.summary.totalItems === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
              {t("fxEmpty")}
            </div>
          ) : (
            <>
              {fxReport.summary.missingRateItems > 0 && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("missingRates", { count: fxReport.summary.missingRateItems })}
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("netUnrealized")}
                  </p>
                  <p
                    className={`mt-1 text-xl font-bold tabular-nums ${
                      fxReport.summary.netUnrealizedGainLoss >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    <BidiText>{taxUiMoney(
                      fxReport.summary.netUnrealizedGainLoss,
                      fxReport.defaultCurrency, presentation
                    )}</BidiText>
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("gains")}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    <BidiText>{taxUiMoney(
                      fxReport.summary.totalUnrealizedGain,
                      fxReport.defaultCurrency, presentation
                    )}</BidiText>
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("losses")}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    <BidiText>{taxUiMoney(
                      fxReport.summary.totalUnrealizedLoss,
                      fxReport.defaultCurrency, presentation
                    )}</BidiText>
                  </p>
                </div>
              </div>

              <div className="divide-y rounded-lg border bg-card">
                {fxReport.items.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex flex-wrap gap-y-2 items-center justify-between px-4 py-3"
                  >
                    <div className="flex flex-wrap gap-y-2 items-center gap-3">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {item.type === "invoice" ? t("invoice") : item.type === "bill" ? t("bill") : item.type}
                      </span>
                      <span className="font-mono text-sm font-medium">
                        <IdentifierText>{item.number}</IdentifierText>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t.rich("amountDue", { amount: taxUiMoney(item.amountDue, item.currencyCode, presentation), em: (chunks) => <BidiText>{chunks}</BidiText> })}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-sm tabular-nums ${
                        (item.unrealizedGainLoss ?? 0) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      <BidiText>{item.unrealizedGainLoss === null
                        ? "—"
                        : taxUiMoney(
                            item.unrealizedGainLoss,
                            fxReport.defaultCurrency, presentation
                          )}</BidiText>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {fxError && <p role="alert" className="text-sm text-destructive">{t("fxFailed")}</p>}

      {/* Exchange Rates Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-y-2 items-center gap-2">
          <ArrowRightLeft className="size-4 text-muted-foreground" />
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("exchangeRates")}
          </h3>
        </div>

        {exchangeRates.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title={t("noRates")}
            description={t("noRatesHelp")}
          />
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {exchangeRates.map((rate) => (
              <div
                key={rate.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap gap-y-2 items-center gap-3">
                  <div className="flex flex-wrap gap-y-2 items-center gap-1.5 font-mono text-sm font-semibold">
                    <span><BidiText>{currencyLabel(rate.baseCurrency, presentation.locale)}</BidiText></span>
                    <ArrowRightLeft className="size-3 text-muted-foreground" />
                    <span><BidiText>{currencyLabel(rate.targetCurrency, presentation.locale)}</BidiText></span>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    <IdentifierText>{taxUiRate(rate.rate, rate.rateExact)}</IdentifierText>
                  </span>
                </div>
                <div className="flex flex-wrap gap-y-2 items-center gap-2">
                  <div className="flex flex-wrap gap-y-2 items-center gap-1 text-[12px] text-muted-foreground">
                    <CalendarDays className="size-3" />
                    <span>
                      <IdentifierText>{new Date(rate.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}</IdentifierText>
                    </span>
                  </div>
                  <Badge
                    variant={rate.source === "manual" ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] uppercase",
                      rate.source === "manual"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}
                    title={
                      rate.source === "manual"
                        ? t("manualHelp")
                        : t("autoHelp")
                    }
                  >
                    {rate.source === "manual" ? t("manual") : t("auto")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Currency Reference Section (Collapsible) */}
      <Collapsible open={refOpen} onOpenChange={setRefOpen}>
        <div className="flex flex-wrap gap-y-2 items-center gap-2">
          <Coins className="size-4 text-muted-foreground" />
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("reference")}
          </h3>
          {currencies.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {currencies.length}
            </span>
          )}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="ms-auto h-7 px-2">
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  refOpen && "rotate-180"
                )}
              />
              <span className="ms-1 text-xs">
                {refOpen ? t("hide") : t("show")}
              </span>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-3 space-y-3">
          {currencies.length === 0 ? (
            <EmptyState
              icon={Coins}
              title={t("noCurrencies")}
              description={t("noCurrenciesHelp")}
            />
          ) : (
            <>
              <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label={t("filterPlaceholder")} dir="auto"
                  placeholder={t("filterPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-3 size-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {t.rich("noMatches", { query: search, em: (chunks) => <BidiText>{chunks}</BidiText> })}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground/70">
                    {t("trySearch")}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {filtered.map((c) => (
                      <div
                        key={c.id}
                        className="group relative rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex flex-wrap gap-y-2 items-start justify-between">
                          <span className="font-mono text-base font-bold tracking-wide">
                            <IdentifierText>{c.code}</IdentifierText>
                          </span>
                          {c.symbol && c.symbol !== c.code && (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              <IdentifierText>{c.symbol}</IdentifierText>
                            </span>
                          )}
                        </div>
                        <p className="mt-2 min-w-0 [overflow-wrap:anywhere] text-[13px] text-muted-foreground">
                          <BidiText>{currencyLabel(c.code, presentation.locale, c.name)}</BidiText>
                        </p>
                        {currencyLabel(c.code, presentation.locale, c.name) !== c.name &&
                          <p className="mt-1 min-w-0 [overflow-wrap:anywhere] text-xs text-muted-foreground"><BidiText>{c.name}</BidiText></p>}
                        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
                          {t("decimals", { count: c.decimalPlaces })}
                        </p>
                      </div>
                    ))}
                  </div>

                  {search && (
                    <p className="mt-4 text-[12px] text-muted-foreground">
                      {t("showing", { count: filtered.length, total: currencies.length })}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Add Rate Sheet */}
      <AddRateSheet
        open={sheetOpen}
        setOpen={setSheetOpen}
        onCreated={() => fetchExchangeRates()}
        orgId={orgId}
      />

      {/* Add Currency Sheet */}
      <AddCurrencySheet
        open={currencySheetOpen}
        setOpen={setCurrencySheetOpen}
        onCreated={() => fetchCurrencies()}
      />
    </div>
  );
}
