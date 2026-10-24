"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { bankUiAccount, bankUiTransaction, bankUiReport, bankUiReconciliation, bankUiBalance } from "@/lib/money/bank-ui";

import { useTranslations } from "next-intl";
import { requireReconciliationResponse, reconciliationFailure } from "@/i18n/bank-reconciliation-presentation";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle,
  Search,
  XCircle,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { bankMoneyDisplay } from "@/lib/money/bank-display";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { ReconciliationReport, type ReconciliationData } from "../_components";

interface BankAccountDetail {
  id: string;
  accountName: string;
  balance: bigint;
  currencyCode: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  amount: bigint;
  balance: bigint | null;
  status: "unreconciled" | "reconciled" | "excluded";
  accountId?: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  journalEntryId?: string | null;
  reconciliationId?: string | null;
}

// A statement line should be categorized/matched (its journal entry recorded)
// before it's reconciled, so the books stay in sync with the bank.
function isCategorized(t: Transaction): boolean {
  return Boolean(t.journalEntryId);
}

interface Reconciliation {
  id: string;
  startDate: string;
  endDate: string;
  startBalance: bigint;
  endBalance: bigint;
  status: "in_progress" | "completed";
  createdAt: string;
}

export default function ReconcilePage() {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankReconciliation");
  const errors = useTranslations("BankAccountErrors");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [account, setAccount] = useState<BankAccountDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [report, setReport] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recForm, setRecForm] = useState({
    startDate: "",
    endDate: "",
    startBalance: "",
    endBalance: "",
  });
  const [savingRec, setSavingRec] = useState(false);
  const [acting, setActing] = useState(false);

  const orgId =
    typeof window !== "undefined"
      ? localStorage.getItem("activeOrgId")
      : null;

  useDocumentTitle(t("documentTitle"));

  const fetchData = useCallback(() => {
    if (!orgId) return;
    const headers = { "x-organization-id": orgId };

    // Pull both the still-to-review lines (status=unreconciled) and the
    // categorized/matched lines (status=reconciled — categorize/match flip the
    // status while recording a journal entry) so the latter can be ticked off
    // into a statement reconciliation. Lines already part of a completed
    // statement reconciliation (reconciliationId set) are filtered out below.
    Promise.all([
      fetch(`/api/v1/bank-accounts/${id}`, { headers }).then(async (r) => (await requireReconciliationResponse(r, t, errors, t("unavailable"))).json()),
      fetch(`/api/v1/bank-accounts/${id}/transactions?status=unreconciled&limit=100`, {
        headers,
      }).then(async (r) => (await requireReconciliationResponse(r, t, errors, t("unavailable"))).json()),
      fetch(`/api/v1/bank-accounts/${id}/transactions?status=reconciled&limit=100`, {
        headers,
      }).then(async (r) => (await requireReconciliationResponse(r, t, errors, t("unavailable"))).json()),
      fetch(`/api/v1/bank-accounts/${id}/reconciliations`, {
        headers,
      }).then(async (r) => (await requireReconciliationResponse(r, t, errors, t("unavailable"))).json()),
      // Statement-vs-GL report: end balance, GL balance, running difference and
      // the reconciled / unreconciled splits, scoped to the latest reconciliation.
      fetch(`/api/v1/bank-accounts/${id}/reconciliation`, { headers })
        .then(async (r) => (await requireReconciliationResponse(r, t, errors, t("unavailable"))).json())
        .catch(() => null),
    ])
      .then(([accountData, unreconciledData, reconciledData, recData, reportData]) => {
        if (accountData.bankAccount) setAccount(bankUiAccount(accountData.bankAccount) as unknown as BankAccountDetail);
        const unreconciled: Transaction[] = (unreconciledData.data ?? []).map((row: Record<string, unknown>) => bankUiTransaction(row, accountData.bankAccount.currencyCode) as unknown as Transaction);
        // Categorized lines that haven't yet been rolled into a completed
        // statement reconciliation.
        const categorized: Transaction[] = (reconciledData.data ?? []).map((row: Record<string, unknown>) => bankUiTransaction(row, accountData.bankAccount.currencyCode) as unknown as Transaction).filter(
          (t: Transaction) => t.journalEntryId && !t.reconciliationId
        );
        setTransactions([...unreconciled, ...categorized]);
        if (recData.data) setReconciliations(recData.data.map(bankUiReconciliation) as Reconciliation[]);
        setReport(reportData && reportData.bankAccountId ? bankUiReport(reportData) as unknown as ReconciliationData : null);
      })
      .catch((err) => { setAccount(null); setTransactions([]); setReport(null); toast.error(reconciliationFailure(err, t, t("unavailable"))); })
      .finally(() => setLoading(false));
  }, [id, orgId, t, errors]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTransactions = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      t.reference?.toLowerCase().includes(q) ||
      t.date.includes(q)
    );
  });

  // Only categorized/matched lines may be included in a reconciliation.
  const selectableTransactions = filteredTransactions.filter(isCategorized);
  const uncategorizedCount = filteredTransactions.length - selectableTransactions.length;

  function toggleSelect(tx: Transaction) {
    if (!isCategorized(tx)) {
      toast.error(t("addFirst"));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tx.id)) next.delete(tx.id);
      else next.add(tx.id);
      return next;
    });
  }

  function selectAll() {
    if (
      selectableTransactions.length > 0 &&
      selectedIds.size === selectableTransactions.length
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableTransactions.map((t) => t.id)));
    }
  }

  async function bulkAction(action: "reconcile" | "exclude") {
    if (!orgId || selectedIds.size === 0) return;
    setActing(true);
    const headers = {
      "Content-Type": "application/json",
      "x-organization-id": orgId,
    };

    let success = 0;
    for (const txId of selectedIds) {
      try {
        const res = await fetch(`/api/v1/bank-transactions/${txId}/${action}`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });
        if (res.ok) success++;
      } catch {
        // continue
      }
    }

    const failed = selectedIds.size - success;
    if (success === 0) toast.error(t("bulkFailed"));
    else if (failed > 0) toast.warning(t("partialResult", { count: success, failed }));
    else toast.success(t(action === "reconcile" ? "matchedCount" : "ignoredCount", { count: success }));
    setSelectedIds(new Set());
    setActing(false);
    fetchData();
  }

  async function createReconciliation() {
    if (!orgId) return;
    setSavingRec(true);
    try {
      const res = await fetch(`/api/v1/bank-accounts/${id}/reconciliations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          startDate: recForm.startDate,
          endDate: recForm.endDate,
          startBalanceMinor: bankUiBalance(recForm.startBalance || "0", account!.currencyCode),
          endBalanceMinor: bankUiBalance(recForm.endBalance || "0", account!.currencyCode),
        }),
      });
      await requireReconciliationResponse(res, t, errors, t("startFailed"));
      toast.success(t("startSuccess"));
      setSheetOpen(false);
      setRecForm({ startDate: "", endDate: "", startBalance: "", endBalance: "" });
      fetchData();
    } catch (err) {
      toast.error(
        reconciliationFailure(err, t, t("startFailed"))
      );
    } finally {
      setSavingRec(false);
    }
  }

  // Finish the active statement check: stamp the chosen lines (or every
  // categorized line in the period) with the reconciliation and close it. This
  // is the completion step that was missing — without it a statement check
  // stayed "In Progress" forever and ticked lines were never attached.
  async function finishStatementCheck(includeIds?: string[]) {
    if (!orgId) return;
    const active = reconciliations.find((r) => r.status === "in_progress");
    if (!active) {
      toast.error(t("startFirst"));
      setSheetOpen(true);
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/v1/bank-accounts/${id}/reconciliation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          action: "complete",
          reconciliationId: active.id,
          ...(includeIds && includeIds.length > 0
            ? { transactionIds: includeIds }
            : {}),
        }),
      });
      await requireReconciliationResponse(res, t, errors, t("finishFailed"));
      const data = await res.json();
      toast.success(
        t("finishSuccess", { count: data.reconciledCount })
      );
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast.error(
        reconciliationFailure(err, t, t("finishFailed"))
      );
    } finally {
      setActing(false);
    }
  }

  const activeRec = reconciliations.find((r) => r.status === "in_progress");

  const selectedTotal = filteredTransactions
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + BigInt(t.amount), 0n);

  const unreconciledTotal = transactions.reduce((sum, t) => sum + BigInt(t.amount), 0n);

  if (loading) return <BrandLoader />;
  if (!account) return <p role="alert">{t("unavailable")}</p>;
  const formatBankAmount = (amount: number | bigint) => bankMoneyDisplay(amount, account.currencyCode, unitPresentation);

  return (
    <ContentReveal className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label={t("back")} onClick={() => router.push(`/accounting/banking/${id}`)} className="h-auto min-h-8 min-w-0 whitespace-normal size-8 shrink-0">
          <ArrowLeft className="[&:dir(rtl)]:rotate-180 size-4" />
        </Button>
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-lg font-semibold tracking-tight min-w-0 whitespace-normal [overflow-wrap:anywhere]">
            <BidiText>{t("title", { account: account.accountName })}</BidiText>
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("hint")}
          </p>
        </div>
        {activeRec ? (
          <Button size="sm" onClick={() => finishStatementCheck()} disabled={acting || !report || report.currencyCode !== report.glCurrencyCode} title={t("finishAllTitle")} className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle className="me-1.5 size-3.5" />
            {t("finish")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)} className="h-auto min-h-8 min-w-0 whitespace-normal">
            {t("checkStatement")}
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse">
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("accountBalance")}</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">
              <BidiText>{formatBankAmount(account?.balance || 0n)}</BidiText>
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("stillToMatch")}</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">
              {transactions.length}
              <span className="text-sm font-normal text-muted-foreground ms-1.5">
                (<BidiText>{formatBankAmount(unreconciledTotal)}</BidiText>)
              </span>
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("selected")}</p>
            <p className={cn(
              "mt-1 text-xl font-semibold font-mono tabular-nums",
              selectedIds.size > 0
                ? selectedTotal < 0 ? "text-red-600" : "text-emerald-600"
                : "text-muted-foreground/30"
            )}>
              {selectedIds.size > 0 ? formatBankAmount(selectedTotal) : "-"}
              {selectedIds.size > 0 && (
                <span className="text-sm font-normal text-muted-foreground ms-1.5">
                  ({t("itemCount", { count: selectedIds.size })})
                </span>
              )}
            </p>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t bg-muted/30">
            <Button size="sm" onClick={() => finishStatementCheck([...selectedIds])} disabled={acting || !activeRec} title={activeRec ? t("finishSelectedTitle") : t("startFirstTitle")} className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="me-1.5 size-3.5" />
              {t("markSelected", { count: selectedIds.size })}
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkAction("exclude")} disabled={acting || transactions.some((tx) => selectedIds.has(tx.id) && (tx.status === "reconciled" || tx.journalEntryId !== null))} title={t("ignoreTitle")} className="h-auto min-h-8 min-w-0 whitespace-normal">
              <XCircle className="me-1.5 size-3.5" />
              {t("ignoreSelected", { count: selectedIds.size })}
            </Button>
            <div className="flex-1" />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("clearSelection")}
            </button>
          </div>
        )}
      </div>

      {/* Statement vs GL report + running difference + adjustment */}
      {report && account && (
        <ReconciliationReport
          data={report}
          currencyCode={account.currencyCode}
          orgId={orgId}
          bankAccountId={id}
          onChanged={fetchData}
        />
      )}

      {/* Transaction list */}
      {filteredTransactions.length === 0 && transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <CheckCircle className="size-8 text-emerald-500 mx-auto" />
          <h3 className="mt-3 text-sm font-semibold">{t("allCaughtUp")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("nothingLeft")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="ps-9 h-8 text-sm" dir="auto" aria-label={t("search")} />
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              onClick={selectAll}
              disabled={selectableTransactions.length === 0}
            >
              {selectableTransactions.length > 0 &&
              selectedIds.size === selectableTransactions.length
                ? t("deselectAll")
                : t("selectAll")}
            </button>
          </div>

          {uncategorizedCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <span className="font-medium">
                {t("notInBooks", { count: uncategorizedCount })}
              </span>{" "}
              {t("categorizeHint", { count: uncategorizedCount })}
            </div>
          )}

          <div className="rounded-lg border divide-y">
            {filteredTransactions.map((tx) => {
              const selected = selectedIds.has(tx.id);
              const isIncome = tx.amount >= 0;
              const categorized = isCategorized(tx);
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => toggleSelect(tx)}
                  aria-disabled={!categorized}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-start transition-colors",
                    !categorized
                      ? "cursor-not-allowed opacity-60 hover:bg-muted/20"
                      : selected
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "hover:bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded transition-colors",
                      !categorized
                        ? "border border-dashed border-muted-foreground/30"
                        : selected
                          ? "bg-emerald-600 text-white"
                          : "border border-muted-foreground/25"
                    )}
                  >
                    {selected && categorized && <Check className="size-3" />}
                  </div>

                  <div className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    isIncome
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                  )}>
                    {isIncome ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>

                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText>{tx.description}</BidiText></p>
                      {categorized && tx.accountName && (
                        <span className="text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere] shrink min-w-0">
                          &rarr; <BidiText>{tx.accountName}</BidiText>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground"><IdentifierText>{tx.date}</IdentifierText></span>
                      {tx.reference && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-xs text-muted-foreground"><IdentifierText>{tx.reference}</IdentifierText></span>
                        </>
                      )}
                      {!categorized && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            {t("addBooksFirst")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className={cn(
                    "font-mono text-sm font-medium tabular-nums shrink-0",
                    isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {isIncome ? "+" : ""}<BidiText>{formatBankAmount(tx.amount)}</BidiText>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Past reconciliations */}
      {reconciliations.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold">{t("pastChecks")}</h3>
          <div className="rounded-lg border divide-y">
            {reconciliations.map((rec) => (
              <div key={rec.id} className="flex items-center gap-4 px-4 py-3">
                <Calendar className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm font-medium">
                    {t("range", { start: rec.startDate, end: rec.endDate })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <BidiText>{t("range", { start: formatBankAmount(rec.startBalance), end: formatBankAmount(rec.endBalance) })}</BidiText>
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    rec.status === "completed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                >
                  {rec.status === "completed" ? t("completed") : t("inProgress")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Reconciliation Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div>
              <SheetTitle className="text-lg">{t("checkStatement")}</SheetTitle>
              <SheetDescription>
                {t("newHint")}
              </SheetDescription>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("statementPeriod")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("startDate")}</Label>
                  <DatePicker
                    value={recForm.startDate}
                    onChange={(v) =>
                      setRecForm({ ...recForm, startDate: v })
                    }
                    placeholder={t("selectDate")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("endDate")}</Label>
                  <DatePicker
                    value={recForm.endDate}
                    onChange={(v) =>
                      setRecForm({ ...recForm, endDate: v })
                    }
                    placeholder={t("selectDate")}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("statementBalances")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="statement-opening">{t("openingBalance", { currency: currencyLabel(account.currencyCode, unitPresentation.locale) })}</Label>
                  <Input inputMode="decimal" id="statement-opening" value={recForm.startBalance} onChange={(event) =>
                      setRecForm({ ...recForm, startBalance: event.target.value })
                    } placeholder="0.00" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement-closing">{t("closingBalance", { currency: currencyLabel(account.currencyCode, unitPresentation.locale) })}</Label>
                  <Input inputMode="decimal" id="statement-closing" value={recForm.endBalance} onChange={(event) =>
                      setRecForm({ ...recForm, endBalance: event.target.value })
                    } placeholder="0.00" dir="ltr" />
                </div>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            <Button variant="outline" onClick={() => setSheetOpen(false)} className="h-auto min-h-8 min-w-0 whitespace-normal">
              {t("cancel")}
            </Button>
            <Button
              onClick={createReconciliation}
              disabled={!recForm.startDate || !recForm.endDate || savingRec}
              className="h-auto min-h-8 min-w-0 whitespace-normal bg-emerald-600 hover:bg-emerald-700"
            >
              {savingRec ? t("starting") : t("start")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
