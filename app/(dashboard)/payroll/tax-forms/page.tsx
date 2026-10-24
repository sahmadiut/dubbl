"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollOutputJson, payrollOutputOrganization, type PayrollTaxForm, type PayrollTaxGeneration } from "@/i18n/payroll-output-presentation";

import { Fragment, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { downloadTaxFormData } from "@/lib/payroll/output-client";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

type TaxFormItem = PayrollTaxForm;
type TaxGeneration = PayrollTaxGeneration;



const years = Array.from({ length: 7 }, (_, i) => 2020 + i);

export default function TaxFormsPage() {
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
  const router = useRouter();
  const [generations, setGenerations] = useState<TaxGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [taxYear, setTaxYear] = useState("2025");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useDocumentTitle(t("taxDocumentTitle"));

  const fetchGenerations = useCallback(async (orgId: string) => {
    return (await payrollOutputJson(await fetch("/api/v1/payroll/tax-forms", {
      headers: { "x-organization-id": orgId },
    }), "generations")).data;
  }, []);

  useEffect(() => {
    let active = true;
    const orgId = payrollOutputOrganization();
    if (!orgId) { setMoneyError("organizationRequired"); setLoading(false); return; }
    void fetchGenerations(orgId).then(data => { if (active) { setGenerations(data); setMoneyError(null); } })
      .catch(() => { if (active) setMoneyError("taxReadFailed"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchGenerations]);

  async function handleGenerate(formType: "1099_nec" | "w2") {
    const orgId = payrollOutputOrganization();
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    setGenerating(true);
    try {
      const data = await payrollOutputJson(await fetch("/api/v1/payroll/tax-forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ taxYear: parseInt(taxYear), formType }),
      }), "generated");
      if (data.generation.formType !== formType || data.generation.taxYear !== parseInt(taxYear)) throw new Error("Invalid generated form");
      const generations = await fetchGenerations(orgId);
      setGenerations(generations);
      toast.success(t("formsGenerated", { count: data.formsGenerated, type: t(`formType_${formType}`) }));
    } catch { toast.error(t("generateFailed")); }
    finally { setGenerating(false); }
  }

  async function download(id: string) {
    const orgId = payrollOutputOrganization();
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    try { await downloadTaxFormData(orgId, id); }
    catch { toast.error(t("downloadFailed")); }
  }

  function maskTaxId(taxId: string | null) {
    if (!taxId) return "-";
    return `***-${taxId.slice(-4)}`;
  }

  function getKeyAmount(form: TaxFormItem): string {
    const data = form.formData as Record<string, number>;
    if (form.formType === "1099_nec" && typeof data.box1_nonemployee_compensation === "number") {
      return formatMoney(data.box1_nonemployee_compensation, "USD", unitPresentation);
    }
    if (form.formType === "w2" && typeof data.box1_wages === "number") {
      return formatMoney(data.box1_wages, "USD", unitPresentation);
    }
    return "-";
  }

  if (moneyError) return <p role="alert">{t(moneyError as "organizationRequired" | "taxReadFailed")}</p>;
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("taxForms")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("taxHelp")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={taxYear} onValueChange={setTaxYear}>
            <SelectTrigger className="w-28" aria-label={t("taxYear")}>
              <SelectValue placeholder={t("taxYear")} />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={generating}
            onClick={() => handleGenerate("1099_nec")}
          >
            {t(generating ? "generating" : "generateNec")}
          </Button>
          <Button
            size="sm"
            disabled={generating}
            onClick={() => handleGenerate("w2")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {t(generating ? "generating" : "generateW2")}
          </Button>
        </div>
      </div>

      {/* Generations table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("taxYear")}</TableHead>
              <TableHead>{t("formType")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("formsCount")}</TableHead>
              <TableHead>{t("generated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  {t("noGenerations")}
                </TableCell>
              </TableRow>
            ) : (
              generations.map((gen) => (
                <Fragment key={gen.id}>
                  <TableRow
                    key={gen.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(expandedId === gen.id ? null : gen.id)
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      {gen.taxYear}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t(`formType_${gen.formType}`)}
                    </TableCell>
                    <TableCell>{statusBadge(gen.status)}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {gen.forms?.length || 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {gen.generatedAt
                        ? gen.generatedAt.slice(0, 10)
                        : "-"}
                    </TableCell>
                  </TableRow>

                  {/* Expanded forms section */}
                  {expandedId === gen.id &&
                    gen.forms &&
                    gen.forms.length > 0 && (
                      <TableRow key={`${gen.id}-forms`}>
                        <TableCell colSpan={5} className="p-0">
                          <div className="bg-muted/30 px-4 py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("recipient")}</TableHead>
                                  <TableHead>{t("taxId")}</TableHead>
                                  <TableHead className="text-right">
                                    {t("keyAmount")}
                                  </TableHead>
                                  <TableHead>{t("status")}</TableHead>
                                  <TableHead className="text-right">
                                    {t("actions")}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {gen.forms.map((form) => (
                                  <TableRow
                                    key={form.id}
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(
                                        `/payroll/tax-forms/${form.id}`
                                      );
                                    }}
                                  >
                                    <TableCell className="font-medium">
                                      {form.recipientName}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground font-mono">
                                      {maskTaxId(form.recipientTaxId)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm tabular-nums">
                                      {getKeyAmount(form)}
                                    </TableCell>
                                    <TableCell>
                                      {statusBadge(form.status)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        aria-label={t("download")}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void download(form.id);
                                        }}
                                      >
                                        <Download className="size-3.5" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
