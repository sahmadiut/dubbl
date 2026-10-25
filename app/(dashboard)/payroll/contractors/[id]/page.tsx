"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollContractorJson, type ContractorDetail } from "@/i18n/payroll-contractor-presentation";

import { payrollCentsInput, payrollCentsDecimal } from "@/lib/money/payroll-input";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Briefcase, Plus, Play, Trash2 } from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { CurrencySelect } from "@/components/ui/currency-select";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  void: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export default function ContractorDetailPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollContractors");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<"readFailed" | "organizationRequired" | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Edit form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  // New payment
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDesc, setPaymentDesc] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("");
  const requestScope = useRef({ active: true });

  let orgId: string | null = null;
  let storageFailed = false;
  try { if (typeof window !== "undefined") orgId = localStorage.getItem("activeOrgId"); } catch { storageFailed = true; }
  useDocumentTitle(t("detailTitle"));

  async function fetchContractor(ignore?: () => boolean, initial = false) {
    const scope = requestScope.current;
    const ignored = ignore ?? (() => !scope.active);
    if (!orgId) {
      if (!ignored()) { setMoneyError(storageFailed ? "readFailed" : "organizationRequired"); setLoading(false); }
      return;
    }
    try {
      const response = await fetch(`/api/v1/payroll/contractors/${id}`, { headers: { "x-organization-id": orgId } });
      if (initial && response.status === 404) { if (!ignored()) setContractor(null); return; }
      const { contractor: c } = await payrollContractorJson(response, "detail");
      if (ignored()) return;
      setMoneyError(null);
      setContractor(c);
      if (initial) {
        setName(c.name); setEmail(c.email || ""); setCompany(c.company || "");
        setHourlyRate(c.hourlyRate !== null ? payrollCentsDecimal(c.hourlyRate) : "");
        setBankAccount(c.bankAccountNumber || ""); setPaymentCurrency(c.currency || "USD");
      }
    } catch {
      if (!ignored()) {
        if (initial) setMoneyError("readFailed");
        else toast.error(t("readFailed"));
      }
    } finally { if (!ignored()) setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    const scope = { active: true };
    requestScope.current = scope;
    void fetchContractor(() => cancelled, true);
    return () => { cancelled = true; scope.active = false; };
    // The request is keyed by contractor and organization; messages are read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, orgId, storageFailed]);

  async function handleSave() {
    if (!orgId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/payroll/contractors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name,
          email: email || null,
          company: company || null,
          hourlyRateMinor: hourlyRate ? payrollCentsInput(hourlyRate) : null,
          bankAccountNumber: bankAccount || null,
        }),
      });
      await payrollContractorJson(res, "saved");
      toast.success(t("updated"));
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPayment() {
    if (!orgId || !paymentAmount) return;
    try {
      const res = await fetch(`/api/v1/payroll/contractors/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          amountMinor: payrollCentsInput(paymentAmount),
          currency: paymentCurrency || contractor?.currency || "USD",
          description: paymentDesc || undefined,
          invoiceNumber: paymentInvoice || undefined,
        }),
      });
      await payrollContractorJson(res, "payment");
      toast.success(t("paymentAdded"));
      setPaymentAmount(""); setPaymentDesc(""); setPaymentInvoice("");
      void fetchContractor();
    } catch { toast.error(t("paymentFailed")); }
  }

  async function handleProcessPayment(paymentId: string) {
    if (!orgId) return;
    const confirmed = await confirm({
      title: t("processTitle"),
      description: t("processHelp"),
      confirmLabel: t("process"),
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/v1/payroll/contractors/${id}/payments/${paymentId}/process`, {
        method: "POST", headers: { "x-organization-id": orgId },
      });
      await payrollContractorJson(res, "payment");
      toast.success(t("processed"));
      void fetchContractor();
    } catch { toast.error(t("processFailed")); }
  }

  async function handleDelete() {
    if (!orgId) return;
    const confirmed = await confirm({ title: t("deleteTitle"), description: t("deleteHelp"), confirmLabel: t("delete"), destructive: true });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/payroll/contractors/${id}`, { method: "DELETE", headers: { "x-organization-id": orgId } });
      await payrollContractorJson(res, "deleted");
      toast.success(t("deleted")); router.push("/payroll/contractors");
    } catch { toast.error(t("deleteFailed")); }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t(moneyError)}</p>;
  if (!contractor) {
    return (
      <ContentReveal>
        <button onClick={() => router.push("/payroll/contractors")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("back")}
        </button>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-6">
      <button onClick={() => router.push("/payroll/contractors")} className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("back")}
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Briefcase className="size-5 text-muted-foreground" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold"><BidiText>{contractor.name}</BidiText></h1>
            {contractor.currency && contractor.currency !== "USD" && (
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"><IdentifierText>{currencyLabel(contractor.currency, unitPresentation.locale)}</IdentifierText></code>
            )}
          </div>
          <p className="text-sm text-muted-foreground"><BidiText>{contractor.company || contractor.email || "-"}</BidiText></p>
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        <Section title={t("details")} description={t("detailsHelp")}>
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="payroll-contractors-id-1" >{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" id="payroll-contractors-id-1" aria-label={t("name")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="payroll-contractors-id-2" >{t("email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" id="payroll-contractors-id-2" aria-label={t("email")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="payroll-contractors-id-3" >{t("company")}</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} dir="auto" id="payroll-contractors-id-3" aria-label={t("company")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="payroll-contractors-id-4" >{t("hourlyRate")}</Label>
              <CurrencyInput prefix={contractor.currency ?? "USD"} value={hourlyRate} onChange={setHourlyRate} id="payroll-contractors-id-4" aria-label={t("hourlyRate")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="payroll-contractors-id-5" >{t("bankAccount")}</Label>
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} dir="ltr" id="payroll-contractors-id-5" aria-label={t("bankAccount")} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2 flex-wrap">
            <Button size="sm" variant="destructive" onClick={handleDelete} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
              <Trash2 className="me-1.5 size-3.5" /> {t("delete")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]">
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </Section>

        <div className="h-px bg-border" />

        <Section title={t("payments")} description={t("paymentsHelp")}>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 [&>*]:min-w-0">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="payroll-contractors-id-6" >{t("amount")}</Label>
                  <CurrencyInput prefix={paymentCurrency || contractor.currency || "USD"} size="sm" value={paymentAmount} onChange={setPaymentAmount} id="payroll-contractors-id-6" aria-label={t("amount")} />
                </div>
                <div className="space-y-1" role="group" aria-label={t("currency")}>
                  <Label className="text-xs">{t("currency")}</Label>
                  <CurrencySelect value={paymentCurrency} onValueChange={setPaymentCurrency} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="payroll-contractors-id-7" >{t("description")}</Label>
                  <Input value={paymentDesc} onChange={(e) => setPaymentDesc(e.target.value)} className="h-8 text-sm" dir="auto" id="payroll-contractors-id-7" aria-label={t("description")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="payroll-contractors-id-8" >{t("invoice")}</Label>
                  <Input value={paymentInvoice} onChange={(e) => setPaymentInvoice(e.target.value)} className="h-8 text-sm" dir="ltr" id="payroll-contractors-id-8" aria-label={t("invoice")} />
                </div>
              </div>
              <Button size="sm" onClick={handleAddPayment} disabled={!paymentAmount} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                <Plus className="me-1.5 size-3" /> {t("addPayment")}
              </Button>
            </div>

            {(contractor.payments || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("noPayments")}</p>
            ) : (
              <div className="rounded-xl border bg-card divide-y">
                {(contractor.payments || []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5 flex-wrap">
                    <div>
                      <p className="text-sm font-medium font-mono tabular-nums"><IdentifierText>{formatMoney(p.amount, p.currency || contractor.currency || "USD", unitPresentation)}</IdentifierText></p>
                      <p className="text-xs text-muted-foreground"><BidiText>{p.description || p.invoiceNumber || "-"}</BidiText></p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px]", statusColors[p.status] || "")}>
                        {t(p.status)}
                      </Badge>
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" className=" text-xs h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" onClick={() => handleProcessPayment(p.id)}>
                          <Play className="me-1 size-3" /> {t("process")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      {confirmDialog}
    </ContentReveal>
  );
}
