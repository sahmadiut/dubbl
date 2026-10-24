"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollOutputJson, payrollOutputOrganization, w2Fields, taxMetadata, type PayrollTaxForm } from "@/i18n/payroll-output-presentation";

import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { downloadTaxFormData } from "@/lib/payroll/output-client";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

type TaxFormDetail = PayrollTaxForm;



export default function TaxFormDetailPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollOutputs");
  const statusBadge = (status: PayrollTaxForm["status"]) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">{t("taxStatus_draft")}</Badge>;
      case "generated":
        return <Badge variant="default">{t("taxStatus_generated")}</Badge>;
      case "sent":
        return <Badge variant="outline">{t("taxStatus_sent")}</Badge>;
      case "corrected":
        return <Badge variant="secondary">{t("taxStatus_corrected")}</Badge>;
      case "filed":
        return (
          <Badge
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {t("taxStatus_filed")}
          </Badge>
        );
    }
  };
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<TaxFormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  useDocumentTitle(t("taxDetailDocumentTitle"));

  const loadForm = useCallback(async (active: () => boolean) => {
    const orgId = payrollOutputOrganization();
    if (!orgId) { if (active()) { setMoneyError("organizationRequired"); setLoading(false); } return; }
    try {
      const response = await fetch(`/api/v1/payroll/tax-forms/${id}`, { headers: { "x-organization-id": orgId } });
      if (!active()) return;
      if (response.status === 404) { setForm(null); return; }
      const data = await payrollOutputJson(response, "form");
      if (!active()) return;
      if (data.id !== id) throw new Error("Invalid tax form link");
      setForm(data); setMoneyError(null);
    } catch { if (active()) setMoneyError("taxReadFailed"); }
    finally { if (active()) setLoading(false); }
  }, [id]);

  useEffect(() => {
    let active = true;
    void loadForm(() => active);
    return () => { active = false; };
  }, [loadForm]);

  async function download(id: string) {
    const orgId = payrollOutputOrganization();
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    try { await downloadTaxFormData(orgId, id); }
    catch { toast.error(t("downloadFailed")); }
  }

  if (moneyError) return <p role="alert">{t(moneyError as "organizationRequired" | "taxReadFailed")}</p>;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("formNotFound")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-2">
          <Link href="/payroll/tax-forms">{t("backToTaxForms")}</Link>
        </Button>
      </div>
    );
  }

  const formTypeLabel = t(`formType_${form.formType}`);
  const data = form.formData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="size-8 p-0">
            <Link href="/payroll/tax-forms" aria-label={t("backToTaxForms")}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight">
                {t("formHeading", { type: formTypeLabel, year: String(form.taxYear) })}
              </h1>
              {statusBadge(form.status)}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("recipientHeading", { name: form.recipientName, type: t(`recipientType_${form.recipientType}`) })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void download(form.id)
          }
        >
          <Download className="mr-2 size-3.5" />
          {t("download")}
        </Button>
      </div>

      <div className="h-px bg-gradient-to-r from-blue-500/20 via-border to-transparent" />

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("formType")}</p>
          <p className="mt-1 text-lg font-bold">{formTypeLabel}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("taxYear")}</p>
          <p className="mt-1 text-lg font-bold font-mono tabular-nums">
            {form.taxYear}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("recipient")}</p>
          <p className="mt-1 text-lg font-bold truncate">
            {form.recipientName}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("taxId")}</p>
          <p className="mt-1 text-lg font-bold font-mono">
            {form.recipientTaxId
              ? `***-${form.recipientTaxId.slice(-4)}`
              : "-"}
          </p>
        </div>
      </div>

      {/* Form data */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">{t("formData")}</h2>
        <div className="rounded-lg border divide-y">
          {form.formType === "1099_nec" && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {t("box1_nonemployee_compensation")}
              </span>
              <span className="text-sm font-mono font-bold tabular-nums">
                {typeof data.box1_nonemployee_compensation === "number"
                  ? formatMoney(data.box1_nonemployee_compensation, "USD", unitPresentation)
                  : "-"}
              </span>
            </div>
          )}

          {form.formType === "w2" &&
            w2Fields.map(key => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">{t(key)}</span>
                <span className="text-sm font-mono font-bold tabular-nums">
                  {typeof data[key] === "number"
                    ? formatMoney(data[key] as number, "USD", unitPresentation)
                    : "-"}
                </span>
              </div>
            ))}

          {/* Additional info fields */}
          {taxMetadata.filter(key => key in data).map(key => [key, data[key]] as const)
            .map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">
                  {t(`metadata_${key}`)}
                </span>
                <span className="text-sm">{value === null ? "-" : String(value) || "-"}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
