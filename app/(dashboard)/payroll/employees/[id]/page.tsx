"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { payrollShare } from "@/lib/money/payroll-ui";

import { payrollCentsInput, payrollCentsDecimal, payrollBasisPointsInput, payrollCentsPreview, payrollPeriodPreview } from "@/lib/money/payroll-input";
import { useTranslations } from "next-intl";
import { payrollEmployeeDetailJson, type EmployeeDetail, type EmployeeDeduction, type TaxConfig, type LeaveBalance, type CompensationBand } from "@/i18n/payroll-employee-detail-presentation";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Users, Power, PowerOff } from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

const getPerPeriodPay = payrollPeriodPreview;

export default function EmployeeDetailPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollEmployeeDetail");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<"readFailed" | "organizationRequired" | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // New section state
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [compensationBand, setCompensationBand] = useState<CompensationBand | null>(null);
  const [taxSaving, setTaxSaving] = useState(false);

  // Tax config form state
  const [tcFilingStatus, setTcFilingStatus] = useState("");
  const [tcFederalAllowances, setTcFederalAllowances] = useState("0");
  const [tcStateAllowances, setTcStateAllowances] = useState("0");
  const [tcAddlFederal, setTcAddlFederal] = useState("0");

  // Edit form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [position, setPosition] = useState("");
  const [salary, setSalary] = useState("");
  const [payFrequency, setPayFrequency] = useState("monthly");
  const [taxRate, setTaxRate] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [compensationType, setCompensationType] = useState("salary");
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  useDocumentTitle(t("documentTitle"));

  const [orgId, setOrgId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const org = localStorage.getItem("activeOrgId");
      if (!org) { setMoneyError("organizationRequired"); setLoading(false); }
      setOrgId(org);
    } catch { setMoneyError("readFailed"); setLoading(false); }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let active = true;
    setLoading(true);
    setMoneyError(null);
    setEmp(null);
    setCompensationBand(null);
    const headers = { "x-organization-id": orgId };
    async function load() {
      try {
        const response = await fetch(`/api/v1/payroll/employees/${id}`, { headers });
        if (response.status === 404) return;
        const data = await payrollEmployeeDetailJson(response, "employee");
        if (!active) return;
        const [deductionData, taxData, leaveData, bandData] = await Promise.all([
          fetch(`/api/v1/payroll/employees/${id}/deductions`, { headers }).then(r => payrollEmployeeDetailJson(r, "deductions")),
          fetch(`/api/v1/payroll/employees/${id}/tax-config`, { headers }).then(r => payrollEmployeeDetailJson(r, "tax")),
          fetch(`/api/v1/payroll/employees/${id}/leave-balances`, { headers }).then(r => payrollEmployeeDetailJson(r, "leave")),
          data.employee.compensationBandId ? fetch(`/api/v1/payroll/compensation/bands/${data.employee.compensationBandId}`, { headers }).then(r => payrollEmployeeDetailJson(r, "band")) : null,
        ]);
        if (!active) return;
        const e = data.employee;
        setEmp(e);
        setName(e.name);
        setEmail(e.email || "");
        setEmployeeNumber(e.employeeNumber);
        setPosition(e.position || "");
        setSalary(payrollCentsDecimal(e.salary));
        setPayFrequency(e.payFrequency);
        setTaxRate(payrollCentsDecimal(e.taxRate));
        setBankAccountNumber(e.bankAccountNumber || "");
        setStartDate(e.startDate);
        setEndDate(e.endDate || "");
        setIsActive(e.isActive);
        setCompensationType(e.compensationType);
        setHourlyRate(e.hourlyRate !== null ? payrollCentsDecimal(e.hourlyRate) : "");
        setCurrency(e.currency || "USD");
        setDeductions(deductionData.data);
        setLeaveBalances(leaveData.data);
        setCompensationBand(bandData?.band ?? null);
        const tc = taxData.taxConfig;
        setTaxConfig(tc);
        setTcFilingStatus(tc.filingStatus);
        setTcFederalAllowances(String(tc.federalAllowances));
        setTcStateAllowances(String(tc.stateAllowances));
        setTcAddlFederal(payrollCentsDecimal(tc.additionalWithholding ?? 0));
      } catch { if (active) setMoneyError("readFailed"); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, orgId]);

  async function handleSaveTaxConfig() {
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    setTaxSaving(true);
    try {
      const res = await fetch(`/api/v1/payroll/employees/${id}/tax-config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          filingStatus: tcFilingStatus,
          federalAllowances: Number(tcFederalAllowances),
          stateAllowances: Number(tcStateAllowances),
          additionalWithholdingMinor: payrollCentsInput(tcAddlFederal || "0"),
        }),
      });
      const data = await payrollEmployeeDetailJson(res, "tax");
      setTaxConfig(data.taxConfig);
      toast.success(t("taxUpdated"));
    } catch {
      toast.error(t("taxFailed"));
    } finally {
      setTaxSaving(false);
    }
  }

  async function handleSave() {
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/payroll/employees/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          name,
          email: email || null,
          position: position || null,
          salaryMinor: payrollCentsInput(salary),
          payFrequency,
          taxRate: payrollBasisPointsInput(taxRate),
          bankAccountNumber: bankAccountNumber || null,
          isActive,
          compensationType,
          hourlyRateMinor: hourlyRate ? payrollCentsInput(hourlyRate) : null,
          currency,
        }),
      });

      const data = await payrollEmployeeDetailJson(res, "employee");
      setEmp(data.employee);
      toast.success(t("updated"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    const confirmed = await confirm({
      title: t("deleteTitle"),
      description: t("deleteConfirm"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/payroll/employees/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await payrollEmployeeDetailJson(res, "deleted");
      toast.success(t("deleted"));
      router.push("/payroll/employees");
    } catch { toast.error(t("deleteFailed")); }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{t(moneyError)}</p>;

  if (!emp) {
    return (
      <ContentReveal>
        <button
          onClick={() => router.push("/payroll/employees")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          {t("back")}
        </button>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      </ContentReveal>
    );
  }

  const leaveTypeKey = (value: string) => value === "vacation" ? "vacation" : value === "sick" ? "sick" : value === "personal" ? "personal" : value === "parental" ? "parental" : value === "bereavement" ? "bereavement" : value === "unpaid" ? "unpaid" : "other";
  const salaryInCents = payrollCentsPreview(salary);
  const taxRateNum = parseFloat(taxRate || "0");

  return (
    <ContentReveal className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/payroll/employees")}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        {t("back")}
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            isActive
              ? "bg-emerald-50 dark:bg-emerald-950/40"
              : "bg-muted"
          )}>
            <Users className={cn(
              "size-5",
              isActive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{emp.name}</h1>
              <Badge variant="outline" className={
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : ""
              }>
                {isActive ? t("active") : t("inactive")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {emp.employeeNumber}{emp.position ? ` · ${emp.position}` : ""}
            </p>
            {emp.member && (
              <p className="text-xs text-muted-foreground">
                {t("linked", { member: emp.member.user.name || emp.member.user.email })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsActive(!isActive)}>
            {isActive ? (
              <><PowerOff className="mr-1.5 size-3.5" />{t("deactivate")}</>
            ) : (
              <><Power className="mr-1.5 size-3.5" />{t("activate")}</>
            )}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <motion.div {...anim(0)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {compensationType === "salary" ? t("annualSalary") : compensationType === "hourly" ? t("hourlyRate") : t("compensation")}
          </p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums truncate">
            {compensationType === "salary"
              ? formatMoney(salaryInCents, currency, unitPresentation)
              : compensationType === "hourly"
                ? formatMoney(payrollCentsPreview(hourlyRate), currency, unitPresentation)
                : "-"}
          </p>
        </motion.div>
        <motion.div {...anim(0.05)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("periodPay")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums truncate">{formatMoney(getPerPeriodPay(salaryInCents, payFrequency), currency, unitPresentation)}</p>
        </motion.div>
        <motion.div {...anim(0.09)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("taxRate")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums truncate">{taxRateNum}%</p>
        </motion.div>
        <motion.div {...anim(0.12)} className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("compensationType")}</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums truncate">{t(compensationType === "salary" ? "salary" : compensationType === "hourly" ? "hourly" : compensationType === "milestone" ? "milestone" : "commission")}</p>
        </motion.div>
      </div>

      {/* Edit form */}
      <div className="max-w-4xl space-y-6">
        {/* Personal Info */}
        <Section title={t("personalInfo")} description={t("personalHelp")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("employeeNumber")}</Label>
              <Input
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("position")}</Label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        {/* Compensation */}
        <Section title={t("compensation")} description={t("compensationHelp")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("compensationType")}</Label>
              <Select value={compensationType} onValueChange={setCompensationType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">{t("salary")}</SelectItem>
                  <SelectItem value="hourly">{t("hourly")}</SelectItem>
                  <SelectItem value="milestone">{t("milestone")}</SelectItem>
                  <SelectItem value="commission">{t("commission")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("annualSalary")}</Label>
              <CurrencyInput
                prefix={currency}
                value={salary}
                onChange={setSalary}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("frequency")}</Label>
              <Select value={payFrequency} onValueChange={setPayFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{t("weekly")}</SelectItem>
                  <SelectItem value="biweekly">{t("biweekly")}</SelectItem>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("taxRateInput")}</Label>
              <Input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            {compensationType === "hourly" && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("hourlyRate")}</Label>
                <CurrencyInput prefix={currency} value={hourlyRate} onChange={setHourlyRate} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("currency")}</Label>
              <CurrencySelect value={currency} onValueChange={setCurrency} />
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        {/* Details */}
        <Section title={t("details")} description={t("detailsHelp")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("bankAccount")}</Label>
              <Input
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("startDate")}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("endDate")}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled
              />
            </div>
          </div>
        </Section>

        <div className="h-px bg-border" />

        {/* Deductions */}
        <Section title={t("deductions")} description={t("deductionsHelp")}>
          {deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDeductions")}</p>
          ) : (
            <div className="space-y-2">
              {deductions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{d.deductionType.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[11px]">
                          {t(d.deductionType.category === "pre_tax" ? "preTax" : "postTax")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            d.deductionType.category === "pre_tax"
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          {d.deductionType.category === "pre_tax" ? t("preTax") : t("postTax")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono tabular-nums">
                      {d.amount != null ? formatMoney(d.amount, emp.currency ?? "USD", unitPresentation) : d.percent != null ? `${d.percent}%` : d.deductionType.defaultAmount != null ? formatMoney(d.deductionType.defaultAmount, emp.currency ?? "USD", unitPresentation) : d.deductionType.defaultPercent != null ? `${d.deductionType.defaultPercent}%` : t("noAmount")}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        d.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : ""
                      )}
                    >
                      {d.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="h-px bg-border" />

        {/* Tax Configuration */}
        <Section title={t("taxConfig")} description={t("taxHelp")}>
          {!taxConfig ? (
            <p className="text-sm text-muted-foreground">{t("noTax")}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("filingStatus")}</Label>
                  <Select value={tcFilingStatus} onValueChange={setTcFilingStatus}>
                    <SelectTrigger><SelectValue placeholder={t("selectStatus")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">{t("single")}</SelectItem>
                      <SelectItem value="married_joint">{t("marriedJoint")}</SelectItem>
                      <SelectItem value="married_separate">{t("marriedSeparate")}</SelectItem>
                      <SelectItem value="head_of_household">{t("headHousehold")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("federalAllowances")}</Label>
                  <Input
                    type="number"
                    value={tcFederalAllowances}
                    onChange={(e) => setTcFederalAllowances(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("stateAllowances")}</Label>
                  <Input
                    type="number"
                    value={tcStateAllowances}
                    onChange={(e) => setTcStateAllowances(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("withholding")}</Label>
                  <CurrencyInput
                    prefix={currency}
                    value={tcAddlFederal}
                    onChange={setTcAddlFederal}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveTaxConfig}
                  disabled={taxSaving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="mr-1.5 size-3.5" />
                  {taxSaving ? t("saving") : t("saveTax")}
                </Button>
              </div>
            </div>
          )}
        </Section>

        <div className="h-px bg-border" />

        {/* Leave Balances */}
        <Section title={t("leaveBalances")} description={t("leaveHelp")}>
          {leaveBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLeave")}</p>
          ) : (
            <div className="space-y-2">
              {leaveBalances.map((lb) => (
                <div
                  key={lb.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{lb.policy?.name || "-"}</p>
                      {lb.policy?.leaveType && (
                        <Badge variant="outline" className="mt-0.5 text-[11px]">
                          {t(leaveTypeKey(lb.policy.leaveType))}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-mono tabular-nums">
                    <div className="text-right">
                      <p className="text-[11px] font-sans text-muted-foreground">{t("balance")}</p>
                      <p>{t("hours", { value: String(lb.balance) })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-sans text-muted-foreground">{t("used")}</p>
                      <p>{t("hours", { value: String(lb.usedHours) })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Compensation Band */}
        {emp.compensationBandId && compensationBand && (
          <>
            <div className="h-px bg-border" />

            <Section title={t("bandTitle")} description={t("bandHelp")}>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("band")}</p>
                    <p className="text-sm font-medium">{compensationBand.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("minSalary")}</p>
                    <p className="text-sm font-mono tabular-nums">{formatMoney(compensationBand.minSalary, compensationBand.currency, unitPresentation)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("midSalary")}</p>
                    <p className="text-sm font-mono tabular-nums">{formatMoney(compensationBand.midSalary, compensationBand.currency, unitPresentation)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("maxSalary")}</p>
                    <p className="text-sm font-mono tabular-nums">{formatMoney(compensationBand.maxSalary, compensationBand.currency, unitPresentation)}</p>
                  </div>
                </div>
                {compensationBand.currency === (emp.currency ?? "USD") && compensationBand.currency === (emp.currency ?? "USD") && compensationBand.maxSalary > compensationBand.minSalary && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("range")}</span>
                      <span className="font-mono tabular-nums">
                        {payrollShare(salaryInCents - BigInt(compensationBand.minSalary), BigInt(compensationBand.maxSalary) - BigInt(compensationBand.minSalary))}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${payrollShare(salaryInCents - BigInt(compensationBand.minSalary), BigInt(compensationBand.maxSalary) - BigInt(compensationBand.minSalary))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </>
        )}

        <div className="h-px bg-border" />

        {/* Save */}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="mr-1.5 size-3.5" />
            {saving ? t("saving") : t("save")}
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Danger zone */}
        <Section title={t("danger")} description={t("dangerHelp")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteEmployee")}</p>
              <p className="text-[12px] text-muted-foreground">
                {t("deleteHelp")}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              {t("delete")}
            </Button>
          </div>
        </Section>
      </div>

      {confirmDialog}
    </ContentReveal>
  );
}
