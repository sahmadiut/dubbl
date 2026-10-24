"use client";

import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { fixedAssetJson, fixedAssetFailureMessage, FixedAssetRequestError, fixedAssetStatusLabel, fixedAssetMethodLabel } from "@/i18n/fixed-asset-presentation";
import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Trash2,
  Undo2,
  PackageCheck,
  ChevronDown,
  CircleSlash,
  Hammer,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { assetMoneyDisplay as formatMoney, assetCentsInput, assetPercent } from "@/lib/money/asset-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import Link from "next/link";

interface DepEntry {
  id: string;
  date: string;
  amount: number;
  journalEntry: { id: string; entryNumber: number } | null;
}

interface RevaluationEntry {
  id: string;
  date: string;
  previousCarryingAmount: number;
  revaluedAmount: number;
  changeAmount: number;
  isImpairment: boolean;
  notes: string | null;
  journalEntry?: { id: string; entryNumber: number } | null;
}

interface CwipCostEntry {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  journalEntry?: { id: string; entryNumber: number } | null;
}

interface AssetDetail {
  id: string;
  name: string;
  description: string | null;
  assetNumber: string;
  purchaseDate: string;
  purchasePrice: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: string;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: string;
  isCwip?: boolean;
  disposalDate: string | null;
  disposalAmount: number | null;
  assetAccount: { code: string; name: string } | null;
  depreciationAccount: { code: string; name: string } | null;
  accumulatedDepAccount: { code: string; name: string } | null;
  depreciationEntries: DepEntry[];
  revaluations?: RevaluationEntry[];
}

const statusColors: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fully_depreciated: "border-amber-200 bg-amber-50 text-amber-700",
  disposed: "border-gray-200 bg-gray-50 text-gray-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
};

// Plain-language status labels: end users aren't accountants.
export default function FixedAssetDetailPage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("FixedAssets");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeAmount, setDisposeAmount] = useState("");
  const [disposeDate, setDisposeDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const today = new Date().toISOString().split("T")[0];
  // Revalue (new, higher value) dialog state.
  const [revalueOpen, setRevalueOpen] = useState(false);
  const [revalueAmount, setRevalueAmount] = useState("");
  const [revalueDate, setRevalueDate] = useState(today);
  const [revalueNotes, setRevalueNotes] = useState("");
  // Impair (write down value) dialog state.
  const [impairOpen, setImpairOpen] = useState(false);
  const [impairAmount, setImpairAmount] = useState("");
  const [impairDate, setImpairDate] = useState(today);
  const [impairNotes, setImpairNotes] = useState("");
  // Bring into use (capitalize) dialog state.
  const [capitalizeOpen, setCapitalizeOpen] = useState(false);
  const [capitalizeDate, setCapitalizeDate] = useState(today);
  // Add construction cost (CWIP) dialog state.
  const [costOpen, setCostOpen] = useState(false);
  const [costAmount, setCostAmount] = useState("");
  const [costDate, setCostDate] = useState(today);
  const [costDescription, setCostDescription] = useState("");
  const [costSourceAccountId, setCostSourceAccountId] = useState("");
  const [cwipCosts, setCwipCosts] = useState<CwipCostEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  useDocumentTitle(t("detailDocumentTitle"));

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setReadError(null);
    fetch(`/api/v1/fixed-assets/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => fixedAssetJson(r, t, t("readFailed"), "detail"))
      .then((data) => {
        if (!cancelled) setAsset(data.asset);
      })
      .catch((error) => { if (!cancelled) setReadError(fixedAssetFailureMessage(error, t, t("readFailed"))); })
      .finally(() => { if (!cancelled) setLoading(false); });
    // Construction costs are served by their own endpoint so the history is
    // reliable regardless of what the asset GET embeds.
    fetch(`/api/v1/fixed-assets/${id}/cwip-cost`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => fixedAssetJson(r, t, t("costReadFailed"), "costs"))
      .then((data) => { if (!cancelled) setCwipCosts(data.costs); })
      .catch((error) => { if (!cancelled) setReadError(fixedAssetFailureMessage(error, t, t("costReadFailed"))); });
    return () => { cancelled = true; };
  }, [id, orgId, t]);

  async function reloadAsset() {
    if (!orgId) return;
    const data = await fetch(`/api/v1/fixed-assets/${id}`, {
      headers: { "x-organization-id": orgId },
    }).then((r) => fixedAssetJson(r, t, t("readFailed"), "detail"));
    if (data.asset) setAsset(data.asset);
  }

  async function reloadCwipCosts() {
    if (!orgId) return;
    const data = await fetch(`/api/v1/fixed-assets/${id}/cwip-cost`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => fixedAssetJson(r, t, t("costReadFailed"), "costs"));
    setCwipCosts(data.costs ?? []);
  }

  async function handleDepreciate() {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}/depreciate`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });

      await fixedAssetJson(res, t, t("depreciateFailed"));
      toast.success(t("depreciated"));
      await reloadAsset();

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("depreciateFailed")));
    }
  }

  async function handleUndoDepreciation() {
    if (!orgId) return;
    const confirmed = await confirm({
      title: t("undoTitle"),
      description:
        t("undoDescription"),
      confirmLabel: t("undoConfirm"),
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/fixed-assets/${id}/rollback-depreciation`,
        { method: "POST", headers: { "x-organization-id": orgId, "content-type": "application/json" },
          body: JSON.stringify({ depreciationEntryId: asset?.depreciationEntries.at(-1)?.id }) }
      );

      await fixedAssetJson(res, t, t("undoFailed"));
      toast.success(t("undone"));
      await reloadAsset();

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("undoFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevalue() {
    if (!orgId) return;
    let amount: string;
    try { amount = assetCentsInput(revalueAmount || "0"); }
    catch (error) { toast.error(fixedAssetFailureMessage(error, t, t("amountInvalid"))); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}/revalue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          revaluedAmountMinor: amount,
          date: revalueDate,
          notes: revalueNotes || undefined,
        }),
      });

      await fixedAssetJson(res, t, t("revalueFailed"));
      setRevalueOpen(false);
      setRevalueAmount("");
      setRevalueNotes("");
      toast.success(t("revalued"));
      await reloadAsset();

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("revalueFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleImpair() {
    if (!orgId) return;
    let amount: string;
    try { amount = assetCentsInput(impairAmount || "0"); }
    catch (error) { toast.error(fixedAssetFailureMessage(error, t, t("amountInvalid"))); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}/impair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          revaluedAmountMinor: amount,
          date: impairDate,
          notes: impairNotes || undefined,
        }),
      });

      await fixedAssetJson(res, t, t("impairFailed"));
      setImpairOpen(false);
      setImpairAmount("");
      setImpairNotes("");
      toast.success(t("impaired"));
      await reloadAsset();

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("impairFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleCapitalize() {
    if (!orgId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}/capitalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ date: capitalizeDate }),
      });

      await fixedAssetJson(res, t, t("capitalizeFailed"));
      setCapitalizeOpen(false);
      toast.success(t("capitalized"));
      await reloadAsset();
      await reloadCwipCosts();

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("capitalizeFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCost() {
    if (!orgId) return;
    let amountMinor: string;
    try {
      amountMinor = assetCentsInput(costAmount);
      if (amountMinor === "0") throw new FixedAssetRequestError(t("positiveAmount"));
    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("costInvalid")));
      return;
    }
    if (!costSourceAccountId) {
      toast.error(t("sourceRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}/cwip-cost`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          amountMinor,
          date: costDate,
          description: costDescription || undefined,
          sourceAccountId: costSourceAccountId,
        }),
      });

      await fixedAssetJson(res, t, t("costFailed"));
      setCostOpen(false);
      setCostAmount("");
      setCostDescription("");
      setCostSourceAccountId("");
      toast.success(t("costAdded"));
      await reloadAsset();
      await reloadCwipCosts();

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("costFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleDispose() {
    if (!orgId) return;
    let amount: string;
    try { amount = assetCentsInput(disposeAmount || "0"); }
    catch (error) { toast.error(fixedAssetFailureMessage(error, t, t("amountInvalid"))); return; }

    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}/dispose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ disposalAmountMinor: amount, date: disposeDate }),
      });


      const data = await fixedAssetJson(res, t, t("disposeFailed"), "asset");
      setAsset((prev) => (prev ? { ...prev, ...data.asset, depreciationEntries: prev.depreciationEntries } : prev));
      setDisposeOpen(false);
      toast.success(t("disposedSuccess"));

    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("disposeFailed")));
    }
  }

  async function handleDelete() {
    if (!orgId) return;
    const confirmed = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/fixed-assets/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await fixedAssetJson(res, t, t("deleteFailed"));
      toast.success(t("deleted"));
      router.push("/accounting/fixed-assets");
    } catch (error) {
      toast.error(fixedAssetFailureMessage(error, t, t("deleteFailed")));
    }
  }

  if (readError) return <p role="alert" className="text-sm text-destructive">{readError}</p>;

  if (loading)
    return (
      <div className="space-y-6">
        <PageHeader title={t("loading")} />
      </div>
    );
  if (!asset)
    return (
      <div className="space-y-6">
        <PageHeader title={t("notFound")} />
      </div>
    );

  const depPercent =
    asset.purchasePrice > 0
      ? Math.round(
          assetPercent(asset.accumulatedDepreciation, asset.purchasePrice)
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${asset.assetNumber} - ${asset.name}`}
        description={asset.description || undefined}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/accounting/fixed-assets">
            <ArrowLeft className="mr-2 size-4" />
            {t("back")}
          </Link>
        </Button>
        {(asset.isCwip || asset.status === "in_progress") &&
          asset.status !== "disposed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCostOpen(true)}
                title={t("costHint")}
              >
                <Hammer className="mr-2 size-4" />
                {t("addConstructionCost")}
              </Button>
              <Button
                size="sm"
                onClick={() => setCapitalizeOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
                title={t("capitalizeHint")}
              >
                <PackageCheck className="mr-2 size-4" />
                {t("capitalize")}
              </Button>
            </>
          )}
        {asset.status === "active" && (
          <>
            <Button
              size="sm"
              onClick={handleDepreciate}
              className="bg-emerald-600 hover:bg-emerald-700"
              title={t("depreciateHint")}
            >
              <TrendingDown className="mr-2 size-4" />
              {t("depreciate")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("moreActions")}
                  <ChevronDown className="ml-1.5 size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem
                  onClick={() => setRevalueOpen(true)}
                  title={t("revalueHint")}
                >
                  <TrendingUp className="mr-2 size-4" />
                  {t("revalue")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setImpairOpen(true)}
                  title={t("impairHint")}
                >
                  <CircleSlash className="mr-2 size-4" />
                  {t("impair")}
                </DropdownMenuItem>
                {asset.depreciationEntries.length > 0 && (
                  <DropdownMenuItem
                    onClick={handleUndoDepreciation}
                    title={t("undoHint")}
                  >
                    <Undo2 className="mr-2 size-4" />
                    {t("undo")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDisposeOpen(true)}
                  className="text-red-600"
                  title={t("disposeHint")}
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("dispose")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {asset.status !== "disposed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-red-600"
            title={t("deleteHint")}
          >
            {t("delete")}
          </Button>
        )}
      </PageHeader>

      {/* Record as sold or written off */}
      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dispose")}</DialogTitle>
            <DialogDescription>
              {t("disposeDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("disposalAmount")}</Label>
              <CurrencyInput
                prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                value={disposeAmount}
                onChange={setDisposeAmount}
              />
              <p className="text-xs text-muted-foreground">
                {t("disposalZero")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("disposalDate")}</Label>
              <Input
                type="date"
                value={disposeDate}
                onChange={(e) => setDisposeDate(e.target.value)}
              />
            </div>
            <Button
              onClick={handleDispose}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {t("dispose")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record a higher value */}
      <Dialog open={revalueOpen} onOpenChange={setRevalueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revalue")}</DialogTitle>
            <DialogDescription>
              {t("revalueDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("higherValue")}</Label>
              <CurrencyInput
                prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                value={revalueAmount}
                onChange={setRevalueAmount}
              />
              <p className="text-xs text-muted-foreground">
                {t("currentAmount", { amount: formatMoney(asset.netBookValue, unitPresentation) })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={revalueDate}
                onChange={(e) => setRevalueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notesOptional")}</Label>
              <Textarea
                value={revalueNotes}
                onChange={(e) => setRevalueNotes(e.target.value)}
                placeholder={t("revalueNotes")}
              />
            </div>
            <Button
              onClick={handleRevalue}
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {t("saveHigher")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Write down to a lower value */}
      <Dialog open={impairOpen} onOpenChange={setImpairOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("impair")}</DialogTitle>
            <DialogDescription>
              {t("impairDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("lowerValue")}</Label>
              <CurrencyInput
                prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                value={impairAmount}
                onChange={setImpairAmount}
              />
              <p className="text-xs text-muted-foreground">
                {t("currentAmount", { amount: formatMoney(asset.netBookValue, unitPresentation) })}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={impairDate}
                onChange={(e) => setImpairDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notesOptional")}</Label>
              <Textarea
                value={impairNotes}
                onChange={(e) => setImpairNotes(e.target.value)}
                placeholder={t("impairNotes")}
              />
            </div>
            <Button
              onClick={handleImpair}
              disabled={busy}
              className="w-full"
            >
              {t("saveLower")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bring into use (capitalize) */}
      <Dialog open={capitalizeOpen} onOpenChange={setCapitalizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("capitalize")}</DialogTitle>
            <DialogDescription>
              {t("capitalizeDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("inServiceDate")}</Label>
              <Input
                type="date"
                value={capitalizeDate}
                onChange={(e) => setCapitalizeDate(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCapitalize}
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {t("capitalize")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add construction cost (CWIP) */}
      <Dialog open={costOpen} onOpenChange={setCostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addConstructionCost")}</DialogTitle>
            <DialogDescription>
              {t("costDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("amount")}</Label>
              <CurrencyInput
                prefix={currencyLabel("USD", unitPresentation.locale, "$")}
                value={costAmount}
                onChange={setCostAmount}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={costDate}
                onChange={(e) => setCostDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sourceAccount")}</Label>
              <AccountPicker
                value={costSourceAccountId}
                onChange={setCostSourceAccountId}
                placeholder={t("sourcePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("sourceHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("purposeOptional")}</Label>
              <Textarea
                value={costDescription}
                onChange={(e) => setCostDescription(e.target.value)}
                placeholder={t("purposeExample")}
              />
            </div>
            <Button
              onClick={handleAddCost}
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {t("addCost")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge
          variant="outline"
          className={statusColors[asset.status] || ""}
        >
          {fixedAssetStatusLabel(t, asset.status)}
        </Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("lifeSummary", { method: fixedAssetMethodLabel(t, asset.depreciationMethod), count: asset.usefulLifeMonths })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("purchasePrice")}</p>
          <p className="text-xl font-bold font-mono">
            {formatMoney(asset.purchasePrice, unitPresentation)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">
            {t("usedSoFar")}
          </p>
          <p className="text-xl font-bold font-mono text-amber-600">
            {formatMoney(asset.accumulatedDepreciation, unitPresentation)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{depPercent}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">{t("currentValue")}</p>
          <p className="text-xl font-bold font-mono text-emerald-600">
            {formatMoney(asset.netBookValue, unitPresentation)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">
            {t("residualValue")}
          </p>
          <p className="text-xl font-bold font-mono">
            {formatMoney(asset.residualValue, unitPresentation)}
          </p>
        </div>
      </div>

      {/* Bookkeeping accounts */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold mb-3">{t("books")}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {t("booksDescription")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("assetAccountHint")}</p>
            <p>
              {asset.assetAccount
                ? `${asset.assetAccount.code} - ${asset.assetAccount.name}`
                : t("notSet")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("expenseAccountHint")}
            </p>
            <p>
              {asset.depreciationAccount
                ? `${asset.depreciationAccount.code} - ${asset.depreciationAccount.name}`
                : t("notSet")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("accumulatedAccountHint")}
            </p>
            <p>
              {asset.accumulatedDepAccount
                ? `${asset.accumulatedDepAccount.code} - ${asset.accumulatedDepAccount.name}`
                : t("notSet")}
            </p>
          </div>
        </div>
      </div>

      {/* Sale / write-off info */}
      {asset.status === "disposed" && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold mb-2">
            {t("disposalDetails")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("disposedDate")}
              </p>
              <p>{asset.disposalDate || t("unavailable")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("disposalAmount")}</p>
              <p className="font-mono">
                {asset.disposalAmount !== null
                  ? formatMoney(asset.disposalAmount, unitPresentation)
                  : t("unavailable")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Value drop history */}
      <div className="rounded-lg border">
        <div className="border-b bg-muted/50 px-4 py-3">
          <h3 className="text-sm font-semibold">{t("depreciationHistory")}</h3>
        </div>
        {asset.depreciationEntries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("noDepreciation")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[360px] grid-cols-[1fr_120px_120px] gap-2 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>{t("date")}</span>
              <span className="text-right">{t("amount")}</span>
              <span className="text-right">{t("journalEntry")}</span>
            </div>
            {asset.depreciationEntries.map((entry) => (
              <div
                key={entry.id}
                className="grid min-w-[360px] grid-cols-[1fr_120px_120px] gap-2 border-b px-4 py-2 last:border-b-0"
              >
                <span className="text-sm">{entry.date}</span>
                <span className="text-right text-sm font-mono">
                  {formatMoney(entry.amount, unitPresentation)}
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  {entry.journalEntry
                    ? `#${entry.journalEntry.entryNumber}`
                    : "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Construction costs (CWIP) */}
      {(asset.isCwip ||
        asset.status === "in_progress" ||
        cwipCosts.length > 0) && (
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
            <h3 className="text-sm font-semibold">{t("constructionCosts")}</h3>
            {cwipCosts.length > 0 && (
              <span className="text-sm font-mono text-muted-foreground">
                {t("totalAmount", { amount: formatMoney(cwipCosts.reduce((s, c) => s + BigInt(c.amount), 0n), unitPresentation) })}
              </span>
            )}
          </div>
          {cwipCosts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noCosts")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[480px] grid-cols-[120px_1fr_120px_120px] gap-2 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>{t("date")}</span>
                <span>{t("purpose")}</span>
                <span className="text-right">{t("amount")}</span>
                <span className="text-right">{t("journalEntry")}</span>
              </div>
              {cwipCosts.map((cost) => (
                <div
                  key={cost.id}
                  className="grid min-w-[480px] grid-cols-[120px_1fr_120px_120px] gap-2 border-b px-4 py-2 last:border-b-0"
                >
                  <span className="text-sm">{cost.date}</span>
                  <span className="text-sm text-muted-foreground">
                    {cost.description || "-"}
                  </span>
                  <span className="text-right text-sm font-mono">
                    {formatMoney(cost.amount, unitPresentation)}
                  </span>
                  <span className="text-right text-sm text-muted-foreground">
                    {cost.journalEntry
                      ? `#${cost.journalEntry.entryNumber}`
                      : "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Value changes (revaluations / write-downs) */}
      {asset.revaluations && asset.revaluations.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b bg-muted/50 px-4 py-3">
            <h3 className="text-sm font-semibold">{t("valueHistory")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("valueHistoryHint")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-[110px_1fr_130px_130px_110px] gap-2 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>{t("date")}</span>
              <span>{t("type")}</span>
              <span className="text-right">{t("newValue")}</span>
              <span className="text-right">{t("change")}</span>
              <span className="text-right">{t("entry")}</span>
            </div>
            {asset.revaluations.map((rev) => (
              <div
                key={rev.id}
                className="grid min-w-[560px] grid-cols-[110px_1fr_130px_130px_110px] gap-2 border-b px-4 py-2 last:border-b-0"
              >
                <span className="text-sm">{rev.date}</span>
                <span className="text-sm">
                  {rev.isImpairment ? (
                    <span className="inline-flex items-center text-amber-700">
                      <CircleSlash className="mr-1.5 size-3.5" />
                      {t("writtenDown")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-emerald-700">
                      <TrendingUp className="mr-1.5 size-3.5" />
                      {t("higher")}
                    </span>
                  )}
                  {rev.notes && (
                    <span className="block text-xs text-muted-foreground">
                      {rev.notes}
                    </span>
                  )}
                </span>
                <span className="text-right text-sm font-mono">
                  {formatMoney(rev.revaluedAmount, unitPresentation)}
                </span>
                <span
                  className={`text-right text-sm font-mono ${
                    rev.changeAmount < 0
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {rev.changeAmount < 0 ? "-" : "+"}
                  {formatMoney(BigInt(rev.changeAmount) < 0n ? -BigInt(rev.changeAmount) : BigInt(rev.changeAmount), unitPresentation)}
                </span>
                <span className="text-right text-sm text-muted-foreground">
                  {rev.journalEntry
                    ? `#${rev.journalEntry.entryNumber}`
                    : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
