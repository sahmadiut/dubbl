"use client";

import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { requireReconciliationResponse, reconciliationFailure } from "@/i18n/bank-reconciliation-presentation";
import { useTranslations } from "next-intl";
import { bankWorkspaceFailure, bankMatchReason, type WorkspaceTranslate } from "@/i18n/bank-workspace-presentation";
import { bankImportFormatLabels, bankImportWarning } from "@/i18n/bank-import-presentation";
import { requireBankAccountResponse } from "@/i18n/bank-account-presentation";

import { useRef, useState, useMemo, useEffect } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle,
  FileStack,
  FileText,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Scale,
  Search,
  Split,
  Tags,
  Trash2,
  Undo2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bankMoneyDisplay } from "@/lib/money/bank-display";
import { bankUiTransaction, bankUiMoney as formatMoney, bankUiDecimal, bankUiAbs, bankUiMin, bankUiAmount, bankUiMatchAmount, bankUiSplit, bankUiTax } from "@/lib/money/bank-ui";
import { currencyMetadata } from "@/lib/money/exact";
import { cn } from "@/lib/utils";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { ReceiptAttachments } from "@/components/dashboard/receipt-attachments";
import { TrackingPicker } from "@/components/dashboard/tracking-picker";
import {
  resolveSpecialAccount,
  type ResolvableAccount as SpecialResolvableAccount,
  type SpecialCategoryRole,
} from "@/lib/banking/special-categories";

function BankMatchPreview({ text, currencyCode, transaction, document }: {
  text: string; currencyCode: string; transaction: Transaction | null; document: OpenBill | OpenInvoice | undefined;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  if (!transaction || !document) return null;
  let message: string;
  try { message = t("paymentPreview", { amount: formatMoney(BigInt(bankUiMatchAmount(text, currencyCode, transaction, document).amountMinor), currencyCode, unitPresentation) }); }
  catch (error) { message = bankWorkspaceFailure(error, t, t("validPayment")); }
  return <p role="status" className="text-xs text-muted-foreground">{message}</p>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BankAccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "cash"
  | "loan"
  | "investment"
  | "other";

export type StatementFormat =
  | "auto"
  | "csv"
  | "tsv"
  | "qif"
  | "ofx"
  | "qfx"
  | "qbo"
  | "camt052"
  | "camt053"
  | "camt054"
  | "mt940"
  | "mt942"
  | "bai2";

export interface BankAccountDetail {
  id: string;
  accountName: string;
  accountNumber: string | null;
  bankName: string | null;
  currencyCode: string;
  countryCode: string | null;
  accountType: BankAccountType;
  color: string;
  balance: bigint;
  isActive: boolean;
  // The ledger account this bank account is recorded under in the books. Set up
  // automatically; surfaced read-only so users can see the connection exists.
  chartAccountId?: string | null;
  chartAccount?: { id: string; name: string; code: string } | null;
}

export interface ImportPreviewRow {
  date: string;
  description: string;
  amount: bigint;
  reference: string | null;
  balance?: bigint | null;
  payee?: string | null;
  counterparty?: string | null;
}

export interface ImportPreview {
  format: StatementFormat;
  accountIdentifier: string | null;
  currencyCode: string | null;
  statementStartDate: string | null;
  statementEndDate: string | null;
  openingBalance: bigint | null;
  closingBalance: bigint | null;
  warnings: string[];
  rowCount: number;
  duplicates: Array<{ dedupeHash: string; description: string; amount: bigint; date: string }>;
  transactions: ImportPreviewRow[];
}

export interface StatementImport {
  id: string;
  format: string;
  fileName: string;
  importedCount: number;
  duplicateCount: number;
  warningCount?: number;
  warnings: string[];
  statementStartDate: string | null;
  statementEndDate: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  amount: bigint;
  balance: bigint | null;
  status: "unreconciled" | "reconciled" | "excluded";
  payee?: string | null;
  counterparty?: string | null;
  import?: { id: string; format: string; fileName: string | null } | null;
  // Derived-status inputs (all optional so existing callers still compile):
  // accountId/accountCode/accountName describe the linked ledger account set
  // when categorized/matched; journalEntryId means bookkeeping was recorded;
  // reconciliationId means it's part of a completed statement reconciliation.
  accountId?: string | null;
  accountCode?: string | null;
  accountName?: string | null;
  // Set when categorized — used to pre-fill the sheet when editing the line.
  taxRateId?: string | null;
  contactId?: string | null;
  journalEntryId?: string | null;
  reconciliationId?: string | null;
  transferTransactionId?: string | null;
}

export interface OpenBill {
  currencyCode: string;
  id: string;
  billNumber: string;
  contactName: string;
  dueDate: string;
  total: bigint;
  amountDue: bigint;
  status: string;
}

export interface SuggestedMatch {
  transactionId: string;
  candidate: { type: string; id: string; description: string; amount: bigint; date: string };
  confidence: number;
  reasons: string[];
}

// A match to an already-recorded payment, posted journal entry, or a transfer
// leg in another own account — returned by GET …/match as `existingMatches`.
export interface ExistingMatch {
  transactionId: string;
  candidate: {
    type: "existing_payment" | "existing_journal" | "transfer";
    id: string;
    journalEntryId: string | null;
    date: string;
    description: string;
    amount: bigint;
    reference: string | null;
    meta: Record<string, unknown>;
  };
  confidence: number;
  reasons: string[];
}

// A summary of another bank account in this org — used as a transfer target.
export interface BankAccountSummary {
  id: string;
  accountName: string;
  bankName: string | null;
  currencyCode: string;
  accountType: BankAccountType;
  balance: bigint;
  hasLedgerAccount: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------



export const STATUS_STYLES: Record<Transaction["status"], string> = {
  unreconciled: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  reconciled: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  excluded: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

// ---------------------------------------------------------------------------
// Derived transaction state — distinguishes the meaningfully different
// situations the raw `status` enum can't, using the existing fields:
//   • reconciledStatement: part of a completed statement reconciliation.
//   • categorized: has a journal entry (real bookkeeping was recorded).
//   • cleared: status='reconciled' but no journal entry — the cosmetic
//     "Mark as cleared" no-op (cleared on the bank, not categorized yet).
//   • toReview: status='unreconciled' — nothing done yet.
//   • excluded: status='excluded'.
// ---------------------------------------------------------------------------
export type DerivedTxState =
  | "reconciledStatement"
  | "categorized"
  | "cleared"
  | "toReview"
  | "excluded";

export function deriveTxState(tx: Transaction): DerivedTxState {
  if (tx.reconciliationId) return "reconciledStatement";
  if (tx.journalEntryId) return "categorized";
  if (tx.status === "excluded") return "excluded";
  if (tx.status === "reconciled") return "cleared";
  return "toReview";
}

export function derivedStateMeta(t: WorkspaceTranslate): Record<
  DerivedTxState,
  { label: string; className: string; title?: string }
> { return {
  reconciledStatement: {
    label: t("matchedToStatement"),
    className: STATUS_STYLES.reconciled,
    title: t("statementChecked"),
  },
  categorized: {
    label: t("inBooks"),
    className: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    title: t("categoryRecorded"),
  },
  cleared: {
    label: t("cleared"),
    className: STATUS_STYLES.unreconciled,
    title: t("clearedHint"),
  },
  toReview: {
    label: t("toDoLower"),
    className: STATUS_STYLES.unreconciled,
    title: t("notRecorded"),
  },
  excluded: {
    label: t("ignoredLower"),
    className: STATUS_STYLES.excluded,
    title: t("leftOut"),
  },
};

}

export const ACCOUNT_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

// ---------------------------------------------------------------------------
// Transaction Row
// ---------------------------------------------------------------------------
export function TransactionRow({
  tx,
  cur,
  isLast,
  onReconcile,
  onExclude,
  onCategorize,
  onMatch,
  onTransfer,
  onSplit,
  onUndo,
  selected,
  onSelectChange,
}: {
  tx: Transaction;
  cur: string;
  isLast: boolean;
  onReconcile: (id: string) => void;
  onExclude: (id: string) => void;
  onCategorize: (tx: Transaction) => void;
  // Legacy per-document match/expense entry points — kept optional for callers
  // that still pass them; the row now routes matching through the unified onMatch.
  onMatchBill?: (tx: Transaction) => void;
  onCreateExpense?: (tx: Transaction) => void;
  onMatchInvoice?: (tx: Transaction) => void;
  // New actions — optional so existing callers keep compiling.
  onMatch?: (tx: Transaction) => void;
  onTransfer?: (tx: Transaction) => void;
  onSplit?: (tx: Transaction) => void;
  // Reverse an already-done line (categorize / match / transfer / cleared) back
  // to the to-do list so it can be redone. Optional so existing callers compile.
  onUndo?: (tx: Transaction) => void;
  // Batch selection (optional). When provided, an unreconciled row shows a checkbox.
  selected?: boolean;
  onSelectChange?: (id: string, checked: boolean) => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const isCredit = tx.amount > 0;
  const selectable = !!onSelectChange && tx.status === "unreconciled";
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const derived = deriveTxState(tx);
  const stateMeta = derivedStateMeta(t)[derived];
  // A plain categorization (single account, no payment/transfer/statement
  // match) can be corrected in place. Payment matches and splits don't set
  // accountId; transfers/statement matches carry extra state — those use Undo.
  const canEditCategory =
    derived === "categorized" &&
    !!tx.accountId &&
    !tx.transferTransactionId &&
    !tx.reconciliationId;
  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30",
        !isLast && "border-b"
      )}
    >
      {selectable && (
        <Checkbox
          checked={!!selected}
          onCheckedChange={(c) => onSelectChange?.(tx.id, c === true)}
          aria-label={t("selectTransaction")}
          className="shrink-0"
        />
      )}
      <div className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        isCredit ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/40"
      )}>
        {isCredit
          ? <ArrowDownRight className="size-4 text-emerald-600 dark:text-emerald-400" />
          : <ArrowUpRight className="size-4 text-red-600 dark:text-red-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          {derived === "categorized" && tx.accountName && (
            <span className="text-xs text-muted-foreground truncate shrink min-w-0" title={t("assignedTo", { account: tx.accountName })}>
              &rarr; {tx.accountName}
            </span>
          )}
          <Badge
            variant="outline"
            className={cn("text-[10px] shrink-0", stateMeta.className)}
            title={stateMeta.title}
          >
            {stateMeta.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {tx.date}
          {tx.reference && <> · {tx.reference}</>}
          {tx.payee && <> · {tx.payee}</>}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          {tx.status === "unreconciled" && (
            <>
              {/* Surfaced primary action — the most common thing to do with a line */}
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={() => onCategorize(tx)}
                title={t("categorizeHint")}
              >
                <Tags className="mr-1.5 size-3.5" />{t("categorize")}</Button>
              {/* Everything else, one level down */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                    title={t("moreActions")}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {onMatch && (
                    <DropdownMenuItem onClick={() => onMatch(tx)} title={t("findMatchHint")}>
                      <Link2 className="mr-2 size-3.5" />{t("findMatchEllipsis")}</DropdownMenuItem>
                  )}
                  {onSplit && (
                    <DropdownMenuItem onClick={() => onSplit(tx)} title={t("splitHint")}>
                      <Split className="mr-2 size-3.5" />{t("splitCategories")}</DropdownMenuItem>
                  )}
                  {onTransfer && (
                    <DropdownMenuItem onClick={() => onTransfer(tx)} title={t("recordTransferHint")}>
                      <ArrowLeftRight className="mr-2 size-3.5" />{t("recordTransferTitle")}</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setConfirmClear(true)} title={t("clearHint")}>
                    <CheckCircle className="mr-2 size-3.5" />{t("markCleared")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onExclude(tx.id)} className="text-muted-foreground" title={t("ignoreHint")}>
                    <XCircle className="mr-2 size-3.5" />{t("ignoreTransaction")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {tx.status === "excluded" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onExclude(tx.id)} title={t("restoreHint")}>{t("stopIgnoring")}</Button>
          )}
          {/* A line you've already dealt with: let the user fix it. Plain
              categorizations can be edited in place; everything else (matches,
              transfers, cleared) can be undone back to the to-do list. */}
          {tx.status === "reconciled" && (
            <>
              {canEditCategory ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => onCategorize(tx)}
                  title={t("editHint")}
                >
                  <Pencil className="mr-1.5 size-3.5" />{t("edit")}</Button>
              ) : derived === "cleared" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => onCategorize(tx)}
                  title={t("recordPurpose")}
                >
                  <Tags className="mr-1.5 size-3.5" />{t("categorize")}</Button>
              ) : onUndo ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setConfirmUndo(true)}
                  title={t("undoHint")}
                >
                  <Undo2 className="mr-1.5 size-3.5" />{t("undo")}</Button>
              ) : null}
              {/* When a primary action is shown, tuck Undo into the menu. */}
              {onUndo && (canEditCategory || derived === "cleared") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                      title={t("moreActions")}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setConfirmUndo(true)} title={t("redoHint")}>
                      <Undo2 className="mr-2 size-3.5" />{t("undoToDo")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
        <span className={cn(
          "font-mono text-sm font-medium tabular-nums w-24 text-right",
          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}>
          {isCredit ? "+" : ""}{formatMoney(tx.amount, cur, unitPresentation)}
        </span>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clearTitle")}</DialogTitle>
            <DialogDescription>
              {t("clearDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">{tx.description}</p>
              <p className={cn(
                "mt-1 font-mono text-xs tabular-nums",
                isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {tx.date} · {isCredit ? "+" : ""}{formatMoney(tx.amount, cur, unitPresentation)}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">{t("noPurposeRecorded")}</p>
              <p className="mt-1">
                {t.rich("clearGuidance", { em: (chunks) => <em>{chunks}</em>, strong: (chunks) => <span className="font-medium">{chunks}</span> })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>{t("cancel")}</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { onReconcile(tx.id); setConfirmClear(false); }}
            >
              {t("markCleared")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmUndo} onOpenChange={setConfirmUndo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("undoTitle")}</DialogTitle>
            <DialogDescription>
              {t("undoDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">{tx.description}</p>
              {derived === "categorized" && tx.accountName && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t("currentlyAssigned", { account: tx.accountName })}</p>
              )}
              <p className={cn(
                "mt-1 font-mono text-xs tabular-nums",
                isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {tx.date} · {isCredit ? "+" : ""}{formatMoney(tx.amount, cur, unitPresentation)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {derived === "cleared"
                ? t("undoCleared")
                : t("undoBookkeeping")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUndo(false)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => { onUndo?.(tx); setConfirmUndo(false); }}
            >
              <Undo2 className="mr-2 size-3.5" />{t("undo")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Row
// ---------------------------------------------------------------------------
export function ImportRow({ imp, isLast }: { imp: StatementImport; isLast: boolean }) {
  const t = useTranslations("BankImports");
  return (
    <div className={cn("flex items-center justify-between px-4 py-3", !isLast && "border-b")}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted shrink-0">
          <FileStack className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{imp.fileName}</span>
            <Badge variant="outline" className="text-[10px]">{imp.format.toUpperCase()}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <span>{new Date(imp.createdAt).toLocaleDateString()}</span>
            {imp.statementStartDate && imp.statementEndDate && (
              <span>{t("period", { start: imp.statementStartDate, end: imp.statementEndDate })}</span>
            )}
            {imp.duplicateCount > 0 && <span>{t("duplicatesSkipped", { count: imp.duplicateCount })}</span>}
          </div>
        </div>
      </div>
      <span className="text-sm font-mono font-medium shrink-0 tabular-nums">{t("rowCount", { count: imp.importedCount })}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Sheet
// ---------------------------------------------------------------------------
export function ImportSheet({
  open,
  onOpenChange,
  selectedFile,
  setSelectedFile,
  manualContent,
  setManualContent,
  format,
  setFormat,
  preview,
  previewing,
  importing,
  onPreview,
  onImport,
  currencyCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  manualContent: string;
  setManualContent: (content: string) => void;
  format: StatementFormat;
  setFormat: (format: StatementFormat) => void;
  preview: ImportPreview | null;
  previewing: boolean;
  importing: boolean;
  onPreview: () => void;
  onImport: () => void;
  currencyCode: string;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankImports");
  const formatLabels = bankImportFormatLabels(t);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const canPreview = Boolean(selectedFile || manualContent.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Upload className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-lg">{t("title")}</SheetTitle>
              <SheetDescription>{t("hint")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("uploadFile")}</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setSelectedFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 sm:px-6 sm:py-10 text-center transition-all",
                dragging
                  ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-muted-foreground/25 hover:border-emerald-400 hover:bg-muted/30",
                selectedFile && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                aria-label={t("chooseFile")}
                accept=".csv,.tsv,.qif,.ofx,.qfx,.qbo,.xml,.txt,.bai,.bai2"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {selectedFile ? (
                <>
                  <FileText className="size-8 text-emerald-600" />
                  <p className="mt-3 text-sm font-medium">{selectedFile.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("fileSize", { size: (selectedFile.size / 1024).toFixed(1) })}</p>
                  <button
                    type="button"
                    aria-label={t("removeFile")}
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Upload className="size-5 text-muted-foreground" />
                  </div>
                  <p className="mt-3 text-sm font-medium">{t("dropHint")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("browseHint")}</p>
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("pasteContent")}</p>
            <Textarea
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              aria-label={t("pasteContent")}
              placeholder={t("contentPlaceholder")}
            />
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("format")}</p>
            <Select value={format} onValueChange={(v) => setFormat(v as StatementFormat)}>
              <SelectTrigger aria-label={t("format")}><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(formatLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preview && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("preview")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: t("format"), value: formatLabels[preview.format] || preview.format },
                    { label: t("rows"), value: String(preview.rowCount) },
                    { label: t("duplicates"), value: String(preview.duplicates.length) },
                    { label: t("periodLabel"), value: preview.statementStartDate && preview.statementEndDate ? t("period", { start: preview.statementStartDate, end: preview.statementEndDate }) : "-" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-1 text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {preview.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{t("warnings")}</p>
                    <ul className="mt-1.5 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                      {preview.warnings.map((w) => <li key={w}>{bankImportWarning(t, w)}</li>)}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border overflow-hidden overflow-x-auto">
                  <div className="grid min-w-[320px] grid-cols-[90px_1fr_100px] gap-2 border-b bg-muted/30 px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("date")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("description")}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">{t("amount")}</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {preview.transactions.map((tx, i) => (
                      <div
                        key={`${tx.date}-${tx.description}-${i}`}
                        className={cn("grid min-w-[320px] grid-cols-[90px_1fr_100px] gap-2 px-3 py-2.5", i < preview.transactions.length - 1 && "border-b")}
                      >
                        <span className="text-xs text-muted-foreground">{tx.date}</span>
                        <p className="text-xs font-medium truncate">{tx.description}</p>
                        <span className={cn("text-right font-mono text-xs tabular-nums", tx.amount < 0 ? "text-red-600" : "text-emerald-600")}>
                          {formatMoney(tx.amount, currencyCode, unitPresentation)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 sm:gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button variant="outline" disabled={!canPreview || previewing} onClick={onPreview}>
            {previewing ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("previewing")}</> : t("preview")}
          </Button>
          <Button onClick={onImport} disabled={!canPreview || importing} className="bg-emerald-600 hover:bg-emerald-700">
            {importing ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("importing")}</> : t("import")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Match to Bill Sheet
// ---------------------------------------------------------------------------
export function MatchToBillSheet({
  transaction,
  onClose,
  bills,
  suggestions,
  loading,
  currencyCode,
  orgId,
  onMatched,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  bills: OpenBill[];
  suggestions: SuggestedMatch[];
  loading: boolean;
  currencyCode: string;
  orgId: string | null;
  onMatched: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [billSearch, setBillSearch] = useState("");

  useEffect(() => {
    if (transaction) {
      setSelectedBill(null);
      setPayAmount(bankUiDecimal(bankUiAbs(transaction.amount), currencyCode));
      setBillSearch("");
    }
  }, [transaction, currencyCode]);

  const suggestedBillIds = useMemo(
    () => new Set(suggestions.map((s) => s.candidate.id)),
    [suggestions]
  );

  const filteredBills = useMemo(() => {
    if (!billSearch) return bills;
    const q = billSearch.toLowerCase();
    return bills.filter(
      (b) =>
        b.billNumber.toLowerCase().includes(q) ||
        b.contactName.toLowerCase().includes(q)
    );
  }, [bills, billSearch]);

  async function handleMatch() {
    if (!orgId || !transaction || !selectedBill) return;
    setSaving(true);
    try {
      const { amountMinor } = bankUiMatchAmount(payAmount, currencyCode, transaction, bills.find(b => b.id === selectedBill)!);
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          billId: selectedBill,
          amountMinor,
          date: transaction.date,
        }),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(t("billLinked"));
      onMatched();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("billLinkFailed")));
    } finally {
      setSaving(false);
    }
  }

  const selected = bills.find((b) => b.id === selectedBill);

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("matchBillTitle")}</SheetTitle>
          <SheetDescription>
            {t("matchBillHint")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                  {formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("likelyMatches")}</p>
              <div className="space-y-1.5">
                {suggestions.map((s) => {
                  const b = bills.find((bill) => bill.id === s.candidate.id);
                  if (!b) return null;
                  return (
                    <button
                      key={s.candidate.id}
                      type="button"
                      onClick={() => { setSelectedBill(b.id); setPayAmount(bankUiDecimal(bankUiMin(bankUiAbs(transaction?.amount || 0n), b.amountDue), currencyCode)); }}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                        selectedBill === b.id && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{b.billNumber}</span>
                          <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {t("confidence", { percent: s.confidence })}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.contactName} · {t("dueOn", { date: b.dueDate })}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.reasons.map(reason => bankMatchReason(t, reason)).join(t("listSeparator"))}</p>
                      </div>
                      <span className="font-mono text-sm font-medium tabular-nums shrink-0 ml-3">
                        {formatMoney(b.amountDue, currencyCode, unitPresentation)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {suggestions.length > 0 ? t("allOpenBills") : t("openBills")}
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t("searchBills")}
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBills.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t("noOpenBills")}</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredBills.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => { setSelectedBill(b.id); setPayAmount(bankUiDecimal(bankUiMin(bankUiAbs(transaction?.amount || 0n), b.amountDue), currencyCode)); }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                      selectedBill === b.id && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
                      suggestedBillIds.has(b.id) && selectedBill !== b.id && "border-emerald-200 dark:border-emerald-900"
                    )}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{b.billNumber}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.contactName} · {t("dueOn", { date: b.dueDate })}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="font-mono text-sm font-medium tabular-nums">{formatMoney(b.amountDue, currencyCode, unitPresentation)}</span>
                      <p className="text-[10px] text-muted-foreground">{t("ofTotal", { amount: formatMoney(b.total, currencyCode, unitPresentation) })}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("paymentAmount")}</Label>
                <span className="text-[10px] text-muted-foreground">
                  {t("billDue", { amount: formatMoney(selected.amountDue, currencyCode, unitPresentation) })}
                </span>
              </div>
              <CurrencyInput
                prefix={currencyCode} fractionDigits={currencyMetadata(currencyCode).minorUnits} aria-label={t("amountInCurrency", { currency: currencyLabel(currencyCode, unitPresentation.locale) })}
                value={payAmount}
                onChange={setPayAmount}
              />
              <BankMatchPreview text={payAmount} currencyCode={currencyCode} transaction={transaction} document={selected} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={handleMatch}
            disabled={!selectedBill || saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("linkingDots")}</> : t("linkAndPay")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Create Expense Sheet
// ---------------------------------------------------------------------------
export function CreateExpenseSheet({
  transaction,
  onClose,
  currencyCode,
  orgId,
  onCreated,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  currencyCode: string;
  orgId: string | null;
  onCreated: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  const messages = t;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [taxRateId, setTaxRateId] = useState("none");
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [contactId, setContactId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setTitle(transaction.payee || transaction.description || "");
      setDescription("");
      setItemDesc(transaction.description || "");
      setItemAmount(bankUiDecimal(bankUiAbs(transaction.amount), currencyCode));
      setAccountId("");
      setTaxRateId("none");
      setContactId("");
      setCostCenterId("");
      setProjectId("");
    }
  }, [transaction, currencyCode]);

  useEffect(() => {
    if (!transaction || !orgId || taxRates.length > 0) return;
    fetch("/api/v1/tax-rates", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.taxRates) setTaxRates(data.taxRates); })
      .catch(() => {});
  }, [transaction, orgId, taxRates.length]);

  async function handleCreate() {
    if (!orgId || !transaction) return;
    if (!title.trim()) { toast.error(t("titleRequired")); return; }
    if (!accountId) { toast.error(t("expenseCategoryRequired")); return; }
    setSaving(true);
    try {
      const { amountMinor } = bankUiAmount(itemAmount, currencyCode);
      if (BigInt(amountMinor) !== bankUiAbs(transaction.amount)) throw new RangeError("Expense must equal the statement amount");
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/create-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          currencyCode,
          contactId: contactId || null,
          taxRateId: taxRateId === "none" ? null : taxRateId,
          costCenterId: costCenterId || null,
          projectId: projectId || null,
          items: [{
            date: transaction.date,
            description: itemDesc.trim() || title.trim(),
            amountMinor,
            accountId,
          }],
        }),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(t("expenseRecorded"));
      onCreated();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("expenseFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("expenseTitle")}</SheetTitle>
          <SheetDescription>
            {t("expenseHint")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                  {formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("title")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("officeSupplies")} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("descriptionOptional")}</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("expenseNotes")} />
            </div>

            <div className="h-px bg-border" />

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("expenseItem")}</p>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("itemDescription")}</Label>
              <Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder={t("purchasedHint")} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("amount")}</Label>
              <CurrencyInput prefix={currencyCode} fractionDigits={currencyMetadata(currencyCode).minorUnits} aria-label={t("amountInCurrency", { currency: currencyLabel(currencyCode, unitPresentation.locale) })} value={itemAmount} onChange={setItemAmount} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {t("category")}{" "}<span className="text-muted-foreground font-normal">{t("expenseKind")}</span>
              </Label>
              <AccountPicker
                value={accountId}
                onChange={setAccountId}
                typeFilter={["expense"]}
                placeholder={t("chooseExpenseCategory")}
                allowCreate
              />
              <p className="text-[11px] text-muted-foreground">
                {t("expenseCategoryHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("tax")}{" "}<span className="text-muted-foreground font-normal">{t("taxInclusive")}</span></Label>
              <Select value={taxRateId} onValueChange={setTaxRateId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noTax")}</SelectItem>
                  {taxRates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {taxOptionLabel(t, true, messages)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("paidWho")}</Label>
              <ContactPicker value={contactId} onChange={setContactId} placeholder={t("pickSupplier")} />
            </div>

            <TrackingPicker
              orgId={orgId}
              costCenterId={costCenterId}
              projectId={projectId}
              onChange={(v) => { setCostCenterId(v.costCenterId); setProjectId(v.projectId); }}
            />

            <div className="h-px bg-border" />

            <ReceiptAttachments orgId={orgId} entityType="bank_transaction" entityId={transaction?.id ?? null} />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !title.trim() || !accountId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("recordingDots")}</> : t("recordExpense")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Tax preview — mirrors the server's split so the user sees exactly what posts
// before confirming (the amount is tax-inclusive for bank lines).
// ---------------------------------------------------------------------------
export interface TaxRateOption {
  id: string;
  name: string;
  rate: number; // basis points
  kind?: string;
  recoverablePercent?: number;
}

// Plain label for a tax option in a dropdown, e.g. "VAT 20%". For money-OUT
// (purchase) contexts we also spell out how much can be claimed back, so users
// don't silently under-reclaim: "VAT 20% · fully reclaimable", "· 50%
// reclaimable", or "· not reclaimable" for blocked / US sales tax / 0%.
function taxOptionLabel(tax: TaxRateOption, isPurchase: boolean, t: WorkspaceTranslate): string {
  const pct = (tax.rate / 100).toFixed(tax.rate % 100 === 0 ? 0 : 2);
  const base = `${tax.name} (${pct}%)`;
  if (!isPurchase) return base;
  const kind = tax.kind || "standard";
  const recoverableBp = tax.recoverablePercent ?? 10000;
  if (kind === "blocked" || kind === "sales_tax_us" || recoverableBp <= 0) {
    return t("notReclaimable", { tax: base });
  }
  if (recoverableBp >= 10000) return t("fullyReclaimable", { tax: base });
  return t("partlyReclaimable", { tax: base, percent: Math.round(recoverableBp / 100) });
}

const splitTaxPreview = bankUiTax;

// ---------------------------------------------------------------------------
// Categorize Sheet — code a transaction to ANY ledger account: income,
// expense, a loan received/repaid, owner contribution/drawings, a transfer, etc.
// The account chosen determines the meaning; the double entry follows the sign.
// ---------------------------------------------------------------------------
export function CategorizeSheet({
  transaction,
  onClose,
  currencyCode,
  orgId,
  onCategorized,
  onSwitchToTransfer,
  onSwitchToSplit,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  currencyCode: string;
  orgId: string | null;
  onCategorized: () => void;
  /** Hand off to the "move money between my accounts" flow. */
  onSwitchToTransfer?: (transaction: Transaction) => void;
  /** Hand off to the "split one line across accounts" flow (e.g. loan repayment). */
  onSwitchToSplit?: (transaction: Transaction) => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  const messages = t;
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [memo, setMemo] = useState("");
  const [taxRateId, setTaxRateId] = useState("none");
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [costCenterId, setCostCenterId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  // Quick-choice ("what was this?") state.
  const [accounts, setAccounts] = useState<SpecialResolvableAccount[]>([]);
  const [isCompany, setIsCompany] = useState(false);
  const [choice, setChoice] = useState<string>("");
  const [pickerType, setPickerType] = useState<string[] | undefined>(undefined);
  const [choiceHint, setChoiceHint] = useState<string>("");

  const isCredit = (transaction?.amount ?? 0) > 0;
  // Editing an already-coded line vs. categorizing a fresh one. When editing we
  // pre-fill the category/tax/contact so the user can correct a mistake instead
  // of starting over; saving re-posts (the endpoint reverses the old entry).
  const isEditing = !!transaction?.journalEntryId;

  useEffect(() => {
    if (transaction) {
      setAccountId(transaction.accountId ?? "");
      setContactId(transaction.contactId ?? "");
      setMemo("");
      setTaxRateId(transaction.taxRateId ?? "none");
      setCostCenterId("");
      setProjectId("");
      setChoice("");
      setPickerType(undefined);
      setChoiceHint("");
    }
  }, [transaction, currencyCode]);

  // Load the org's accounts (also triggers the built-in category sync) and
  // whether it's an incorporated company, so the quick choices can resolve to
  // the right account behind the scenes.
  useEffect(() => {
    if (!transaction || !orgId) return;
    fetch("/api/v1/accounts", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.accounts) setAccounts(data.accounts); })
      .catch(() => {});
    fetch("/api/v1/organization", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => {
        const o = data?.organization ?? data ?? {};
        const t = `${o.legalEntityType ?? ""} ${o.businessType ?? ""}`.toLowerCase();
        setIsCompany(/ltd|limited|corp|\binc\b|company|gmbh|\bab\b|plc|llc|\boy\b|\bbv\b|sarl|srl|\bsa\b|\bag\b/.test(t));
      })
      .catch(() => {});
  }, [transaction, orgId]);

  useEffect(() => {
    if (!transaction || !orgId || taxRates.length > 0) return;
    fetch("/api/v1/tax-rates", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.taxRates) setTaxRates(data.taxRates); })
      .catch(() => {});
  }, [transaction, orgId, taxRates.length]);

  const selectedTax = taxRates.find((t) => t.id === taxRateId) || null;
  const taxPreview = useMemo(
    () => (selectedTax && transaction ? splitTaxPreview(bankUiAbs(transaction.amount), selectedTax, isCredit) : null),
    [selectedTax, transaction, isCredit]
  );

  // Plain-language "what was this?" quick choices. Each one either pre-picks the
  // right account (resolved per org so it works in every country), filters the
  // category list to the relevant type, or hands off to the transfer / split
  // flow. The double entry still follows from the sign of the amount, so the
  // same generic categorize endpoint posts all of them correctly.
  const quickChoices = useMemo(() => {
    const resolve = (role: SpecialCategoryRole) => resolveSpecialAccount(role, accounts);
    const ownerLoan = resolve("owner_director_loan");
    const capital = resolve("capital_introduced");
    const drawings = resolve("owner_drawings");
    const reimburse = resolve("reimbursements_payable");
    const taxPayable = resolve("tax_payable");

    const canonical = (
      key: string,
      label: string,
      account: SpecialResolvableAccount | null,
      opts?: { memo?: string; hint?: string },
    ) =>
      account
        ? [{
            key,
            label,
            onSelect: () => {
              setAccountId(account.id);
              setChoice(key);
              setPickerType(undefined);
              setChoiceHint(opts?.hint ?? t("goesTo", { code: account.code, account: account.name }));
              if (opts?.memo) setMemo((m) => m || opts.memo!);
            },
          }]
        : [];

    const guided = (key: string, label: string, types: string[], hint: string) => [{
      key,
      label,
      onSelect: () => {
        setChoice(key);
        setPickerType(types);
        setAccountId("");
        setChoiceHint(hint);
      },
    }];

    const handoff = (
      key: string,
      label: string,
      cb: ((t: Transaction) => void) | undefined,
    ) =>
      cb && transaction
        ? [{ key, label, onSelect: () => cb(transaction) }]
        : [];

    if (isCredit) {
      return [
        ...guided("sale", t("saleIncome"), ["revenue"], t("pickIncome")),
        ...canonical("capital_in", t("capitalIn"), capital, { hint: t("capitalHint") }),
        ...canonical("loan_in", t("ownerLoanIn"), ownerLoan, { memo: "Director's loan", hint: t("ownerLoanHint") }),
        ...guided("refund_in", t("refundCost"), ["expense"], t("refundHint")),
        ...handoff("transfer", t("ownAccounts"), onSwitchToTransfer),
      ];
    }

    return [
      ...guided("cost", t("businessCost"), ["expense"], t("pickExpense")),
      ...canonical("drawings", t("drawings"), drawings, { hint: t("drawingsHint") }),
      ...canonical("loan_repaid", t("ownerLoanRepaid"), ownerLoan, { memo: "Director's loan", hint: t("loanRepaidHint") }),
      ...canonical(
        "personal",
        t("personal"),
        isCompany ? ownerLoan : drawings,
        { hint: isCompany ? t("companyPersonalHint") : t("personalHint") },
      ),
      ...canonical("tax", t("paidTax"), taxPayable, { hint: t("paidTaxHint") }),
      ...canonical("reimburse", t("reimbursed"), reimburse, { hint: t("reimbursedHint") }),
      ...handoff("loan_split", t("loanSplit"), onSwitchToSplit),
      ...handoff("transfer", t("ownAccounts"), onSwitchToTransfer),
    ];
  }, [accounts, isCredit, isCompany, transaction, onSwitchToTransfer, onSwitchToSplit, t]);

  async function handleSave() {
    if (!orgId || !transaction) return;
    if (!accountId) { toast.error(t("categoryRequired")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          accountId,
          contactId: contactId || null,
          memo: memo.trim() || null,
          taxRateId: taxRateId === "none" ? null : taxRateId,
          costCenterId: costCenterId || null,
          projectId: projectId || null,
        }),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(isEditing ? t("categoryUpdated") : t("assigned"));
      onCategorized();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("assignFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{isEditing ? t("editCategory") : t("assignCategoryTitle")}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? t("editCategoryHint")
              : t(isCredit ? "assignIncomingHint" : "assignOutgoingHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className={cn("font-mono font-semibold", isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {isCredit ? "+" : ""}{formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("whatWasThis")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {quickChoices.map((c) => (
                  <Button
                    key={c.key}
                    type="button"
                    size="sm"
                    variant={choice === c.key ? "default" : "outline"}
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-normal",
                      choice === c.key && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                    onClick={c.onSelect}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("quickChoiceHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("category")}</Label>
              <AccountPicker
                value={accountId}
                onChange={(v) => { setAccountId(v); setChoice(""); }}
                typeFilter={pickerType}
                placeholder={t("searchCategory")}
                allowCreate
              />
              {choiceHint && (
                <p className="text-[11px] text-muted-foreground">{choiceHint}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("tax")}{" "}<span className="text-muted-foreground font-normal">{t("taxInclusive")}</span></Label>
            <Select value={taxRateId} onValueChange={setTaxRateId}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noTax")}</SelectItem>
                {taxRates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {taxOptionLabel(t, !isCredit, messages)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {taxPreview && (
              <div className="rounded-lg border bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                <div className="flex justify-between"><span>{t("net")}</span><span className="font-mono tabular-nums">{formatMoney(taxPreview.net, currencyCode, unitPresentation)}</span></div>
                {isCredit ? (
                  <div className="flex justify-between"><span>{t("outputTax")}</span><span className="font-mono tabular-nums">{formatMoney(taxPreview.tax, currencyCode, unitPresentation)}</span></div>
                ) : (
                  <>
                    {taxPreview.recoverable > 0 && (
                      <div className="flex justify-between"><span>{t("inputTax")}</span><span className="font-mono tabular-nums">{formatMoney(taxPreview.recoverable, currencyCode, unitPresentation)}</span></div>
                    )}
                    {taxPreview.absorbed > 0 && (
                      <div className="flex justify-between"><span>{t("absorbedTax")}</span><span className="font-mono tabular-nums">{formatMoney(taxPreview.absorbed, currencyCode, unitPresentation)}</span></div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("contactOptional")}</Label>
            <ContactPicker value={contactId} onChange={setContactId} placeholder={t("whoWith")} />
          </div>

          <TrackingPicker
            orgId={orgId}
            costCenterId={costCenterId}
            projectId={projectId}
            onChange={(v) => { setCostCenterId(v.costCenterId); setProjectId(v.projectId); }}
          />

          <div className="space-y-1.5">
            <Label className="text-xs">{t("memoOptional")}</Label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("recordsNote")} />
          </div>

          <ReceiptAttachments orgId={orgId} entityType="bank_transaction" entityId={transaction?.id ?? null} />
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !accountId} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("saving")}</> : isEditing ? t("saveChanges") : t("assignCategory")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Match to Invoice Sheet — link an incoming transaction to an open invoice
// (records the received payment + posts DR Bank / CR Accounts Receivable).
// ---------------------------------------------------------------------------
export interface OpenInvoice {
  currencyCode: string;
  id: string;
  invoiceNumber: string;
  contactName: string;
  dueDate: string;
  total: bigint;
  amountDue: bigint;
  status: string;
}

export function MatchToInvoiceSheet({
  transaction,
  onClose,
  invoices,
  suggestions,
  loading,
  currencyCode,
  orgId,
  onMatched,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  invoices: OpenInvoice[];
  suggestions: SuggestedMatch[];
  loading: boolean;
  currencyCode: string;
  orgId: string | null;
  onMatched: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (transaction) {
      setSelectedInvoice(null);
      setPayAmount(bankUiDecimal(bankUiAbs(transaction.amount), currencyCode));
      setSearch("");
    }
  }, [transaction, currencyCode]);

  const suggestedIds = useMemo(
    () => new Set(suggestions.map((s) => s.candidate.id)),
    [suggestions]
  );

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.contactName.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  async function handleMatch() {
    if (!orgId || !transaction || !selectedInvoice) return;
    setSaving(true);
    try {
      const { amountMinor } = bankUiMatchAmount(payAmount, currencyCode, transaction, invoices.find(inv => inv.id === selectedInvoice)!);
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/match-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ invoiceId: selectedInvoice, amountMinor, date: transaction.date }),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(t("invoiceLinked"));
      onMatched();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("invoiceLinkFailed")));
    } finally {
      setSaving(false);
    }
  }

  const selected = invoices.find((inv) => inv.id === selectedInvoice);

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("matchInvoiceTitle")}</SheetTitle>
          <SheetDescription>
            {t("matchInvoiceHint")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("likelyMatches")}</p>
              <div className="space-y-1.5">
                {suggestions.map((s) => {
                  const inv = invoices.find((i) => i.id === s.candidate.id);
                  if (!inv) return null;
                  return (
                    <button
                      key={s.candidate.id}
                      type="button"
                      onClick={() => { setSelectedInvoice(inv.id); setPayAmount(bankUiDecimal(bankUiMin(bankUiAbs(transaction?.amount || 0n), inv.amountDue), currencyCode)); }}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                        selectedInvoice === inv.id && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                          <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {t("confidence", { percent: s.confidence })}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{inv.contactName} · {t("dueOn", { date: inv.dueDate })}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.reasons.map(reason => bankMatchReason(t, reason)).join(t("listSeparator"))}</p>
                      </div>
                      <span className="font-mono text-sm font-medium tabular-nums shrink-0 ml-3">
                        {formatMoney(inv.amountDue, currencyCode, unitPresentation)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {suggestions.length > 0 ? t("allOpenInvoices") : t("openInvoices")}
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t("searchInvoices")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{t("noOpenInvoices")}</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filtered.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => { setSelectedInvoice(inv.id); setPayAmount(bankUiDecimal(bankUiMin(bankUiAbs(transaction?.amount || 0n), inv.amountDue), currencyCode)); }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                      selectedInvoice === inv.id && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
                      suggestedIds.has(inv.id) && selectedInvoice !== inv.id && "border-emerald-200 dark:border-emerald-900"
                    )}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{inv.contactName} · {t("dueOn", { date: inv.dueDate })}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="font-mono text-sm font-medium tabular-nums">{formatMoney(inv.amountDue, currencyCode, unitPresentation)}</span>
                      <p className="text-[10px] text-muted-foreground">{t("ofTotal", { amount: formatMoney(inv.total, currencyCode, unitPresentation) })}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("amountReceived")}</Label>
                <span className="text-[10px] text-muted-foreground">
                  {t("invoiceDue", { amount: formatMoney(selected.amountDue, currencyCode, unitPresentation) })}
                </span>
              </div>
              <CurrencyInput prefix={currencyCode} fractionDigits={currencyMetadata(currencyCode).minorUnits} aria-label={t("amountInCurrency", { currency: currencyLabel(currencyCode, unitPresentation.locale) })} value={payAmount} onChange={setPayAmount} />
              <BankMatchPreview text={payAmount} currencyCode={currencyCode} transaction={transaction} document={selected} />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={handleMatch}
            disabled={!selectedInvoice || saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("linkingDots")}</> : t("linkAndPay")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Find & Match Sheet — the unified "match this line to an existing record"
// surface. Surfaces ranked suggestions across:
//   • open invoices / bills (records a NEW payment + JE),
//   • already-recorded payments on this bank (links, no new JE),
//   • already-posted journal entries hitting the bank (links, no new JE),
//   • a transfer leg in another own account (links, no new JE).
// All go through POST …/match with a `matchType` discriminator.
// ---------------------------------------------------------------------------
function existingTypeMeta(t: WorkspaceTranslate): Record<
  ExistingMatch["candidate"]["type"],
  { label: string; className: string }
> { return {
  existing_payment: {
    label: t("existingPayment"),
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  existing_journal: {
    label: t("alreadyInBooks"),
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  transfer: {
    label: t("transfer"),
    className: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  },
};

}

export function MatchSheet({
  transaction,
  onClose,
  invoices,
  bills,
  documentSuggestions,
  existingMatches,
  loading,
  currencyCode,
  orgId,
  onMatched,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  invoices: OpenInvoice[];
  bills: OpenBill[];
  documentSuggestions: SuggestedMatch[];
  existingMatches: ExistingMatch[];
  loading: boolean;
  currencyCode: string;
  orgId: string | null;
  onMatched: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  // A unified selection: either an existing record, or an open document.
  type Selection =
    | { kind: "existing"; match: ExistingMatch }
    | { kind: "invoice"; doc: OpenInvoice }
    | { kind: "bill"; doc: OpenBill };
  const [selection, setSelection] = useState<Selection | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const isCredit = (transaction?.amount ?? 0) > 0;

  useEffect(() => {
    if (transaction) {
      setSelection(null);
      setPayAmount(bankUiDecimal(bankUiAbs(transaction.amount), currencyCode));
      setSearch("");
    }
  }, [transaction, currencyCode]);

  const docList = isCredit ? invoices : bills;
  const filteredDocs = useMemo(() => {
    if (!search) return docList;
    const q = search.toLowerCase();
    return docList.filter((d) => {
      const num = isCredit ? (d as OpenInvoice).invoiceNumber : (d as OpenBill).billNumber;
      return num.toLowerCase().includes(q) || d.contactName.toLowerCase().includes(q);
    });
  }, [docList, search, isCredit]);

  async function handleMatch() {
    if (!orgId || !transaction || !selection) return;
    setSaving(true);
    try {
      let body: Record<string, unknown>;
      if (selection.kind === "existing") {
        const c = selection.match.candidate;
        if (c.type === "existing_payment") {
          body = { matchType: "existing_payment", paymentId: c.id };
        } else {
          // existing_journal and transfer leg both link an already-posted JE.
          body = { matchType: "existing_journal", journalEntryId: c.journalEntryId };
        }
      } else {
        const { amountMinor } = bankUiMatchAmount(payAmount, currencyCode, transaction, selection.doc);
        body = selection.kind === "invoice"
          ? { matchType: "invoice", invoiceId: selection.doc.id, amountMinor, date: transaction.date }
          : { matchType: "bill", billId: selection.doc.id, amountMinor, date: transaction.date };
      }
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(body),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(t("linked"));
      onMatched();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("linkFailed")));
    } finally {
      setSaving(false);
    }
  }

  const needsAmount = selection?.kind === "invoice" || selection?.kind === "bill";

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("findMatch")}</SheetTitle>
          <SheetDescription>
            {t(isCredit ? "matchIncomingHint" : "matchOutgoingHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className={cn("font-mono font-semibold", isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {isCredit ? "+" : ""}{formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {existingMatches.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("alreadyInBooks")}</p>
                  <div className="space-y-1.5">
                    {existingMatches.map((m) => {
                      const meta = existingTypeMeta(t)[m.candidate.type];
                      const isSelected = selection?.kind === "existing" && selection.match.candidate.id === m.candidate.id && selection.match.candidate.type === m.candidate.type;
                      return (
                        <button
                          key={`${m.candidate.type}-${m.candidate.id}`}
                          type="button"
                          onClick={() => setSelection({ kind: "existing", match: m })}
                          className={cn(
                            "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                            isSelected && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
                              <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {t("confidence", { percent: m.confidence })}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate mt-1">{m.candidate.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{m.candidate.date} · {m.reasons.map(reason => bankMatchReason(t, reason)).join(t("listSeparator"))}</p>
                          </div>
                          <span className="font-mono text-sm font-medium tabular-nums shrink-0 ml-3">
                            {formatMoney(m.candidate.amount, currencyCode, unitPresentation)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {t("noDuplicateHint")}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {t(isCredit ? "openInvoices" : "openBills")}
                </p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder={t(isCredit ? "searchInvoices" : "searchBills")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                {filteredDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">{t(isCredit ? "noOpenInvoices" : "noOpenBills")}</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {filteredDocs.map((d) => {
                      const num = isCredit ? (d as OpenInvoice).invoiceNumber : (d as OpenBill).billNumber;
                      const suggested = documentSuggestions.find((s) => s.candidate.id === d.id);
                      const isSelected = (selection?.kind === "invoice" || selection?.kind === "bill") && selection.doc.id === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            setSelection(isCredit ? { kind: "invoice", doc: d as OpenInvoice } : { kind: "bill", doc: d as OpenBill });
                            setPayAmount(bankUiDecimal(bankUiMin(bankUiAbs(transaction?.amount || 0n), d.amountDue), currencyCode));
                          }}
                          className={cn(
                            "w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                            isSelected && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
                            suggested && !isSelected && "border-emerald-200 dark:border-emerald-900"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{num}</span>
                              {suggested && (
                                <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  {t("confidence", { percent: suggested.confidence })}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{d.contactName} · {t("dueOn", { date: d.dueDate })}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="font-mono text-sm font-medium tabular-nums">{formatMoney(d.amountDue, currencyCode, unitPresentation)}</span>
                            <p className="text-[10px] text-muted-foreground">{t("ofTotal", { amount: formatMoney(d.total, currencyCode, unitPresentation) })}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {needsAmount && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="text-xs">{isCredit ? t("amountReceived") : t("paymentAmount")}</Label>
                  <CurrencyInput prefix={currencyCode} fractionDigits={currencyMetadata(currencyCode).minorUnits} aria-label={t("amountInCurrency", { currency: currencyLabel(currencyCode, unitPresentation.locale) })} value={payAmount} onChange={setPayAmount} />
                  <BankMatchPreview text={payAmount} currencyCode={currencyCode} transaction={transaction} document={selection?.doc} />
                </div>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={handleMatch} disabled={!selection || saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("linking")}</> : t("link")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Transfer Sheet — record this line as a transfer between two of the org's
// own bank accounts. Optionally pin the matching statement line in the other
// account (otherwise a mirror line is created). Posts DR/CR bank ↔ bank.
// ---------------------------------------------------------------------------
export function TransferSheet({
  transaction,
  onClose,
  bankAccounts,
  currentBankAccountId,
  currencyCode,
  orgId,
  onTransferred,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  bankAccounts: BankAccountSummary[];
  currentBankAccountId: string;
  currencyCode: string;
  orgId: string | null;
  onTransferred: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  const [targetId, setTargetId] = useState("");
  const [counterTx, setCounterTx] = useState<string | null>(null);
  const [counterCandidates, setCounterCandidates] = useState<Transaction[]>([]);
  const [loadingCounters, setLoadingCounters] = useState(false);
  const [saving, setSaving] = useState(false);

  const isCredit = (transaction?.amount ?? 0) > 0;

  const targets = useMemo(
    () => bankAccounts.filter((b) => b.id !== currentBankAccountId && b.currencyCode === currencyCode),
    [bankAccounts, currentBankAccountId, currencyCode]
  );

  useEffect(() => {
    if (transaction) {
      setTargetId("");
      setCounterTx(null);
      setCounterCandidates([]);
    }
  }, [transaction, currencyCode]);

  // When a target account is chosen, look for an unreconciled statement line in
  // it with the opposite sign + equal magnitude to suggest as the counter line.
  useEffect(() => {
    if (!targetId || !orgId || !transaction) { setCounterCandidates([]); setCounterTx(null); return; }
    setLoadingCounters(true);
    setCounterTx(null);
    fetch(`/api/v1/bank-accounts/${targetId}/transactions?status=unreconciled&limit=100`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        const want = -transaction.amount;
        const candidates = (data.data ?? []).map((t: Record<string, unknown>) => bankUiTransaction(t, currencyCode) as unknown as Transaction).filter((t: Transaction) => t.amount === want);
        setCounterCandidates(candidates);
      })
      .catch(() => setCounterCandidates([]))
      .finally(() => setLoadingCounters(false));
  }, [targetId, orgId, transaction, currencyCode]);

  async function handleTransfer() {
    if (!orgId || !transaction || !targetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/match-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ targetBankAccountId: targetId, counterTransactionId: counterTx }),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(counterTx ? t("transferLinked") : t("transferRecorded"));
      onTransferred();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("transferFailed")));
    } finally {
      setSaving(false);
    }
  }

  const selectedTarget = targets.find((t) => t.id === targetId);

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("recordTransferTitle")}</SheetTitle>
          <SheetDescription>
            {t(isCredit ? "transferIncomingHint" : "transferOutgoingHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className={cn("font-mono font-semibold", isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {isCredit ? "+" : ""}{formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{isCredit ? t("transferredFrom") : t("transferredTo")}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("chooseBank")} /></SelectTrigger>
              <SelectContent>
                {targets.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">{t("noOtherBanks")}</div>
                ) : (
                  targets.map((target) => (
                    <SelectItem key={target.id} value={target.id} disabled={!target.hasLedgerAccount}>
                      {target.accountName}
                      {target.bankName ? ` · ${target.bankName}` : ""}
                      {!target.hasLedgerAccount ? t("notSetupSuffix") : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedTarget && !selectedTarget.hasLedgerAccount && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {t("setupFirst")}</p>
            )}
          </div>

          {targetId && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("counterLine")}</Label>
              {loadingCounters ? (
                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> {t("lookingForMatch")}</div>
              ) : counterCandidates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t("mirrorHint")}</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {counterCandidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCounterTx(counterTx === c.id ? null : c.id)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/50",
                        counterTx === c.id && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.date}</p>
                      </div>
                      <span className="font-mono text-xs font-medium tabular-nums shrink-0 ml-3">
                        {formatMoney(c.amount, currencyCode, unitPresentation)}
                      </span>
                    </button>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    {t("counterHint")}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button
            onClick={handleTransfer}
            disabled={!targetId || saving || (selectedTarget && !selectedTarget.hasLedgerAccount)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("recording")}</> : t("recordTransfer")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Split Account Sheet — code one bank line across multiple GL accounts. Each
// allocation is tax-inclusive; the sum must equal the absolute tx amount.
// ---------------------------------------------------------------------------
interface SplitAllocationDraft {
  key: string;
  accountId: string;
  amount: string; // decimal string
  taxRateId: string; // "none" or id
  memo: string;
}

let splitKeySeq = 0;
function newSplitRow(amount = ""): SplitAllocationDraft {
  return { key: `split-${splitKeySeq++}`, accountId: "", amount, taxRateId: "none", memo: "" };
}

export function SplitAccountSheet({
  transaction,
  onClose,
  currencyCode,
  orgId,
  onSplit,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  currencyCode: string;
  orgId: string | null;
  onSplit: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  const messages = t;
  const [rows, setRows] = useState<SplitAllocationDraft[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [saving, setSaving] = useState(false);

  const isCredit = (transaction?.amount ?? 0) > 0;
  const totalCents = bankUiAbs(transaction?.amount ?? 0n);

  useEffect(() => {
    if (transaction) {
      // Seed with the whole amount on the first row + one empty row to split into.
      setRows([newSplitRow(bankUiDecimal(bankUiAbs(transaction.amount), currencyCode)), newSplitRow()]);
    }
  }, [transaction, currencyCode]);

  useEffect(() => {
    if (!transaction || !orgId || taxRates.length > 0) return;
    fetch("/api/v1/tax-rates", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.taxRates) setTaxRates(data.taxRates); })
      .catch(() => {});
  }, [transaction, orgId, taxRates.length]);

  const splitPreview = useMemo(() => {
    try {
      const amounts = rows.filter(r => r.amount).map(r => BigInt(bankUiAmount(r.amount, currencyCode).amountMinor));
      return { total: amounts.reduce((sum, value) => sum + value, 0n), valid: true };
    } catch { return { total: 0n, valid: false }; }
  }, [rows, currencyCode]);
  const allocatedCents = splitPreview.total;
  const remainingCents = totalCents - allocatedCents;
  const balanced = splitPreview.valid && remainingCents === 0n;

  function updateRow(key: string, patch: Partial<SplitAllocationDraft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function addRow() {
    // Pre-fill the new row with the outstanding remainder, if any.
    setRows((prev) => [...prev, newSplitRow(remainingCents > 0 ? bankUiDecimal(remainingCents, currencyCode) : "")]);
  }

  async function handleSave() {
    if (!orgId || !transaction) return;
    let allocations: ReturnType<typeof bankUiSplit>;
    try { allocations = bankUiSplit(rows, currencyCode, transaction.amount); }
    catch (error) { toast.error(bankWorkspaceFailure(error, t, t("invalidSplit"))); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/bank-transactions/${transaction.id}/split-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ allocations }),
      });
      await requireBankAccountResponse(res, errors, t("requestFailed"));
      toast.success(t("splitRecorded"));
      onSplit();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("splitFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("splitCategories")}</SheetTitle>
          <SheetDescription>
            {t(isCredit ? "splitIncomingHint" : "splitOutgoingHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-5">
          {transaction && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">{t("bankTransaction")}</p>
              <p className="text-sm font-medium">{transaction.description}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span>{transaction.date}</span>
                <span className={cn("font-mono font-semibold", isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {isCredit ? "+" : ""}{formatMoney(transaction.amount, currencyCode, unitPresentation)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={row.key} className="rounded-lg border p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("partNumber", { count: i + 1 })}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("category")}</Label>
                  <AccountPicker value={row.accountId} onChange={(v) => updateRow(row.key, { accountId: v })} placeholder={t("chooseCategory")} allowCreate />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("amount")}</Label>
                    <CurrencyInput prefix={currencyCode} fractionDigits={currencyMetadata(currencyCode).minorUnits} aria-label={t("amountInCurrency", { currency: currencyLabel(currencyCode, unitPresentation.locale) })} value={row.amount} onChange={(v) => updateRow(row.key, { amount: v })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("tax")}</Label>
                    <Select value={row.taxRateId} onValueChange={(v) => updateRow(row.key, { taxRateId: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("noTax")}</SelectItem>
                        {taxRates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {taxOptionLabel(t, !isCredit, messages)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("memoOptional")}</Label>
                  <Input value={row.memo} onChange={(e) => updateRow(row.key, { memo: e.target.value })} placeholder={t("partNote")} className="h-8 text-sm" />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addRow} className="w-full">
              <Plus className="mr-1.5 size-3.5" />{t("addPart")}</Button>
          </div>

          <div className={cn(
            "flex items-center justify-between rounded-lg border p-3 text-sm",
            balanced ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
          )}>
            <div>
              <p className="text-xs text-muted-foreground">{t("allocated")}</p>
              <p className="font-mono font-medium tabular-nums">{t("allocatedOf", { amount: splitPreview.valid ? formatMoney(allocatedCents, currencyCode, unitPresentation) : t("enterValidAmounts"), total: formatMoney(totalCents, currencyCode, unitPresentation) })}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{remainingCents >= 0 ? t("remaining") : t("overBy")}</p>
              <p className={cn("font-mono font-medium tabular-nums", balanced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                {splitPreview.valid ? formatMoney(bankUiAbs(remainingCents), currencyCode, unitPresentation) : t("unavailable")}
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          <ReceiptAttachments orgId={orgId} entityType="bank_transaction" entityId={transaction?.id ?? null} />
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !balanced} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("saving")}</> : t("saveSplit")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Cash Coding Grid — a spreadsheet-style view to code many uncategorized lines
// at once. Each row gets an account / tax / contact + optional memo; "fill
// down" copies the first set row's account+tax+contact to every empty row.
// Posts via POST /api/v1/bulk/bank-transactions/categorize.
// ---------------------------------------------------------------------------
interface CashCodingRow {
  account: string;
  taxRateId: string; // "none" | id
  contact: string;
  memo: string;
}

export function CashCodingGrid({
  transactions,
  currencyCode,
  orgId,
  onDone,
}: {
  transactions: Transaction[];
  currencyCode: string;
  orgId: string | null;
  onDone: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankWorkspace");
  const errors = useTranslations("BankAccountErrors");
  // Only lines that still need coding (no journal entry yet, not excluded).
  const codeable = useMemo(
    () => transactions.filter((t) => !t.journalEntryId && t.status !== "excluded"),
    [transactions]
  );

  const [rows, setRows] = useState<Record<string, CashCodingRow>>({});
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId || taxRates.length > 0) return;
    fetch("/api/v1/tax-rates", { headers: { "x-organization-id": orgId } })
      .then((r) => r.json())
      .then((data) => { if (data.taxRates) setTaxRates(data.taxRates); })
      .catch(() => {});
  }, [orgId, taxRates.length]);

  function rowFor(id: string): CashCodingRow {
    return rows[id] || { account: "", taxRateId: "none", contact: "", memo: "" };
  }
  function updateRow(id: string, patch: Partial<CashCodingRow>) {
    setRows((prev) => ({ ...prev, [id]: { ...rowFor(id), ...patch } }));
  }

  // Copy the first coded row's account/tax/contact into every row that has no
  // account chosen yet — the classic "fill down" cash-coding shortcut.
  function fillDown() {
    const firstCoded = codeable.find((t) => rowFor(t.id).account);
    if (!firstCoded) { toast.error(t("firstCategory")); return; }
    const src = rowFor(firstCoded.id);
    setRows((prev) => {
      const next = { ...prev };
      for (const t of codeable) {
        const cur = next[t.id] || { account: "", taxRateId: "none", contact: "", memo: "" };
        if (!cur.account) {
          next[t.id] = { ...cur, account: src.account, taxRateId: src.taxRateId, contact: src.contact };
        }
      }
      return next;
    });
  }

  const readyIds = useMemo(
    () => codeable.filter((t) => rowFor(t.id).account).map((t) => t.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [codeable, rows]
  );

  async function handleSave() {
    if (!orgId || readyIds.length === 0) return;
    setSaving(true);
    try {
      const items = readyIds.map((id) => {
        const r = rowFor(id);
        return {
          transactionId: id,
          accountId: r.account,
          contactId: r.contact || null,
          taxRateId: r.taxRateId === "none" ? null : r.taxRateId,
          memo: r.memo.trim() || null,
        };
      });
      const res = await fetch("/api/v1/bulk/bank-transactions/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ items }),
      });
      await requireBankAccountResponse(res, errors, t("codeFailed"));
      const data = await res.json();
      const { succeeded, failed } = data.summary || { succeeded: 0, failed: 0 };
      if (failed > 0) {
        toast.warning(t("assignedWithFailures", { count: succeeded, failed }));
      } else {
        toast.success(t("assignedCount", { count: succeeded }));
      }
      setRows({});
      onDone();
    } catch (err) {
      toast.error(bankWorkspaceFailure(err, t, t("bulkAssignFailed")));
    } finally {
      setSaving(false);
    }
  }

  if (codeable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
        <CheckCircle className="size-8 text-emerald-500" />
        <p className="text-sm text-muted-foreground">{t("allAssigned")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">
          {t("linesToAssign", { count: codeable.length })}
          {readyIds.length > 0 && <> · <span className="text-emerald-600 dark:text-emerald-400">{t("readyCount", { count: readyIds.length })}</span></>}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fillDown} title={t("fillDownHint")}>
            <ArrowDownRight className="mr-1.5 size-3.5" />{t("fillDown")}</Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || readyIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />{t("saving")}</> : <>{t("assignCount", { count: readyIds.length || "" })}</>}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[150px_minmax(0,1fr)_220px_150px_180px] gap-2 border-b bg-muted/30 px-3 py-2">
          {[t("transaction"), t("amount"), t("category"), t("tax"), t("contact")].map((h) => (
            <span key={h} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</span>
          ))}
        </div>
        <div className="divide-y">
          {codeable.map((tx) => {
            const r = rowFor(tx.id);
            const isCredit = tx.amount > 0;
            return (
              <div key={tx.id} className="grid min-w-[900px] grid-cols-[150px_minmax(0,1fr)_220px_150px_180px] items-center gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" title={tx.description}>{tx.description}</p>
                  <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                </div>
                <span className={cn(
                  "font-mono text-xs font-medium tabular-nums",
                  isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  {isCredit ? "+" : ""}{formatMoney(tx.amount, currencyCode, unitPresentation)}
                </span>
                <AccountPicker value={r.account} onChange={(v) => updateRow(tx.id, { account: v })} placeholder={t("categoryPlaceholder")} />
                <Select value={r.taxRateId} onValueChange={(v) => updateRow(tx.id, { taxRateId: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noTax")}</SelectItem>
                    {taxRates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({(t.rate / 100).toFixed(t.rate % 100 === 0 ? 0 : 2)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ContactPicker value={r.contact} onChange={(v) => updateRow(tx.id, { contact: v })} placeholder={t("contactPlaceholder")} />
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {t("gridHint")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reconciliation Report — statement end balance vs GL balance with a running
// difference, the reconciled / unreconciled splits, and a write-off Adjustment
// action to clear a residual difference. Reads GET …/reconciliation; the
// Adjustment posts via POST …/reconciliation { action: "adjustment" }.
// ---------------------------------------------------------------------------
export interface ReconciliationData {
  bankAccountId: string;
  reconciliation: {
    id: string;
    startDate: string;
    endDate: string;
    startBalance: bigint;
    endBalance: bigint;
    status: string;
  } | null;
  currencyCode: string;
  glCurrencyCode: string;
  comparisonUnavailableReason: string | null;
  statementEndBalance: bigint;
  glBalance: bigint | null;
  difference: bigint | null;
  differenceMinor: string | null;
  isBalanced: boolean;
  hasLedgerAccount: boolean;
  reconciled: { count: number; total: bigint; transactions: Transaction[] };
  unreconciled: { count: number; total: bigint; transactions: Transaction[] };
}

export function ReconciliationReport({
  data,
  currencyCode,
  orgId,
  bankAccountId,
  onChanged,
}: {
  data: ReconciliationData;
  currencyCode: string;
  orgId: string | null;
  bankAccountId: string;
  onChanged: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("BankReconciliation");
  const errors = useTranslations("BankAccountErrors");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDesc, setAdjustDesc] = useState("");
  const [posting, setPosting] = useState(false);

  const diff = data.difference;
  const balanced = data.isBalanced;

  async function postAdjustment() {
    if (!orgId || diff == null || diff === 0n || data.reconciliation?.status === "completed") return;
    setPosting(true);
    try {
      const res = await fetch(`/api/v1/bank-accounts/${bankAccountId}/reconciliation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          action: "adjustment",
          amountMinor: data.differenceMinor,
          date: data.reconciliation?.endDate || new Date().toISOString().slice(0, 10),
          description: adjustDesc.trim() || "Reconciliation adjustment",
          reconciliationId: data.reconciliation?.id,
        }),
      });
      await requireReconciliationResponse(res, t, errors, t("adjustFailed"));
      toast.success(t("adjustSuccess"));
      setAdjustOpen(false);
      setAdjustDesc("");
      onChanged();
    } catch (err) {
      toast.error(reconciliationFailure(err, t, t("adjustFailed")));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("statementBalance")}</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">{bankMoneyDisplay(data.statementEndBalance, currencyCode, unitPresentation)}</p>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("booksBalance")}</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">
              {data.glBalance == null ? "—" : bankMoneyDisplay(data.glBalance, data.glCurrencyCode, unitPresentation)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t("difference")}</p>
            <p className={cn(
              "mt-1 text-xl font-semibold font-mono tabular-nums",
              diff == null ? "text-muted-foreground" : balanced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            )}>
              {diff == null ? "—" : bankMoneyDisplay(diff, currencyCode, unitPresentation)}
            </p>
          </div>
        </div>
        <div className={cn(
          "flex flex-wrap items-center gap-2 border-t px-4 py-2.5",
          balanced ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-amber-50/50 dark:bg-amber-950/20"
        )}>
          {!data.hasLedgerAccount ? (
            <span className="text-xs text-muted-foreground">{t("noLedger")}</span>
          ) : data.comparisonUnavailableReason === "different_currency_units" ? (
            <span className="text-xs text-muted-foreground">{t("differentCurrencies")}</span>
          ) : balanced ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="size-3.5" />{t("balanced")}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Scale className="size-3.5" />
                {diff != null && diff > 0
                  ? t("statementMore")
                  : t("booksMore")}
              </span>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)} disabled={diff == null || diff === 0n || data.reconciliation?.status === "completed"} title={t("adjustTitle")}>
                <Scale className="mr-1.5 size-3.5" />{t("writeOff")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("matchedToStatement")}</span>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {data.reconciled.count} · {bankMoneyDisplay(data.reconciled.total, currencyCode, unitPresentation)}
            </span>
          </div>
          <RecLineList transactions={data.reconciled.transactions} currencyCode={currencyCode} empty={t("noMatched")} />
        </div>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("notMatched")}</span>
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {data.unreconciled.count} · {bankMoneyDisplay(data.unreconciled.total, currencyCode, unitPresentation)}
            </span>
          </div>
          <RecLineList transactions={data.unreconciled.transactions} currencyCode={currencyCode} empty={t("noUnmatched")} />
        </div>
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("writeOff")}</DialogTitle>
            <DialogDescription>
              {t("adjustHint")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("adjustAmount")}</span>
                <span className={cn(
                  "font-mono font-semibold tabular-nums",
                  diff != null && diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  {diff != null ? bankMoneyDisplay(diff, currencyCode, unitPresentation) : "—"}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {diff != null && diff > 0
                  ? t("incomeHint")
                  : t("expenseHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("description")}</Label>
              <Input value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} placeholder={t("descriptionPlaceholder")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>{t("cancel")}</Button>
            <Button onClick={postAdjustment} disabled={posting || diff == null || diff === 0n || data.reconciliation?.status === "completed"} className="bg-emerald-600 hover:bg-emerald-700">
              {posting ? <><Loader2 className="mr-2 size-3.5 animate-spin" />{t("saving")}</> : t("writeOff")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecLineList({
  transactions,
  currencyCode,
  empty,
}: {
  transactions: Transaction[];
  currencyCode: string;
  empty: string;
}) {
  const unitPresentation = usePresentation();
  if (transactions.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="max-h-72 divide-y overflow-y-auto">
      {transactions.map((tx) => {
        const isCredit = tx.amount > 0;
        return (
          <div key={tx.id} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{tx.description}</p>
              <p className="text-[10px] text-muted-foreground">{tx.date}{tx.accountName ? ` · ${tx.accountName}` : ""}</p>
            </div>
            <span className={cn(
              "font-mono text-xs font-medium tabular-nums shrink-0",
              isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {isCredit ? "+" : ""}{bankMoneyDisplay(tx.amount, currencyCode, unitPresentation)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
