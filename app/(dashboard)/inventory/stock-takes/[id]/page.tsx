"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";

import { movementStockJson, movementStockLine, movementJson, movementAppliedJson } from "@/i18n/inventory-movement-presentation";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  Play,
  CheckCircle,
  Trash2,
  XCircle,
  Loader2,
  EyeOff,
  Search,
  Minus,
  Plus,
  Check,
  ChevronsUp,
  X,
  ArrowUpDown,
} from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";
import { catalogWholeInput } from "@/lib/money/catalog-input";

type SortKey = "name" | "code" | "expected" | "counted" | "discrepancy";

const SORT_OPTIONS: { value: SortKey; label: keyof typeof import("@/messages/en-US.json").InventoryMovements }[] = [
  { value: "name", label: "name" },
  { value: "code", label: "code" },
  { value: "expected", label: "expectedQty" },
  { value: "counted", label: "countedQty" },
  { value: "discrepancy", label: "discrepancy" },
];

interface StockTakeLine {
  id: string;
  inventoryItem: { id: string; name: string; code: string };
  expectedQuantity: number;
  countedQuantity: number | null;
  discrepancy: number | null;
  adjusted: boolean | null;
}

interface StockTakeDetail {
  id: string;
  name: string;
  notes: string | null;
  status: "draft" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  warehouse?: { id: string; name: string; code: string } | null;
  lines: StockTakeLine[];
}

type LineFilter = "all" | "uncounted" | "matched" | "discrepancies";

const STATUS_CONFIG: Record<
  StockTakeDetail["status"],
  { label: keyof typeof import("@/messages/en-US.json").InventoryMovements; className: string }
> = {
  draft: {
    label: "draft",
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  },
  in_progress: {
    label: "inProgress",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  completed: {
    label: "completed",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  cancelled: {
    label: "cancelled",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Isolated counter cell - manages its own editing state for smooth transitions */
function CounterCell({
  line,
  isSaving,
  onUpdate,
}: {
  line: StockTakeLine;
  isSaving: boolean;
  onUpdate: (lineId: string, qty: number) => void;
}) {
  const t = useTranslations("InventoryMovements");
  const isUncounted = line.countedQuantity === null;
  // Local editing state - only active while user is typing
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const displayValue = editing
    ? editValue
    : line.countedQuantity !== null
      ? String(line.countedQuantity)
      : "";

  function handleFocus() {
    setEditing(true);
    setEditValue(line.countedQuantity !== null ? String(line.countedQuantity) : "");
  }

  function handleBlur() {
    setEditing(false);
    if (editValue === "") return;
    let num: number | undefined;
    try { num = catalogWholeInput(editValue, false); } catch { toast.error(t("invalidCount")); return; }
    if (num === undefined) return;
    if (num !== line.countedQuantity) {
      onUpdate(line.id, num);
    }
  }

  return (
    <div dir="ltr" className="flex items-center justify-end">
      {/* Left button: Match (✓) when uncounted, Minus (-) when counting */}
      <button
        className={cn(
          "flex size-7 items-center justify-center rounded-l-md border border-r-0 transition-colors disabled:opacity-40 disabled:pointer-events-none",
          isUncounted
            ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}
        disabled={isSaving}
        title={isUncounted ? t("matchExpected") : t("decrease")}
        onClick={() => {
          if (isUncounted) {
            onUpdate(line.id, line.expectedQuantity);
          } else {
            const next = Math.max(0, (line.countedQuantity ?? 0) - 1);
            onUpdate(line.id, next);
          }
        }}
      >
        {isUncounted ? <Check className="size-3" /> : <Minus className="size-3" />}
      </button>

      {/* Value display */}
      <div className="flex h-7 items-center justify-center border-y w-16 bg-background">
        {isSaving ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : (
          <input
            type="text"
            aria-label={t("countInput")}
            inputMode="numeric"
            pattern="[0-9]*"
            value={displayValue}
            placeholder="-"
            className="w-full h-full text-center text-sm font-mono tabular-nums bg-transparent outline-none"
            onFocus={handleFocus}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setEditValue(raw);
            }}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
           dir="ltr" />
        )}
      </div>

      {/* Plus button */}
      <button
        className="flex size-7 items-center justify-center rounded-r-md border border-l-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        disabled={isSaving}
        title={t("increase")}
        onClick={() => {
          const next = isUncounted ? 0 : (line.countedQuantity ?? 0) + 1;
          onUpdate(line.id, next);
        }}
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

export default function StockTakeDetailPage() {
  const t = useTranslations("InventoryMovements");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [stockTake, setStockTake] = useState<StockTakeDetail | null>(null);
  const [readError, setReadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [blindMode, setBlindMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 150);
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [savingLines, setSavingLines] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { confirm, dialog: confirmDialog } = useConfirm();
  useDocumentTitle(t("stockDetailTitle"));

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReadError(false);
    if (!orgId) { setReadError(true); setLoading(false); return; }
    fetch(`/api/v1/stock-takes/${id}`, { headers: { "x-organization-id": orgId } })
      .then(movementStockJson)
      .then((row) => { if (active) setStockTake(row); })
      .catch(() => { if (active) setReadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, orgId]);

  async function handleStartCount() {
    if (!orgId) { toast.error(t("organizationRequired")); return false; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/stock-takes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!res.ok) throw new Error(t("startFailed"));
      setStockTake(await movementStockJson(res));
      toast.success(t("started"));
    } catch {
      toast.error(t("startFailed"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApplyAdjustments() {
    if (!orgId) { toast.error(t("organizationRequired")); return false; }
    const confirmed = await confirm({
      title: t("finalizeTitle"),
      description:
        t("finalizeHelp"),
      confirmLabel: t("finalize"),
      cancelLabel: t("cancel"),
      destructive: false,
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/stock-takes/${id}/apply`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      const data = await movementAppliedJson(res);
      // The posting response is already a complete, validated detail. A failed
      // follow-up read must not turn a successful post into a failed action.
      let fresh = data.stockTake;
      try {
        fresh = await movementStockJson(await fetch(`/api/v1/stock-takes/${id}`, {
          headers: { "x-organization-id": orgId },
        }));
      } catch { /* Retain the verified posting result. */ }
      setStockTake(fresh);
      toast.success(data.adjustedCount > 0
        ? t("adjustmentPosted", { count: data.adjustedCount }) : t("finalized"));
    } catch {
      toast.error(t("postFailed"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!orgId) { toast.error(t("organizationRequired")); return false; }
    const confirmed = await confirm({
      title: t("cancelStockTitle"),
      description: t("cancelStockHelp"),
      confirmLabel: t("cancelStock"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/stock-takes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Stock take cancellation failed");
      setStockTake(await movementStockJson(res));
      toast.success(t("stockCancelled"));
    } catch {
      toast.error(t("cancelStockFailed"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!orgId) { toast.error(t("organizationRequired")); return false; }
    const confirmed = await confirm({
      title: t("deleteStockTitle"),
      description: t("cannotUndo"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/stock-takes/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if ((await movementJson(res)).success !== true) throw new Error("Invalid delete response");
      toast.success(t("stockDeleted"));
      router.push("/inventory/stock-takes");
    } catch {
      toast.error(t("deleteStockFailed"));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateLine(lineId: string, countedQuantity: number) {
    if (!orgId) { toast.error(t("organizationRequired")); return false; }

    setSavingLines((prev) => new Set(prev).add(lineId));

    // Optimistic update
    setStockTake((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lines: prev.lines.map((line) =>
          line.id === lineId
            ? {
                ...line,
                countedQuantity,
                discrepancy: countedQuantity - line.expectedQuantity,
              }
            : line
        ),
      };
    });

    try {
      const res = await fetch(
        `/api/v1/stock-takes/${id}/lines/${lineId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-organization-id": orgId,
          },
          body: JSON.stringify({ countedQuantity }),
        }
      );
      const data = await movementJson(res);
      const saved = movementStockLine(data.line);
      if (saved.id !== lineId) throw new Error("Mismatched stock line");

      setStockTake((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lines: prev.lines.map((line) =>
            line.id === lineId
              ? {
                  ...line,
                  countedQuantity: saved.countedQuantity as number | null,
                  discrepancy: saved.discrepancy as number | null,
                }
              : line
          ),
        };
      });
      return true;
    } catch {
      toast.error(t("updateCountFailed"));
      const original = stockTake?.lines.find((line) => line.id === lineId);
      if (original) setStockTake((prev) => prev ? {
        ...prev, lines: prev.lines.map((line) => line.id === lineId ? original : line),
      } : prev);
      return false;
    } finally {
      setSavingLines((prev) => {
        const next = new Set(prev);
        next.delete(lineId);
        return next;
      });
    }
  }

  // Progress calculations (must be before early returns for hooks)
  const lines = useMemo(() => stockTake?.lines ?? [], [stockTake?.lines]);
  const totalLines = lines.length;
  const countedLines = lines.filter((l) => l.countedQuantity !== null).length;
  const progressPct =
    totalLines > 0 ? Math.round((countedLines / totalLines) * 100) : 0;
  const matchCount = lines.filter(
    (l) => l.countedQuantity !== null && l.discrepancy === 0
  ).length;
  const discrepancyCount = lines.filter(
    (l) =>
      l.countedQuantity !== null &&
      l.discrepancy !== null &&
      l.discrepancy !== 0
  ).length;
  const uncountedCount = totalLines - countedLines;
  const accuracyPct =
    totalLines > 0 ? Math.round((matchCount / totalLines) * 100) : 100;

  // Filtered, searched, sorted lines
  const filteredLines = useMemo(() => {
    let result = lines;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.inventoryItem.name.toLowerCase().includes(q) ||
          l.inventoryItem.code.toLowerCase().includes(q)
      );
    }

    switch (lineFilter) {
      case "uncounted":
        result = result.filter((l) => l.countedQuantity === null);
        break;
      case "matched":
        result = result.filter(
          (l) => l.countedQuantity !== null && (l.discrepancy ?? l.countedQuantity - l.expectedQuantity) === 0
        );
        break;
      case "discrepancies":
        result = result.filter(
          (l) =>
            l.countedQuantity !== null &&
            (l.discrepancy ?? l.countedQuantity - l.expectedQuantity) !== 0
        );
        break;
    }

    // Sort
    const dir = sortOrder === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return dir * a.inventoryItem.name.localeCompare(b.inventoryItem.name);
        case "code":
          return dir * a.inventoryItem.code.localeCompare(b.inventoryItem.code);
        case "expected":
          return dir * (a.expectedQuantity - b.expectedQuantity);
        case "counted":
          return dir * ((a.countedQuantity ?? -1) - (b.countedQuantity ?? -1));
        case "discrepancy": {
          const dA = a.countedQuantity !== null ? a.countedQuantity - a.expectedQuantity : 0;
          const dB = b.countedQuantity !== null ? b.countedQuantity - b.expectedQuantity : 0;
          return dir * (Math.abs(dB) - Math.abs(dA));
        }
        default:
          return 0;
      }
    });

    return result;
  }, [lines, debouncedSearch, lineFilter, sortBy, sortOrder]);

  if (loading) return <BrandLoader />;
  if (readError) return <p role="alert">{t("stockReadFailed")}</p>;

  if (!stockTake) {
    return (
      <div className="space-y-4 pt-12 text-center">
        <p className="text-sm text-muted-foreground">{t("stockNotFound")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/inventory/stock-takes")}
         className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >{t("backStock")}</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[stockTake.status];
  const isEditable = stockTake.status === "in_progress";

  async function handleConfirmAllRemaining() {
    if (!orgId || !stockTake) return;
    const uncounted = stockTake.lines.filter((l) => l.countedQuantity === null);
    if (uncounted.length === 0) return;

    const confirmed = await confirm({
      title: t("confirmRemainingTitle", { count: uncounted.length }),
      description:
        t("confirmAllHelp"),
      confirmLabel: t("confirmAll"),
      cancelLabel: t("cancel"),
    });
    if (!confirmed) return;

    setConfirmingAll(true);
    try {
      const results = await Promise.all(
        uncounted.map((line) =>
          handleUpdateLine(line.id, line.expectedQuantity)
        )
      );
      if (results.every(Boolean)) toast.success(t("confirmedItems", { count: uncounted.length }));
      else toast.error(t("bulkFailed"));
    } finally {
      setConfirmingAll(false);
    }
  }

  function getRowVarianceClass(line: StockTakeLine) {
    if (line.countedQuantity === null) return "";
    const disc = line.discrepancy ?? line.countedQuantity - line.expectedQuantity;
    if (disc === 0) return "bg-emerald-50/50 dark:bg-emerald-950/10";
    if (Math.abs(disc) <= 5) return "bg-amber-50/50 dark:bg-amber-950/10";
    return "bg-red-50/50 dark:bg-red-950/10";
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push("/inventory/stock-takes")}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" />{t("backStockLink")}</button>

      <ContentReveal className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <ClipboardList className="size-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold"><BidiText>{stockTake.name}</BidiText></h1>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", statusCfg.className)}
                >
                  {t(statusCfg.label)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("created")}{" "}
                {new Date(stockTake.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {stockTake.warehouse && (
                  <>
                    {" · "}
                    <BidiText>{stockTake.warehouse.name}</BidiText> (<IdentifierText>{stockTake.warehouse.code}</IdentifierText>)
                  </>
                )}
                {stockTake.completedAt && (
                  <>
                    {" · "}{t("completed")}{" "}
                    {new Date(stockTake.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {stockTake.status === "draft" && (
              <>
                <Button
                  size="sm"
                  onClick={handleStartCount}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                >
                  {actionLoading ? (
                    <Loader2 className="me-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Play className="me-1.5 size-3.5" />
                  )}{t("startCount")}</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                >
                  <Trash2 className="me-1.5 size-3.5" />{t("delete")}</Button>
              </>
            )}
            {stockTake.status === "in_progress" && (
              <>
                <Button
                  size="sm"
                  variant={blindMode ? "default" : "outline"}
                  onClick={() => setBlindMode(!blindMode)}
                 className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                  <EyeOff className="me-1.5 size-3.5" />{t("blindCount")}</Button>
                <Button
                  size="sm"
                  onClick={handleApplyAdjustments}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                >
                  {actionLoading ? (
                    <Loader2 className="me-1.5 size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="me-1.5 size-3.5" />
                  )}{t("finalizeAdjustment")}</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                >
                  <XCircle className="me-1.5 size-3.5" />{t("cancel")}</Button>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {stockTake.status !== "draft" && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs flex-wrap">
              <span className="text-muted-foreground font-medium">{t("countingProgress")}</span>
              <span className="font-mono font-medium"><BidiText>{t("countProgress", { count: countedLines, total: totalLines })}</BidiText></span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
              />
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
              <span>{t("matches")}<span className="font-medium text-emerald-600">{matchCount}</span></span>
              <span>{t("discrepanciesLabel")}<span className="font-medium text-red-600">{discrepancyCount}</span></span>
              <span>{t("uncountedLabel")}<span className="font-medium">{uncountedCount}</span></span>
            </div>
          </div>
        )}

        {/* Variance summary (completed only) */}
        {stockTake.status === "completed" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xl font-bold font-mono">{totalLines}</p>
              <p className="text-[11px] text-muted-foreground">{t("totalItems")}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xl font-bold font-mono text-emerald-600">{matchCount}</p>
              <p className="text-[11px] text-muted-foreground">{t("accurate")}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xl font-bold font-mono text-red-600">{discrepancyCount}</p>
              <p className="text-[11px] text-muted-foreground">{t("discrepancies")}</p>
            </div>
            <div className="rounded-xl border bg-card p-3 text-center">
              <p className="text-xl font-bold font-mono">{accuracyPct}%</p>
              <p className="text-[11px] text-muted-foreground">{t("accuracy")}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {stockTake.notes && (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{t("notes")}</p>
            <p className="text-sm text-foreground"><BidiText>{stockTake.notes}</BidiText></p>
          </div>
        )}

        {/* Lines */}
        {stockTake.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
              <ClipboardList className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t("noStockItems")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Toolbar: Tabs + Search */}
            <div className="flex flex-col gap-3">
              {/* Filter tabs + bulk action */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={lineFilter} onValueChange={(v) => setLineFilter(v as LineFilter)}>
                  <TabsList>
                    <TabsTrigger value="all">{t("all")}<span className="ms-1 text-[10px] font-mono opacity-60">{totalLines}</span>
                    </TabsTrigger>
                    <TabsTrigger value="uncounted">{t("uncounted")}<span className="ms-1 text-[10px] font-mono opacity-60">{uncountedCount}</span>
                    </TabsTrigger>
                    <TabsTrigger value="matched">{t("matched")}<span className="ms-1 text-[10px] font-mono opacity-60">{matchCount}</span>
                    </TabsTrigger>
                    <TabsTrigger value="discrepancies">{t("discrepancies")}<span className="ms-1 text-[10px] font-mono opacity-60">{discrepancyCount}</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <AnimatePresence>
                  {isEditable && uncountedCount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleConfirmAllRemaining}
                        disabled={confirmingAll}
                        className="h-8 text-xs gap-1.5 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
                      >
                        {confirmingAll ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <ChevronsUp className="size-3" />
                        )}
                        <BidiText>{t("confirmRemaining", { count: uncountedCount })}</BidiText>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Search + Sort */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-xs flex-wrap">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("itemSearch")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9 pe-8 h-8 text-sm"
                   dir="auto" aria-label={t("itemSearch")} />
                  {searchQuery && (
                    <button
                      aria-label={t("clearSearch")}
                      onClick={() => setSearchQuery("")}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-8 w-full sm:w-[150px] text-xs data-[size=default]:h-auto data-[size=sm]:h-auto min-h-8 whitespace-normal *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal *:data-[slot=select-value]:text-start *:data-[slot=select-value]:min-w-0" aria-label={t("sortField")} >
                    <ArrowUpDown className="size-3 me-1.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("toggleSort")}
                  className="size-8 shrink-0"
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                >
                  <ArrowUpDown className={cn("size-3.5 transition-transform", sortOrder === "asc" && "rotate-180")} />
                </Button>
              </div>
            </div>

            {searchQuery !== debouncedSearch ? (
              <div className="flex items-center justify-center py-20 flex-wrap">
                <div className="brand-loader" aria-label={t("loading")}>
                  <div className="brand-loader-circle brand-loader-circle-1" />
                  <div className="brand-loader-circle brand-loader-circle-2" />
                </div>
              </div>
            ) : (
            <>
            <MotionConfig reducedMotion="never">
            <motion.div
              key={debouncedSearch + lineFilter}
              initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.12, ease: EASE_OUT }}
              style={{ willChange: "opacity, transform, filter" }}
            >
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_70px_130px_70px_50px] sm:grid-cols-[1fr_90px_150px_90px_70px] gap-4 px-5 py-2.5 border-b bg-muted/50">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("item")}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-end">{t("expected")}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-end">{t("counted")}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-end">{t("diff")}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground text-end">{t("status")}</p>
              </div>

              {/* Table rows */}
              <div className="divide-y">
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredLines.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >{t("noItemMatches")}</motion.div>
                  ) : (
                    filteredLines.map((line) => {
                      const disc =
                        line.countedQuantity !== null
                          ? line.countedQuantity - line.expectedQuantity
                          : null;
                      return (
                        <motion.div
                          key={line.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className={cn(
                            "grid grid-cols-[1fr_70px_130px_70px_50px] sm:grid-cols-[1fr_90px_150px_90px_70px] gap-4 px-5 py-3 items-center transition-colors duration-300",
                            getRowVarianceClass(line)
                          )}
                        >
                          {/* Item info */}
                          <div className="min-w-0">
                            <p className="text-sm font-medium whitespace-normal [overflow-wrap:anywhere]">
                              <BidiText>{line.inventoryItem.name}</BidiText>
                            </p>
                            <p className="text-xs text-muted-foreground whitespace-normal [overflow-wrap:anywhere]">
                              <IdentifierText>{line.inventoryItem.code}</IdentifierText>
                            </p>
                          </div>

                          {/* Expected */}
                          <p className="text-sm font-mono tabular-nums text-end">
                            {blindMode && isEditable ? "***" : line.expectedQuantity}
                          </p>

                          {/* Counted */}
                          {isEditable ? (
                            <CounterCell
                              line={line}
                              isSaving={savingLines.has(line.id)}
                              onUpdate={handleUpdateLine}
                            />
                          ) : (
                            <p className="text-sm font-mono tabular-nums text-end">
                              <BidiText>{line.countedQuantity !== null
                                ? line.countedQuantity
                                : "-"}</BidiText>
                            </p>
                          )}

                          {/* Discrepancy */}
                          <p
                            className={cn(
                              "text-sm font-mono tabular-nums text-end font-medium transition-colors duration-300",
                              disc === null
                                ? "text-muted-foreground"
                                : disc === 0
                                  ? "text-muted-foreground"
                                  : disc > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600 dark:text-red-400"
                            )}
                          >
                            <BidiText dir="ltr">{disc === null
                              ? "-"
                              : disc === 0
                                ? "0"
                                : disc > 0
                                  ? `+${disc}`
                                  : disc}</BidiText>
                          </p>

                          {/* Adjusted badge */}
                          <div className="flex justify-end flex-wrap">
                            <AnimatePresence>
                              {line.adjusted && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  >{t("adjusted")}</Badge>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Showing X of Y - only when filtering */}
            {(debouncedSearch || lineFilter !== "all") && (
              <p className="text-xs text-muted-foreground text-center pt-3">
                <BidiText>{t("showingItems", { count: filteredLines.length, total: totalLines })}</BidiText>
              </p>
            )}

            </motion.div>
            </MotionConfig>
            </>
            )}
          </div>
        )}
      </ContentReveal>

      {confirmDialog}
    </div>
  );
}
