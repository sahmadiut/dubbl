"use client";
import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { localeDirection } from "@/i18n/locale";
import { usePresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";
import { useTranslations } from "next-intl";
import { expenseStatusLabel, expenseInputError, type ExpenseErrorKey } from "@/i18n/expense-presentation";


import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  DollarSign,
  Trash2,
  FileText,
  Pencil,
  Plus,
  Image as ImageIcon,
  Download,
  Loader2,
  Receipt,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExpenseAmountInput } from "@/components/dashboard/expense-amount-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { FileUploader } from "@/components/dashboard/file-uploader";
import { AccountPicker } from "@/components/dashboard/account-picker";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { expenseEditorItems, expenseEditorPreview, expenseUiDecimal, expenseUiMinor, expenseUiMoney, expenseUiDocument, expenseDistanceText } from "@/lib/money/expense-ui";
import Link from "next/link";

interface ExpenseDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  totalAmount: number;
  currencyCode: string;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  paidAt: string | null;
  submittedByUser: { name: string | null; email: string } | null;
  approvedByUser: { name: string | null; email: string } | null;
  items: {
    id: string;
    date: string;
    description: string;
    amount: number;
    amountMinor?: string;
    mileageRate: number | null;
    mileageRateMinor?: string | null;
    distanceMiles: number | null;
    isMileage: boolean;
    accountId: string | null;
    category: string | null;
    receiptFileKey: string | null;
    receiptFileName: string | null;
    account: { code: string; name: string } | null;
  }[];
}

interface EditItem {
  id?: string;
  date: string;
  description: string;
  amount: string;
  category: string;
  accountId: string;
  receiptFileKey: string;
  receiptFileName: string;
}

const statusConfig: Record<string, { class: string; dot: string }> = {
  draft: { class: "", dot: "bg-gray-400" },
  submitted: {
    class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  approved: {
    class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  rejected: {
    class: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
  },
  paid: {
    class: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
    dot: "bg-purple-500",
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ReceiptViewer({ fileKey, fileName }: { fileKey: string; fileName: string }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("Expenses");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUrl = useCallback(async () => {
    if (url) return;
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/expenses/receipt-url?fileKey=${encodeURIComponent(fileKey)}`, {
        headers: { "x-organization-id": orgId },
      });
      const data = await res.json();
      if (!res.ok || typeof data.downloadUrl !== "string" || !data.downloadUrl) throw new Error("Invalid receipt response");
      setUrl(data.downloadUrl);
    } catch {
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }, [fileKey, url]);

  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadUrl(); }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 transition-colors group">
          {isImage ? <ImageIcon className="size-3.5" /> : <FileText className="size-3.5" />}
          <span className="max-w-[100px] truncate text-xs group-hover:underline"><BidiText>{fileName}</BidiText></span>
        </button>
      </DialogTrigger>
      <DialogContent dir={localeDirection(unitPresentation.locale)} className="sm:max-w-2xl max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            <BidiText>{fileName}</BidiText>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <div className="space-y-3">
              {isImage ? (
                <div className="rounded-lg border overflow-hidden bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={fileName} className="w-full h-auto max-h-[60vh] object-contain" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 rounded-lg border bg-muted/30">
                  <FileText className="size-12 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">{t("previewUnavailable")}</p>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer" download={fileName}>
                    <Download className="me-2 size-3.5" />
                    {t("download")}</a>
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("receiptFailed")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Drawer helper components (matching create-drawer.tsx pattern)
// ---------------------------------------------------------------------------

function DrawerIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function DrawerFooter({
  onClose,
  saving,
  label,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
}) {
  const t = useTranslations("Expenses");
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
      <Button type="button" variant="outline" onClick={onClose}>
        {t("cancel")}</Button>
      <Button
        type="submit"
        disabled={saving}
        className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700"
      >
        {saving ? t("saving") : label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Expense Drawer
// ---------------------------------------------------------------------------

function EditExpenseDrawer({
  open,
  onClose,
  claim,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  claim: ExpenseDetail;
  onSaved: () => void;
}) {
  const unitPresentation = usePresentation();
  const t = useTranslations("Expenses");
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(claim.title);
  const [editDescription, setEditDescription] = useState(claim.description || "");
  const [editItems, setEditItems] = useState<EditItem[]>(() => claim.items.map(item => ({
    id: item.id, date: item.date, description: item.description,
    amount: expenseUiDecimal(expenseUiMinor(item, "amount"), claim.currencyCode),
    category: item.category || "", accountId: item.accountId || "",
    receiptFileKey: item.receiptFileKey || "", receiptFileName: item.receiptFileName || "",
  })));

  function updateEditItem(index: number, updates: Partial<EditItem>) {
    setEditItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  }

  function addEditItem() {
    setEditItems((prev) => [
      ...prev,
      { date: new Date().toISOString().split("T")[0], description: "", amount: "", category: "", accountId: "", receiptFileKey: "", receiptFileName: "" },
    ]);
  }

  function removeEditItem(index: number) {
    if (editItems.length <= 1) return;
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  const preview = expenseEditorPreview(editItems, claim.currencyCode);
  const editTotal = preview.error ? "—" : expenseUiMoney(preview.total, claim.currencyCode, unitPresentation);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !editTitle.trim()) {
      toast.error(t("titleRequiredError"));
      return;
    }
    if (editItems.some((item) => !item.description.trim() || !item.amount)) {
      toast.error(t("itemsRequiredError"));
      return;
    }

    try {
      let payload;
      try { payload = expenseEditorItems(editItems, claim.currencyCode); }
      catch (error) { toast.error(t(expenseInputError(error))); return; }
      setSaving(true);
      const res = await fetch(`/api/v1/expenses/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          items: payload.items,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      toast.success(t("updated"));
      onClose();
      onSaved();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent dir={localeDirection(unitPresentation.locale)} className="sm:max-w-3xl w-full max-h-dvh p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <DrawerIcon><Receipt className="size-5" /></DrawerIcon>
            <div>
              <SheetTitle className="text-lg">{t("editClaim")}</SheetTitle>
              <SheetDescription>{t("editDescription")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <SectionLabel>{t("claimInfo")}</SectionLabel>
              <p className="text-sm text-muted-foreground"><BidiText>{t("editCurrency", { currency: currencyLabel(claim.currencyCode, unitPresentation.locale) })}</BidiText></p>
              {preview.error && <p role="alert" className="text-sm text-destructive">{t(expenseInputError(preview.error))}</p>}
              <div className="space-y-2">
                <Label htmlFor="rtl040-editTitle">{t("titleRequired")}</Label>
                <Input id="rtl040-editTitle" dir="auto" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rtl040-editDescription">{t("itemDescription")}</Label>
                <Textarea id="rtl040-editDescription" dir="auto" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionLabel>{t("expenseItems")}</SectionLabel>
                <Button type="button" variant="outline" size="sm" onClick={addEditItem}>
                  <Plus className="me-2 size-3.5" />{t("addItem")}</Button>
              </div>
              <div className="space-y-4">
                {editItems.map((item, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground"><BidiText>{t("itemNumber", { number: index + 1 })}</BidiText></span>
                      {editItems.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" aria-label={t("removeItem", { number: index + 1 })} onClick={() => removeEditItem(index)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label className="text-xs" htmlFor={`expense-item-date-${index}`}>{t("date")}</Label>
                        <Input id={`expense-item-date-${index}`} dir="ltr" type="date" value={item.date} onChange={(e) => updateEditItem(index, { date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs" htmlFor={`expense-item-description-${index}`}>{t("descriptionRequired")}</Label>
                        <Input id={`expense-item-description-${index}`} dir="auto" value={item.description} onChange={(e) => updateEditItem(index, { description: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("amountRequired")}</Label>
                        <ExpenseAmountInput currency={claim.currencyCode} label={t("itemAmount", { number: index + 1 })} value={item.amount} onChange={(v) => updateEditItem(index, { amount: v })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs" htmlFor={`expense-item-category-${index}`}>{t("category")}</Label>
                        <Input id={`expense-item-category-${index}`} dir="auto" value={item.category} onChange={(e) => updateEditItem(index, { category: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">{t("account")}</Label>
                        <AccountPicker value={item.accountId} onChange={(val) => updateEditItem(index, { accountId: val })} typeFilter={["expense"]} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("receipt")}</Label>
                        {item.receiptFileName ? (
                          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                            <FileText className="size-4 text-emerald-600 shrink-0" />
                            <span className="text-xs truncate flex-1"><BidiText>{item.receiptFileName}</BidiText></span>
                            <button type="button" aria-label={t("removeReceipt")} onClick={() => updateEditItem(index, { receiptFileKey: "", receiptFileName: "" })} className="text-muted-foreground hover:text-foreground">
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <FileUploader accept="image/*,.pdf" onUpload={(fileKey, fileName) => updateEditItem(index, { receiptFileKey: fileKey, receiptFileName: fileName })} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">{t("total")}</span>
              <span className="text-lg font-bold [overflow-wrap:anywhere] font-mono tabular-nums"><BidiText>{editTotal}</BidiText></span>
            </div>
          </div>
          <DrawerFooter onClose={onClose} saving={saving} label={t("saveChanges")} />
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  return <ExpenseDetailWorkspace key={`${orgId}-${id}`} id={id} />;
}

function ExpenseDetailWorkspace({ id }: { id: string }) {
  const unitPresentation = usePresentation();
  const t = useTranslations("Expenses");
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [claim, setClaim] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ExpenseErrorKey | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useDocumentTitle(t("detailDocumentTitle"));
  useEntityTitle(claim?.title);

  const loadClaim = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/v1/expenses/${id}`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load expense claim"); return data; })
      .then(data => { setClaim(expenseUiDocument(data.expenseClaim)); setLoadError(null); })
      .catch(() => { setClaim(null); setLoadError("detailFailed"); })
      .finally(() => setLoading(false));
  }, [id, orgId]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  async function runAction(action: "submit" | "reverse" | "recall" | "approve" | "reject" | "pay" | "delete", body?: object) {
    if (!orgId) return false;
    const failures = { submit: "submitFailed", reverse: "reverseFailed", recall: "recallFailed", approve: "approveFailed", reject: "rejectFailed", pay: "payFailed", delete: "deleteFailed" } as const;
    const successes = { submit: "submittedSuccess", reverse: "reversedSuccess", recall: "recalledSuccess", approve: "approvedSuccess", reject: "rejectedSuccess", pay: "paidSuccess", delete: "deletedSuccess" } as const;
    try {
      const res = await fetch(`/api/v1/expenses/${id}${action === "delete" ? "" : "/" + action}`, {
        method: action === "delete" ? "DELETE" : "POST",
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), "x-organization-id": orgId },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) throw new Error("Expense operation failed");
      toast.success(t(successes[action]));
      if (action !== "delete") loadClaim();
      return true;
    } catch {
      toast.error(t(failures[action]));
      return false;
    }
  }

  async function handleSubmit() { await runAction("submit"); }
  async function handleRecall() { await runAction("recall"); }
  async function handleApprove() { await runAction("approve"); }
  async function handleReverse() {
    if (!orgId) return;
    if (await confirm({ title: t("reverseTitle"), description: t("reverseDescription"), confirmLabel: t("reverse"), destructive: true })) await runAction("reverse");
  }
  async function handleReject() {
    if (!orgId) return;
    if (!rejectReason.trim()) { toast.error(t("reasonRequiredError")); return; }
    if (await runAction("reject", { reason: rejectReason })) { setRejectOpen(false); setRejectReason(""); }
  }
  async function handlePay() {
    if (await runAction("pay", { date: payDate })) setPayOpen(false);
  }
  async function handleDelete() {
    if (!orgId) return;
    if (await confirm({ title: t("deleteTitle"), description: t("deleteDescription"), confirmLabel: t("delete"), destructive: true }) && await runAction("delete")) router.push("/purchases/expenses");
  }

  if (loading) return <BrandLoader />;

  if (!claim) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p role={loadError ? "alert" : undefined} className="text-sm text-muted-foreground">{loadError ? t(loadError) : t("notFound")}</p>
        <Button variant="ghost" size="sm" asChild className="h-auto whitespace-normal mt-2">
          <Link href="/purchases/expenses">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  const sc = statusConfig[claim.status] || statusConfig.draft;

  return (
    <ContentReveal>
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="h-auto whitespace-normal size-8 p-0" aria-label={t("back")}>
              <Link href="/purchases/expenses"><ArrowLeft className="size-4 rtl:rotate-180" /></Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg font-semibold tracking-tight"><BidiText>{claim.title}</BidiText></h1>
                <Badge variant="outline" className={sc.class}><BidiText>{expenseStatusLabel(t, claim.status)}</BidiText></Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                <BidiText>{claim.submittedByUser?.name || claim.submittedByUser?.email || t("unknown")}</BidiText>
                {claim.submittedAt && <span><BidiText>{t("submittedMeta", { date: formatDate(claim.submittedAt) })}</BidiText></span>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {claim.status === "draft" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="me-2 size-3.5" />{t("edit")}</Button>
                <Button size="sm" onClick={handleSubmit} className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700">
                  <Send className="me-2 size-3.5" />{t("submit")}</Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="h-auto whitespace-normal text-red-600 hover:text-red-700">
                  <Trash2 className="me-2 size-3.5" />{t("delete")}</Button>
              </>
            )}
            {claim.status === "submitted" && (
              <>
                <Button variant="outline" size="sm" onClick={handleRecall} title={t("recallHint")}>
                  <Undo2 className="me-2 size-3.5" />{t("recall")}</Button>
                <Button size="sm" onClick={handleApprove} className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700">
                  <Check className="me-2 size-3.5" />{t("approve")}</Button>
                <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-auto whitespace-normal text-red-600">
                      <X className="me-2 size-3.5" />{t("reject")}</Button>
                  </DialogTrigger>
                  <DialogContent dir={localeDirection(unitPresentation.locale)} className="max-h-dvh overflow-y-auto">
                    <DialogHeader><DialogTitle>{t("rejectClaim")}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="rtl040-rejectReason">{t("reasonRequired")}</Label>
                        <Textarea id="rtl040-rejectReason" dir="auto" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder={t("reasonPlaceholder")} />
                      </div>
                      <Button onClick={handleReject} className="h-auto whitespace-normal w-full bg-red-600 hover:bg-red-700">{t("rejectClaim")}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {claim.status === "approved" && (
              <Button variant="outline" size="sm" onClick={handleReverse} className="h-auto whitespace-normal text-red-600 hover:text-red-700" title={t("reverseApprovalHint")}>
                <Undo2 className="me-2 size-3.5" />{t("reverse")}</Button>
            )}
            {claim.status === "paid" && (
              <Button variant="outline" size="sm" onClick={handleReverse} className="h-auto whitespace-normal text-red-600 hover:text-red-700" title={t("reversePaymentHint")}>
                <Undo2 className="me-2 size-3.5" />{t("reverse")}</Button>
            )}
            {claim.status === "approved" && (
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700">
                    <DollarSign className="me-2 size-3.5" />{t("markPaid")}</Button>
                </DialogTrigger>
                <DialogContent dir={localeDirection(unitPresentation.locale)} className="max-h-dvh overflow-y-auto">
                  <DialogHeader><DialogTitle>{t("markPaid")}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">{t("totalAmount")}</p>
                      <p className="text-xl font-bold [overflow-wrap:anywhere] font-mono"><BidiText>{expenseUiMoney(expenseUiMinor(claim, "totalAmount"), claim.currencyCode, unitPresentation)}</BidiText></p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rtl040-payDate">{t("paymentDate")}</Label>
                      <Input id="rtl040-payDate" dir="ltr" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                    <Button onClick={handlePay} className="h-auto whitespace-normal w-full bg-emerald-600 hover:bg-emerald-700">{t("confirmPayment")}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {claim.status === "rejected" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="me-2 size-3.5" />{t("edit")}</Button>
                <Button size="sm" onClick={handleSubmit} className="h-auto whitespace-normal bg-emerald-600 hover:bg-emerald-700" title={t("resubmitHint")}>
                  <Send className="me-2 size-3.5" />{t("resubmit")}</Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="h-auto whitespace-normal text-red-600 hover:text-red-700">
                  <Trash2 className="me-2 size-3.5" />{t("delete")}</Button>
              </>
            )}
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-emerald-500/20 via-border to-transparent" />

        {/* Timeline / status info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span><BidiText>{t("createdDate", { date: formatDate(claim.createdAt) })}</BidiText></span>
          {claim.submittedAt && <span><BidiText>{t("submittedDate", { date: formatDate(claim.submittedAt) })}</BidiText></span>}
          {claim.approvedAt && (
            <span><BidiText>{claim.approvedByUser ? t("approvedByDate", { date: formatDate(claim.approvedAt), user: claim.approvedByUser.name || claim.approvedByUser.email }) : t("approvedDate", { date: formatDate(claim.approvedAt) })}</BidiText></span>
          )}
          {claim.paidAt && <span><BidiText>{t("paidDate", { date: formatDate(claim.paidAt) })}</BidiText></span>}
        </div>

        {claim.status === "rejected" && claim.rejectionReason && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-4">
            <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">{t("rejectionReason")}</p>
            <p className="text-sm text-red-600 dark:text-red-400"><BidiText>{claim.rejectionReason}</BidiText></p>
          </div>
        )}

        {claim.description && (
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-1">{t("itemDescription")}</p>
            <p className="text-sm"><BidiText>{claim.description}</BidiText></p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("totalAmount")}</p>
            <p className="mt-1 text-xl font-bold [overflow-wrap:anywhere] font-mono tabular-nums"><BidiText>{expenseUiMoney(expenseUiMinor(claim, "totalAmount"), claim.currencyCode, unitPresentation)}</BidiText></p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("items")}</p>
            <p className="mt-1 text-xl font-bold [overflow-wrap:anywhere] font-mono tabular-nums"><BidiText>{claim.items.length}</BidiText></p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("currency")}</p>
            <p className="mt-1 text-xl font-bold"><BidiText>{currencyLabel(claim.currencyCode, unitPresentation.locale)}</BidiText></p>
          </div>
        </div>

        {/* View mode - expense items table */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="grid min-w-[580px] grid-cols-[100px_1fr_100px_140px_100px] gap-2 border-b bg-muted/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t("date")}</span>
              <span>{t("itemDescription")}</span>
              <span>{t("category")}</span>
              <span>{t("receipt")}</span>
              <span className="text-end">{t("amount")}</span>
            </div>
            {claim.items.map((item) => (
              <div key={item.id} className="grid min-w-[580px] grid-cols-[100px_1fr_100px_140px_100px] gap-2 border-b px-4 py-3 last:border-b-0 hover:bg-muted/30 transition-colors">
                <span className="text-sm tabular-nums"><IdentifierText>{item.date}</IdentifierText></span>
                <div>
                  <p className="text-sm font-medium"><BidiText>{item.description}</BidiText></p>
                  {item.isMileage && item.distanceMiles !== null && item.mileageRate !== null && <p className="text-xs text-muted-foreground"><BidiText>{t("mileageDetail", { distance: expenseDistanceText(item.distanceMiles), rate: expenseUiMoney(expenseUiMinor(item, "mileageRate"), claim.currencyCode, unitPresentation) })}</BidiText></p>}
                  {item.account && (
                    <p className="text-xs text-muted-foreground"><IdentifierText>{item.account.code}</IdentifierText> · <BidiText>{item.account.name}</BidiText></p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground"><BidiText>{item.category || "-"}</BidiText></span>
                <span>
                  {item.receiptFileKey && item.receiptFileName ? (
                    <ReceiptViewer fileKey={item.receiptFileKey} fileName={item.receiptFileName} />
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </span>
                <span className="text-end text-sm font-mono font-medium tabular-nums">
                  <BidiText>{expenseUiMoney(expenseUiMinor(item, "amount"), claim.currencyCode, unitPresentation)}</BidiText>
                </span>
              </div>
            ))}
            {/* Total row */}
            <div className="grid min-w-[580px] grid-cols-[100px_1fr_100px_140px_100px] gap-2 bg-muted/50 px-4 py-3">
              <span />
              <span />
              <span />
              <span className="text-sm font-semibold">{t("total")}</span>
              <span className="text-end text-sm font-mono font-bold tabular-nums">
                <BidiText>{expenseUiMoney(expenseUiMinor(claim, "totalAmount"), claim.currencyCode, unitPresentation)}</BidiText>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Expense Drawer */}
      {editOpen && <EditExpenseDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        claim={claim}
        onSaved={loadClaim}
      />}

      {confirmDialog}
    </ContentReveal>
  );
}
