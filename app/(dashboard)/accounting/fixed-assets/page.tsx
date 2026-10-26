"use client";

import { bankMoneyDisplay as exampleMoney } from "@/lib/money/bank-display";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation } from "@/i18n/provider";
import { localeDirection } from "@/i18n/locale";
import type { NumberPresentation } from "@/i18n/numbers";
import { fixedAssetJson, fixedAssetFailureMessage, fixedAssetStatusLabel, fixedAssetMethodLabel } from "@/i18n/fixed-asset-presentation";
import { useTranslations } from "next-intl";

import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Plus, Play, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assetMoneyDisplay as formatMoney, assetPercent } from "@/lib/money/asset-display";
import { devDelay } from "@/lib/dev-delay";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

interface FixedAsset {
  id: string;
  name: string;
  assetNumber: string;
  purchaseDate: string;
  purchasePrice: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  depreciationMethod: string;
  status: string;
}

const statusColors: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  fully_depreciated:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  disposed:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DepreciationBar({
  cost,
  nbv,
  className,
}: {
  cost: number;
  nbv: number;
  className?: string;
}) {
  if (cost === 0) return null;
  const depPct = assetPercent(BigInt(cost) - BigInt(nbv), cost);
  const nbvPct = 100 - depPct;
  return (
    <div
      className={cn(
        "h-1.5 w-full rounded-full overflow-hidden flex bg-muted",
        className
      )}
    >
      <div
        className="bg-emerald-500 h-full transition-all"
        style={{ width: `${nbvPct}%` }}
      />
      <div
        className={cn("h-full transition-all", depPct >= 100 ? "bg-red-500" : "bg-amber-400")}
        style={{ width: `${depPct}%` }}
      />
    </div>
  );
}

function buildColumns(t: ReturnType<typeof useTranslations<"FixedAssets">>, unitPresentation: NumberPresentation = { locale: "en-US", numerals: "latn" }): Column<FixedAsset>[] {
  return [
    {
      key: "assetNumber",
      header: t("assetNumber"),
      className: "w-28",
      render: (r) => (
        <span className="font-mono text-sm"><IdentifierText>{r.assetNumber}</IdentifierText></span>
      ),
    },
    {
      key: "name",
      header: t("name"),
      render: (r) => (
        <span className="text-sm font-medium"><BidiText>{r.name}</BidiText></span>
      ),
    },
    {
      key: "purchaseDate",
      header: t("purchased"),
      className: "w-32",
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          <IdentifierText>{formatDate(r.purchaseDate)}</IdentifierText>
        </span>
      ),
    },
    {
      key: "depreciationMethod",
      header: t("methodHint"),
      className: "w-32",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          <BidiText>{fixedAssetMethodLabel(t, r.depreciationMethod)}</BidiText>
        </span>
      ),
    },
    {
      key: "purchasePrice",
      header: t("purchasePrice"),
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          <IdentifierText>{formatMoney(r.purchasePrice, unitPresentation)}</IdentifierText>
        </span>
      ),
    },
    {
      key: "depreciation",
      header: t("usedValue"),
      className: "w-36",
      render: (r) => {
        const pct =
          r.purchasePrice > 0
            ? Math.round(
                assetPercent(BigInt(r.purchasePrice) - BigInt(r.netBookValue), r.purchasePrice)
              )
            : 0;
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono tabular-nums text-muted-foreground">
                <IdentifierText>{pct}%</IdentifierText>
              </span>
              <span className="font-mono tabular-nums text-red-500">
                <IdentifierText>-{formatMoney(r.accumulatedDepreciation, unitPresentation)}</IdentifierText>
              </span>
            </div>
            <DepreciationBar cost={r.purchasePrice} nbv={r.netBookValue} />
          </div>
        );
      },
    },
    {
      key: "netBookValue",
      header: t("currentValue"),
      className: "w-28 text-end",
      render: (r) => (
        <span className="font-mono text-sm tabular-nums">
          <IdentifierText>{formatMoney(r.netBookValue, unitPresentation)}</IdentifierText>
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      className: "w-36",
      render: (r) => (
        <Badge variant="outline" className={statusColors[r.status] || ""}>
          <BidiText>{fixedAssetStatusLabel(t, r.status)}</BidiText>
        </Badge>
      ),
    },
  ];
}

export default function FixedAssetsPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("FixedAssets");
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [allAssets, setAllAssets] = useState<FixedAsset[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [runningDepreciation, setRunningDepreciation] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  useDocumentTitle(t("documentTitle"));

  const columns = useMemo(() => buildColumns(t, unitPresentation), [t, unitPresentation]);

  // Fetch all assets (for counts) on mount
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;

    fetch(`/api/v1/fixed-assets`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => fixedAssetJson(r, t, t("readFailed"), "data"))
      .then((data) => {
        if (!cancelled) setAllAssets(data.data);
      })
      .catch((error) => { if (!cancelled) setReadError(fixedAssetFailureMessage(error, t, t("readFailed"))); });
    return () => { cancelled = true; };
  }, [t]);

  // Fetch filtered assets
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let cancelled = false;

    setRefetching(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/v1/fixed-assets?${params}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => fixedAssetJson(r, t, t("readFailed"), "data"))
      .then((data) => {
        if (cancelled) return;
        setReadError(null);
        if (data.data) {
          setAssets(data.data);
          // Keep allAssets in sync when fetching "all"
          if (statusFilter === "all") setAllAssets(data.data);
        }
      })
      .then(() => devDelay())
      .catch((error) => { if (!cancelled) setReadError(fixedAssetFailureMessage(error, t, t("readFailed"))); })
      .finally(() => {
        if (!cancelled) {
          setInitialLoad(false);
          setRefetching(false);
          setFetchKey((k) => k + 1);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, t]);

  async function handleRunDepreciation() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setRunningDepreciation(true);
    try {
      const res = await fetch("/api/v1/fixed-assets/run-depreciation", {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      const data = await fixedAssetJson(res, t, t("runFailed"));

      if (!Number.isSafeInteger(data.processed) || data.processed < 0) throw new Error("Invalid processed count");
      toast.success(
        t("runSuccess", { count: data.processed })
      );
      window.location.reload();
    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("runFailed")));
    } finally {
      setRunningDepreciation(false);
    }
  }

  // Client-side search filter
  const filteredAssets = useMemo(() => {
    if (!debouncedSearch) return assets;
    const q = debouncedSearch.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.assetNumber.toLowerCase().includes(q)
    );
  }, [assets, debouncedSearch]);

  const [searchKey, setSearchKey] = useState(0);
  useEffect(() => {
    setSearchKey((k) => k + 1);
  }, [debouncedSearch]);

  // Stats from all assets (not filtered)
  const totalCost = allAssets.reduce((sum, a) => sum + BigInt(a.purchasePrice), 0n);
  const totalNBV = allAssets.reduce((sum, a) => sum + BigInt(a.netBookValue), 0n);
  const totalAccDep = allAssets.reduce(
    (sum, a) => sum + BigInt(a.accumulatedDepreciation),
    0n
  );
  const nbvPct = Math.round(assetPercent(totalNBV, totalCost));
  const depPct = Math.round(assetPercent(totalAccDep, totalCost));

  // Tab counts from all assets
  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      all: allAssets.length,
      active: 0,
      fully_depreciated: 0,
      disposed: 0,
    };
    for (const a of allAssets) {
      if (counts[a.status] !== undefined) counts[a.status]++;
    }
    return counts;
  }, [allAssets]);

  const pendingSearch = search !== debouncedSearch;

  if (readError) return <p role="alert" className="text-sm text-destructive">{readError}</p>;

  if (initialLoad) return <BrandLoader />;

  // Empty state
  if (
    !initialLoad &&
    !refetching &&
    allAssets.length === 0 &&
    statusFilter === "all"
  ) {
    return (
      <ContentReveal>
        <div className="flex flex-col items-center gap-10 pt-16 pb-12">
          {/* Asset lifecycle stepper */}
          <div className="w-full max-w-xl">
            <div className="relative grid grid-cols-3 gap-0">
              <div className="absolute inset-x-[16.6667%] top-4 h-px bg-border" />
              {[
                {
                  step: "1",
                  label: t("addAssets"),
                  sub: t("addAssetsHint"),
                  color: "bg-blue-500",
                  ring: "ring-blue-200 dark:ring-blue-900",
                },
                {
                  step: "2",
                  label: t("spreadCost"),
                  sub: t("spreadCostHint"),
                  color: "bg-amber-500",
                  ring: "ring-amber-200 dark:ring-amber-900",
                },
                {
                  step: "3",
                  label: t("trackValue"),
                  sub: t("trackValueHint"),
                  color: "bg-emerald-500",
                  ring: "ring-emerald-200 dark:ring-emerald-900",
                },
              ].map(({ step, label, sub, color, ring }) => (
                <div
                  key={step}
                  className="flex flex-col items-center text-center relative"
                >
                  <div
                    className={`relative z-10 flex size-8 items-center justify-center rounded-full ${color} ring-4 ${ring} text-white text-xs font-bold`}
                  >
                    {step}
                  </div>
                  <p className="mt-3 text-sm font-medium">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[150px] leading-relaxed">
                    {sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("emptyTitle")}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
            <Button type="button"
              onClick={() => openDrawer("fixedAsset")}
              size="lg"
              className="h-auto min-h-8 whitespace-normal mt-5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="me-2 size-4" />
              {t("addItem")}
            </Button>
          </div>

          {/* Preview stat cards (empty) */}
          <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-3 gap-3 opacity-40">
            {[
              { label: t("totalCost"), value: exampleMoney(0n, "USD", unitPresentation) },
              { label: t("currentValue"), value: exampleMoney(0n, "USD", unitPresentation) },
              { label: t("usedValue"), value: exampleMoney(0n, "USD", unitPresentation) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-dashed p-3 text-center"
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-sm font-mono font-medium text-muted-foreground">
                  <IdentifierText>{value}</IdentifierText>
                </p>
              </div>
            ))}
          </div>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="min-w-0 space-y-6">
      {/* Inline stats + depreciation bar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid min-w-0 grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {t("totalCost")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                <IdentifierText>{formatMoney(totalCost, unitPresentation)}</IdentifierText>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {t("currentValue")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                <IdentifierText>{formatMoney(totalNBV, unitPresentation)}</IdentifierText>
                <span className="ms-1.5 text-xs font-normal text-muted-foreground">
                  <IdentifierText>{nbvPct}%</IdentifierText>
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {t("usedValue")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-red-500">
                <IdentifierText>-{formatMoney(totalAccDep, unitPresentation)}</IdentifierText>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {t("items")}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {allAssets.length}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button className="h-auto min-h-8 whitespace-normal" type="button"
              size="sm"
              variant="outline"
              onClick={handleRunDepreciation}
              disabled={runningDepreciation}
              title={t("runHint")}
            >
              <Play className="me-2 size-4" />
              {runningDepreciation ? t("recording") : t("run")}
            </Button>
            <Button type="button"
              size="sm"
              onClick={() => openDrawer("fixedAsset")}
              className="h-auto min-h-8 whitespace-normal bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="me-2 size-4" />
              {t("addItem")}
            </Button>
          </div>
        </div>

        {/* Overall depreciation progress bar */}
        {totalCost > 0 && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("usedSoFar")}
              </p>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                {t("usedPercent", { percent: depPct })}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-muted">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${nbvPct}%` }}
              />
              <div
                className={cn(
                  "h-full transition-all",
                  depPct >= 100 ? "bg-red-500" : "bg-amber-400"
                )}
                style={{ width: `${depPct}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">
                  {t.rich("currentSummary", { amount: formatMoney(totalNBV, unitPresentation), em: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-block size-2 rounded-full",
                    depPct >= 100 ? "bg-red-500" : "bg-amber-400"
                  )}
                />
                <span className="text-muted-foreground">
                  {t.rich("usedSummary", { amount: formatMoney(totalAccDep, unitPresentation), em: (chunks) => <IdentifierText>{chunks}</IdentifierText> })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Table section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs dir={localeDirection(unitPresentation.locale)} className="min-w-0 max-w-full" value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="all" className="whitespace-nowrap">
                {t("all")}{" "}
                <span className="ms-1 text-muted-foreground">
                  {countByStatus.all}
                </span>
              </TabsTrigger>
              <TabsTrigger value="active" className="whitespace-nowrap">
                {t("active")}{" "}
                <span className="ms-1 text-muted-foreground">
                  {countByStatus.active}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="fully_depreciated"
                className="whitespace-nowrap"
              >
                {t("fullyDepreciated")}{" "}
                <span className="ms-1 text-muted-foreground">
                  {countByStatus.fully_depreciated}
                </span>
              </TabsTrigger>
              <TabsTrigger value="disposed" className="whitespace-nowrap">
                {t("disposed")}{" "}
                <span className="ms-1 text-muted-foreground">
                  {countByStatus.disposed}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 sm:w-64">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              aria-label={t("search")}
              dir="auto"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full ps-8 text-xs"
            />
          </div>
          {search && (
            <Button type="button"
              variant="ghost"
              size="sm"
              className="h-auto min-h-8 whitespace-normal text-xs text-muted-foreground"
              onClick={() => {
                setSearch("");
              }}
            >
              <X className="me-1 size-3" />
              {t("clear")}
            </Button>
          )}
        </div>

        {refetching || pendingSearch ? (
          <BrandLoader className="h-48" />
        ) : (
          <ContentReveal key={`${fetchKey}-${searchKey}`}>
            <DataTable
              columns={columns}
              data={filteredAssets}
              loading={false}
              emptyMessage={t("noMatches")}
              onRowClick={(r) =>
                router.push(`/accounting/fixed-assets/${r.id}`)
              }
            />
          </ContentReveal>
        )}

        {!refetching && !pendingSearch && filteredAssets.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground">
              {debouncedSearch ? t.rich("showingMatching", { count: filteredAssets.length, query: debouncedSearch, em: (chunks) => <BidiText>{chunks}</BidiText> }) : t("showing", { count: filteredAssets.length })}
            </p>
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
