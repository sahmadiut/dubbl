"use client";
import { useTranslations } from "next-intl";
import { journalPreviewMessage, type JournalTranslate, requireJournalResponse, journalFailureMessage } from "@/i18n/journal-presentation";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  Trash2,
  BookOpen,
  Calendar,
  Hash,
  FileText,
  Clock,
  AlertTriangle,
  Pencil,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { currencyMetadata } from "@/lib/money/exact";
import { coreJournalDetail } from "@/lib/money/core-presentation";
import { journalRestMinor, journalStoredMinor, journalMoney, journalDecimal, journalEditorPreview, journalSideDisplay } from "@/lib/money/journal-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import Link from "next/link";

interface Line {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  debitAmount: string;
  creditAmount: string;
  debitAmountMinor: string;
  creditAmountMinor: string;
  currencyCode: string;
  amountCurrencyCode: string;
  exchangeRate: number;
  costCenterId: string | null;
  projectId: string | null;
}

interface Entry {
  id: string;
  entryNumber: number;
  date: string;
  description: string;
  reference: string | null;
  status: "draft" | "posted" | "void";
  sourceType: string | null;
  sourceId: string | null;
  createdBy: string | null;
  postedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  lines: Line[];
  fiscalYearId: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimestamp(ts: string, t: JournalTranslate) {
  const d = new Date(ts);
  return t("timestamp", { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
}

export default function EntryDetailPage() {
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const sourceTypeLabels: Record<string, string> = {
    manual: t("manualSource"),
    invoice: t("invoiceSource"),
    bill: t("billSource"),
    payment: t("paymentSource"),
    expense: t("expenseSource"),
    bank: t("bankSource"),
    credit_note: t("creditNoteSource"),
    debit_note: t("debitNoteSource"),
    depreciation: t("depreciationSource"),
    year_end_close: t("yearEndSource"),
    opening_balance: t("openingSource"),
  };

  const statusConfig: Record<string, { class: string; label: string; bg: string }> = {
    draft: {
      class: "",
      label: t("draftStatus"),
      bg: "bg-gray-500",
    },
    posted: {
      class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      label: t("postedStatus"),
      bg: "bg-emerald-500",
    },
    void: {
      class: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
      label: t("cancelledStatus"),
      bg: "bg-red-500",
    },
  };

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("detailDocumentTitle"));
  useEntityTitle(entry ? `JE-${entry.entryNumber}` : undefined);

  function loadEntry() {
    if (!orgId) return;
    fetch(`/api/v1/entries/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => (await requireJournalResponse(r, errors, t("loadFailed"))).json())
      .then((data) => {
        setEntry(coreJournalDetail(data.entry));
        setError(null);
      })
      .catch((error) => { setEntry(null); setError(journalFailureMessage(error, t("loadFailed"))); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId]);

  async function postEntry() {
    if (!orgId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/entries/${id}/post`, {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      await requireJournalResponse(res, errors, t("postFailed"));
      loadEntry();
      toast.success(t("postedSuccess"));
    } catch (err) {
      toast.error(journalFailureMessage(err, t("postFailed")));
    } finally {
      setActionLoading(false);
    }
  }

  async function voidEntry() {
    if (!orgId || !voidReason) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/entries/${id}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ reason: voidReason }),
      });
      await requireJournalResponse(res, errors, t("voidFailed"));
      loadEntry();
      setVoidReason("");
      toast.success(t("voidSuccess"));
    } catch (err) {
      toast.error(journalFailureMessage(err, t("voidFailed")));
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteEntry() {
    if (!orgId) return;
    await confirm({
      title: t("deleteEntryTitle"),
      description: t("deleteEntryDescription"),
      confirmLabel: t("deleteEntry"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/entries/${id}`, {
            method: "DELETE",
            headers: { "x-organization-id": orgId },
          });
          await requireJournalResponse(res, errors, t("deleteFailed"));
          toast.success(t("deleteSuccess"));
          router.push("/accounting");
        } catch (error) {
          toast.error(journalFailureMessage(error, t("deleteFailed")));
          throw error;
        }
      },
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="size-8 p-0">
          <Link href="/accounting"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <FileText className="size-10 text-muted-foreground" />
          <p role="alert" className="text-sm text-muted-foreground">{error ?? t("missingEntry")}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/accounting">{t("backTransactions")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sc = statusConfig[entry.status] || statusConfig.draft;

  const savedLines = entry.lines.map(line => ({ ...line,
    currencyCode: line.amountCurrencyCode,
    debitAmountMinor: String(journalRestMinor(line.debitAmount, line.debitAmountMinor)),
    creditAmountMinor: String(journalRestMinor(line.creditAmount, line.creditAmountMinor)),
  }));
  const totalDebit = savedLines.reduce((sum, line) => sum + journalStoredMinor(line.debitAmountMinor), 0n);
  const totalCredit = savedLines.reduce((sum, line) => sum + journalStoredMinor(line.creditAmountMinor), 0n);
  const isBalanced = totalDebit === totalCredit;

  return (
    <ContentReveal>
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="size-8 p-0">
              <Link href="/accounting"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight">
                  {t("entryTitle", { number: entry.entryNumber })}
                </h1>
                <Badge variant="outline" className={sc.class}>{sc.label}</Badge>
                {entry.voidedAt && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{t("reversed")}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {entry.description}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {entry.status === "draft" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  disabled={actionLoading}
                  title={t("editHint")}
                >
                  <Pencil className="mr-2 size-4" />{t("edit")}</Button>
                <Button
                  size="sm"
                  onClick={postEntry}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  title={t("finalizeHint")}
                >
                  <Check className="mr-2 size-4" />{t("finalize")}</Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteEntry}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 size-4" />{t("delete")}</Button>
              </>
            )}
            {entry.status === "posted" && !entry.voidedAt && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    title={t("reverseHint")}
                  >
                    <X className="mr-2 size-4" />{t("voidAction")}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("voidTitle", { number: entry.entryNumber })}</DialogTitle>
                    <DialogDescription>{t("voidDescription")}</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder={t("voidReason")}
                    rows={3}
                  />
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={voidEntry}
                      disabled={!voidReason.trim() || actionLoading}
                    >
                      {actionLoading ? t("cancelling") : t("cancelEntry")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Void reason alert */}
        {entry.voidReason && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{t("voidSuccess")}</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">{entry.voidReason}</p>
            </div>
          </div>
        )}

        {/* Entry document card */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Header with meta info */}
          <div className="border-b bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Left: Entry info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Hash className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t("entryNumber")}</span>
                  <span className="text-sm font-mono font-semibold">{entry.entryNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t("date")}</span>
                  <span className="text-sm">{formatDate(entry.date)}</span>
                </div>
                {entry.reference && (
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t("reference")}</span>
                    <span className="text-sm">{entry.reference}</span>
                  </div>
                )}
              </div>

              {/* Right: Source & timestamps */}
              <div className="sm:text-right space-y-3">
                {entry.sourceType && (
                  <div className="flex sm:justify-end items-center gap-2">
                    <BookOpen className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t("source")}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {Object.hasOwn(sourceTypeLabels, entry.sourceType) ? sourceTypeLabels[entry.sourceType] : entry.sourceType}
                    </Badge>
                  </div>
                )}
                {entry.postedAt && (
                  <div className="flex sm:justify-end items-center gap-2">
                    <Check className="size-3.5 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">{t("finalized")}</span>
                    <span className="text-sm">{formatTimestamp(entry.postedAt, t)}</span>
                  </div>
                )}
                {entry.voidedAt && (
                  <div className="flex sm:justify-end items-center gap-2">
                    <X className="size-3.5 text-red-500" />
                    <span className="text-xs text-muted-foreground">{t("cancelled")}</span>
                    <span className="text-sm">{formatTimestamp(entry.voidedAt, t)}</span>
                  </div>
                )}
                {!entry.postedAt && !entry.voidedAt && entry.createdAt && (
                  <div className="flex sm:justify-end items-center gap-2">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t("created")}</span>
                    <span className="text-sm">{formatTimestamp(entry.createdAt, t)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Journal lines table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("account")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("description")}</th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-32">{t("debit")}</th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-32">{t("credit")}</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line, i) => {
                  const debit = journalRestMinor(line.debitAmount, line.debitAmountMinor);
                  const credit = journalRestMinor(line.creditAmount, line.creditAmountMinor);
                  return (
                    <tr
                      key={line.id}
                      className={cn(
                        i < entry.lines.length - 1 ? "border-b border-dashed" : "",
                        entry.status === "void" && "opacity-50"
                      )}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {line.accountCode}
                          </span>
                          <span className="font-medium">{line.accountName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {line.description || "-"}
                      </td>
                      <td className="px-6 py-3 text-right font-mono tabular-nums">
                        {debit > 0n ? (
                          <span className="font-medium">{journalMoney(debit, line.amountCurrencyCode)}</span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-mono tabular-nums">
                        {credit > 0n ? (
                          <span className="font-medium">{journalMoney(credit, line.amountCurrencyCode)}</span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals footer */}
          <div className="border-t bg-muted/10 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("totalDebits")}</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {journalSideDisplay(savedLines, "debitAmountMinor")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("totalCredits")}</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {journalSideDisplay(savedLines, "creditAmountMinor")}
                  </span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("difference")}</span>
                  <span className={cn(
                    "font-mono tabular-nums font-semibold",
                    isBalanced
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}>
                    {journalSideDisplay(savedLines, "difference")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details cards row */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Entry details */}
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("entryDetails")}</p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t("description")}</p>
                <p className="text-sm mt-0.5">{entry.description}</p>
              </div>
              {entry.reference && (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("reference")}</p>
                  <p className="text-sm mt-0.5">{entry.reference}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground">{t("date")}</p>
                <p className="text-sm mt-0.5">{formatDate(entry.date)}</p>
              </div>
            </div>
          </div>

          {/* Audit trail */}
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("auditTrail")}</p>
            <div className="space-y-3">
              {entry.sourceType && (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("source")}</p>
                  <p className="text-sm mt-0.5">
                    {sourceTypeLabels[entry.sourceType] || entry.sourceType}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground">{t("created")}</p>
                <p className="text-sm mt-0.5">{formatTimestamp(entry.createdAt, t)}</p>
              </div>
              {entry.postedAt && (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("finalized")}</p>
                  <p className="text-sm mt-0.5">{formatTimestamp(entry.postedAt, t)}</p>
                </div>
              )}
              {entry.voidedAt && (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t("cancelled")}</p>
                  <p className="text-sm mt-0.5">{formatTimestamp(entry.voidedAt, t)}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-muted-foreground">{t("lines")}</p>
                <p className="text-sm mt-0.5">
                  {t("lineSummary", { count: entry.lines.length, debits: entry.lines.filter((l) => journalRestMinor(l.debitAmount, l.debitAmountMinor) > 0n).length, credits: entry.lines.filter((l) => journalRestMinor(l.creditAmount, l.creditAmountMinor) > 0n).length })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {entry.status === "draft" && (
          <EditEntrySheet
            open={editOpen}
            onClose={() => setEditOpen(false)}
            entry={entry}
            orgId={orgId}
            onSaved={() => { setEditOpen(false); loadEntry(); }}
          />
        )}

        {confirmDialog}
      </div>
    </ContentReveal>
  );
}

// ---------------------------------------------------------------------------
// Edit draft entry — full header + line replace (PUT /api/v1/entries/[id]).
// ---------------------------------------------------------------------------
interface EditLine {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
  currencyCode?: string;
  exchangeRate?: number;
  costCenterId?: string | null;
  projectId?: string | null;
}

function EditEntrySheet({
  open,
  onClose,
  entry,
  orgId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  entry: Entry;
  orgId: string | null;
  onSaved: () => void;
}) {
  const t = useTranslations("Journals");
  const errors = useTranslations("JournalErrors");
  const [date, setDate] = useState(entry.date);
  const [description, setDescription] = useState(entry.description);
  const [reference, setReference] = useState(entry.reference ?? "");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(entry.date);
      setDescription(entry.description);
      setReference(entry.reference ?? "");
      setLines(
        entry.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description ?? "",
          debit: journalRestMinor(l.debitAmount, l.debitAmountMinor) > 0n ? journalDecimal(journalRestMinor(l.debitAmount, l.debitAmountMinor), l.currencyCode) : "",
          credit: journalRestMinor(l.creditAmount, l.creditAmountMinor) > 0n ? journalDecimal(journalRestMinor(l.creditAmount, l.creditAmountMinor), l.currencyCode) : "",
          currencyCode: l.currencyCode, exchangeRate: l.exchangeRate, costCenterId: l.costCenterId, projectId: l.projectId,
        }))
      );
    }
  }, [open, entry]);

  function update(i: number, patch: Partial<EditLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { accountId: "", description: "", debit: "", credit: "",
      currencyCode: prev[0]?.currencyCode ?? "USD", exchangeRate: prev[0]?.exchangeRate ?? 1000000 }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const preview = journalEditorPreview(lines);
  const balanced = preview.isBalanced;

  async function save() {
    if (!orgId) return;
    if (!description.trim()) { toast.error(t("addDescription")); return; }
    if (preview.error) { toast.error(journalPreviewMessage(t, preview.error)); return; }
    if (!balanced) { toast.error(t("balancedLines")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          date,
          description: description.trim(),
          reference: reference.trim() || null,
          fiscalYearId: entry.fiscalYearId,
          lines: preview.lines,
        }),
      });
      await requireJournalResponse(res, errors, t("updateFailed"));
      toast.success(t("updated"));
      onSaved();
    } catch (err) {
      toast.error(journalFailureMessage(err, t("updateFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-4 sm:px-6 border-b shrink-0">
          <SheetTitle className="text-lg">{t("editTitle", { number: entry.entryNumber })}</SheetTitle>
          <SheetDescription>{t("editDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("referenceOptional")}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("adjustmentExample")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("entryPurpose")} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("lines")}</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addLine}>
                <Plus className="mr-1 size-3.5" />{t("addLine")}</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-start">
                <div className="space-y-1">
                  <AccountPicker value={l.accountId} onChange={(v) => update(i, { accountId: v })} allowCreate />
                  <Input
                    value={l.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder={t("lineNote")}
                    className="h-7 text-xs"
                  />
                </div>
                <CurrencyInput
                  prefix={l.currencyCode ?? "USD"}
                  fractionDigits={currencyMetadata(l.currencyCode ?? "USD").minorUnits}
                  aria-label={t("debitLine", { number: i + 1 })}
                  value={l.debit}
                  onChange={(v) => update(i, { debit: v, credit: v ? "" : l.credit })}
                  placeholder={t("debit")}
                />
                <CurrencyInput
                  prefix={l.currencyCode ?? "USD"}
                  fractionDigits={currencyMetadata(l.currencyCode ?? "USD").minorUnits}
                  aria-label={t("creditLine", { number: i + 1 })}
                  value={l.credit}
                  onChange={(v) => update(i, { credit: v, debit: v ? "" : l.debit })}
                  placeholder={t("credit")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-red-600"
                  onClick={() => removeLine(i)}
                  aria-label={t("removeLine", { number: i + 1 })}
                  disabled={lines.length <= 2}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          {preview.error && <p role="alert" className="text-xs text-red-600">{journalPreviewMessage(t, preview.error)}</p>}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("totalDebitsLower")}</span><span className="font-mono tabular-nums">{journalSideDisplay(preview.lines, "debitAmountMinor")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("totalCreditsLower")}</span><span className="font-mono tabular-nums">{journalSideDisplay(preview.lines, "creditAmountMinor")}</span></div>
            <div className="mt-1 flex justify-between border-t pt-1">
              <span className="text-muted-foreground">{t("difference")}</span>
              <span className={cn("font-mono tabular-nums font-semibold", balanced ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {journalSideDisplay(preview.lines, "difference")}
              </span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background/80 px-4 py-3 sm:px-6 backdrop-blur-sm shrink-0">
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button onClick={save} disabled={saving || !balanced} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? t("savingEllipsis") : t("saveChanges")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
