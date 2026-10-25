"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { payrollOutputJson, payrollOutputOrganization, type PayrollPayslip } from "@/i18n/payroll-output-presentation";

import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, ChevronDown, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { cn } from "@/lib/utils";

interface RunItem {
  id: string;
  employeeId: string;
  employee: { name: string; employeeNumber: string } | null;
}

interface RunDetail {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  items: RunItem[];
}

type Payslip = PayrollPayslip;

interface Row {
  payrollItemId: string;
  employeeId: string;
  name: string;
  employeeNumber: string;
  payslip: Payslip | null;
}

export default function RunPayslipsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollOutputs");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useDocumentTitle(t("payslipsDocumentTitle"));

  const load = useCallback(async (active: () => boolean) => {
    const orgId = payrollOutputOrganization();
    if (!orgId) {
      if (active()) { setMoneyError("organizationRequired"); setLoading(false); }
      return;
    }
    const headers = { "x-organization-id": orgId };
    try {
      const response = await fetch(`/api/v1/payroll/runs/${id}`, { headers });
      if (!active()) return;
      if (response.status === 404) { setRun(null); setRows([]); return; }
      const { run: detail } = await payrollOutputJson(response, "run");
      if (!active()) return;
      const { payslips } = await payrollOutputJson(await fetch(`/api/v1/payroll/runs/${id}/payslips`, { headers }), "payslips");
      if (!active()) return;
      if (detail.id !== id || payslips.some(p => p.payrollRunId !== id || !detail.items.some(item => item.id === p.payrollItemId && item.employeeId === p.employeeId)) || new Set(payslips.map(p => p.payrollItemId)).size !== payslips.length) throw new Error("Invalid payslip links");
      const built: Row[] = detail.items.map(item => ({
        payrollItemId: item.id, employeeId: item.employeeId,
        name: item.employee?.name || "-", employeeNumber: item.employee?.employeeNumber || "",
        payslip: payslips.find(p => p.payrollItemId === item.id) || null,
      }));
      setRun(detail); setRows(built); setMoneyError(null);
    } catch { if (active()) setMoneyError("payslipsReadFailed"); }
    finally { if (active()) setLoading(false); }
  }, [id]);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]);

  // The existing GET marks an owned payslip viewed. Adopt its status only after validation.
  async function toggle(row: Row) {
    if (!row.payslip) return;
    const next = expanded === row.payslip.id ? null : row.payslip.id;
    setExpanded(next);
    if (next && row.payslip.status !== "viewed") {
      const orgId = payrollOutputOrganization();
      if (!orgId) { toast.error(t("organizationRequired")); return; }
      try {
        const { payslip } = await payrollOutputJson(await fetch(`/api/v1/payroll/payslips/${row.payslip.id}`, {
          headers: { "x-organization-id": orgId },
        }), "payslip");
        if (payslip.id !== row.payslip.id || payslip.payrollRunId !== id || payslip.employeeId !== row.employeeId || payslip.payrollItemId !== row.payrollItemId || payslip.status !== "viewed") throw new Error("Invalid viewed payslip");
        setRows(prev => prev.map(r => r.payslip?.id === payslip.id ? { ...r, payslip: { ...r.payslip, status: payslip.status } } : r));
      } catch { toast.error(t("viewFailed")); }
    }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t(moneyError as "payslipsReadFailed" | "organizationRequired")}</p>;
  if (!run) return <p>{t("runNotFound")}</p>;

  const generated = rows.filter((r) => r.payslip).length;

  return (
    <ContentReveal className="space-y-6">
      <button
        onClick={() => router.push(`/payroll/runs/${id}`)}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t("backToRun")}
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <ScrollText className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{t("payslips")}</h1>
          {run && (
            <p className="text-sm text-muted-foreground">
              {t.rich("period", { code: (chunks) => <IdentifierText>{chunks}</IdentifierText>,  start: run.payPeriodStart, end: run.payPeriodEnd  })}
            </p>
          )}
        </div>
      </div>

      {generated === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t("noPayslips")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("noPayslipsHelp")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]"
            onClick={() => router.push(`/payroll/runs/${id}`)}
          >
            {t("goToRun")}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {rows.map((row) => {
            const ps = row.payslip;
            const isOpen = ps && expanded === ps.id;
            // Tax + everything else withheld = take-home subtracted from gross.
            const totalDeductions = ps ? BigInt(ps.grossAmount) - BigInt(ps.netAmount) : 0n;
            const otherDeductions = ps
              ? totalDeductions - BigInt(ps.taxAmount)
              : 0n;
            return (
              <div key={row.payrollItemId}>
                <div className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]"><BidiText>{row.name}</BidiText></p>
                    {row.employeeNumber && (
                      <p className="text-xs text-muted-foreground font-mono">
                        <IdentifierText>{row.employeeNumber}</IdentifierText>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 flex-wrap">
                    {ps ? (
                      <>
                        <div className="hidden sm:block text-end">
                          <p className="text-xs text-muted-foreground">
                            {t("beforeDeductions")}
                          </p>
                          <p className="text-sm font-mono tabular-nums">
                            <IdentifierText>{formatMoney(ps.grossAmount, ps.currency, unitPresentation)}</IdentifierText>
                          </p>
                        </div>
                        <div className="hidden sm:block text-end">
                          <p className="text-xs text-muted-foreground">
                            {t("taxesDeductions")}
                          </p>
                          <p className="text-sm font-mono tabular-nums text-red-600 dark:text-red-400">
                            <IdentifierText>{formatMoney(totalDeductions, ps.currency, unitPresentation)}</IdentifierText>
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-muted-foreground">
                            {t("takeHome")}
                          </p>
                          <p className="text-sm font-mono tabular-nums font-medium">
                            <IdentifierText>{formatMoney(ps.netAmount, ps.currency, unitPresentation)}</IdentifierText>
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`payslipStatus_${ps.status}`)}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggle(row)} className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere]" >
                          {t(isOpen ? "hide" : "viewPayslip")}
                          <ChevronDown
                            className={cn(
                              "ms-1.5 size-3.5 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {t("noPayslip")}
                      </Badge>
                    )}
                  </div>
                </div>

                {isOpen && ps && (
                  <div className="border-t bg-muted/30 px-4 py-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 [&>*]:min-w-0">
                      <Detail label={t("beforeDeductions")} value={formatMoney(ps.grossAmount, ps.currency, unitPresentation)} />
                      <Detail label={t("taxWithheld")} value={formatMoney(ps.taxAmount, ps.currency, unitPresentation)} />
                      <Detail label={t("otherDeductions")} value={formatMoney(otherDeductions, ps.currency, unitPresentation)} />
                      <Detail label={t("takeHome")} value={formatMoney(ps.netAmount, ps.currency, unitPresentation)} emphasize />
                    </div>

                    {ps.deductionsBreakdown && ps.deductionsBreakdown.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                          {t("deductions")}
                        </p>
                        <div className="rounded-lg border bg-card divide-y">
                          {ps.deductionsBreakdown.map((d, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-3 py-2 flex-wrap"
                            >
                              <span className="text-xs capitalize">
                                <BidiText>{d.name || t(`deductionCategory_${d.category}`)}</BidiText>
                              </span>
                              <span className="text-xs font-mono tabular-nums">
                                <IdentifierText>{formatMoney(d.amount || 0, ps.currency, unitPresentation)}</IdentifierText>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                        {t("yearSoFar")}
                      </p>
                      <div className="grid grid-cols-3 gap-x-8 gap-y-2 [&>*]:min-w-0">
                        <Detail label={t("earned")} value={formatMoney(ps.ytdGross, ps.currency, unitPresentation)} small />
                        <Detail label={t("tax")} value={formatMoney(ps.ytdTax, ps.currency, unitPresentation)} small />
                        <Detail label={t("takeHome")} value={formatMoney(ps.ytdNet, ps.currency, unitPresentation)} small />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {generated > 0 && generated < rows.length && (
        <p className="text-xs text-muted-foreground">
          {t("missingPayslips", { count: rows.length - generated })}
        </p>
      )}
    </ContentReveal>
  );
}

function Detail({
  label,
  value,
  emphasize,
  small,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-muted-foreground",
          small ? "text-[11px]" : "text-xs"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-mono tabular-nums",
          small ? "text-xs" : "text-sm",
          emphasize && "font-semibold"
        )}
      >
        <IdentifierText>{value}</IdentifierText>
      </p>
    </div>
  );
}
