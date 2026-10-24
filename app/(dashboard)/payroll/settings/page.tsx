"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";
import { currencyLabel } from "@/i18n/currency-labels";

import { payrollMoneyDisplay } from "@/lib/money/payroll-display";
import { useTranslations } from "next-intl";
import { payrollSettingsJson, settingsOrganization, settingsLabelKey,
  type PayrollSettingsData, type DeductionType, type TaxBracket, type ShiftDef,
  type LeavePolicy, type ApprovalChain, type CompensationBand,
} from "@/i18n/payroll-settings-presentation";

import { payrollCentsInput, payrollCentsDecimal, payrollBasisPointsInput } from "@/lib/money/payroll-input";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import Link from "next/link";
import { Save, Plus, Trash2, Shield, Clock, CalendarDays, DollarSign, Layers, ExternalLink } from "lucide-react";
import { Section } from "@/components/dashboard/section";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { Switch } from "@/components/ui/switch";
import { CurrencySelect } from "@/components/ui/currency-select";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/lib/hooks/use-confirm";

const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.3, delay } as const,
});

export default function PayrollSettingsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("PayrollSettings");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const readGeneration = useRef(0);

  // Settings
  const [settings, setSettings] = useState<PayrollSettingsData>({
    defaultTaxRate: 2000,
    overtimeThresholdHours: 40,
    overtimeMultiplier: 1.5,
    defaultCurrency: "USD",
    salaryExpenseAccountCode: "5100",
    taxPayableAccountCode: "2200",
    bankAccountCode: "1100",
    autoApprovalEnabled: false,
  });

  const [defaultTaxPercent, setDefaultTaxPercent] = useState("20.00");

  // Deduction types
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [deductionDrawer, setDeductionDrawer] = useState(false);
  const [newDeduction, setNewDeduction] = useState({ name: "", category: "post_tax", defaultAmount: "", defaultPercent: "" });

  // Tax brackets
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([]);
  const [bracketDrawer, setBracketDrawer] = useState(false);
  const [newBracket, setNewBracket] = useState({ name: "", jurisdictionLevel: "federal", minIncome: "", maxIncome: "", rate: "" });

  // Shifts
  const [shifts, setShifts] = useState<ShiftDef[]>([]);
  const [shiftDrawer, setShiftDrawer] = useState(false);
  const [newShift, setNewShift] = useState({ name: "", shiftType: "regular", startTime: "09:00", endTime: "17:00", premiumPercent: "0" });

  // Leave policies
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [leaveDrawer, setLeaveDrawer] = useState(false);
  const [newLeave, setNewLeave] = useState({ name: "", leaveType: "vacation", accrualMethod: "per_pay_period", accrualRate: "0", maxBalance: "" });

  // Approval chains
  const [approvalChains, setApprovalChains] = useState<ApprovalChain[]>([]);

  // Compensation bands
  const [compensationBands, setCompensationBands] = useState<CompensationBand[]>([]);
  const [bandDrawer, setBandDrawer] = useState(false);
  const [newBand, setNewBand] = useState({ name: "", level: "", minSalary: "", midSalary: "", maxSalary: "" });

  const orgId = settingsOrganization();

  const fetchAll = useCallback(() => {
    const generation = ++readGeneration.current;
    if (!orgId) { setMoneyError(t("loadFailed")); setLoading(false); return; }
    const headers = { "x-organization-id": orgId };

    Promise.all([
      fetch("/api/v1/payroll/settings", { headers }).then((r) => payrollSettingsJson(r, "settings")),
      fetch("/api/v1/payroll/deductions/types", { headers }).then((r) => payrollSettingsJson(r, "deductions")),
      fetch("/api/v1/payroll/tax/brackets", { headers }).then((r) => payrollSettingsJson(r, "brackets")),
      fetch("/api/v1/payroll/shifts", { headers }).then((r) => payrollSettingsJson(r, "shifts")),
      fetch("/api/v1/payroll/leave/policies", { headers }).then((r) => payrollSettingsJson(r, "policies")),
      fetch("/api/v1/payroll/approval-chains", { headers }).then((r) => payrollSettingsJson(r, "chains")),
      fetch("/api/v1/payroll/compensation/bands", { headers }).then((r) => payrollSettingsJson(r, "bands")),
    ])
      .then(([settingsData, deductionsData, bracketsData, shiftsData, leaveData, chainsData, bandsData]) => {
        if (generation !== readGeneration.current) return;
        setMoneyError(null);
        if (settingsData.settings) { setSettings(settingsData.settings); setDefaultTaxPercent(payrollCentsDecimal(settingsData.settings.defaultTaxRate)); }
        if (deductionsData.data) setDeductionTypes(deductionsData.data);
        if (bracketsData.data) setTaxBrackets(bracketsData.data);
        if (shiftsData.data) setShifts(shiftsData.data);
        if (leaveData.data) setLeavePolicies(leaveData.data);
        if (chainsData.data) setApprovalChains(chainsData.data);
        if (bandsData.data) setCompensationBands(bandsData.data);
      })
      .catch(() => { if (generation === readGeneration.current) setMoneyError(t("loadFailed")); })
      .finally(() => { if (generation === readGeneration.current) setLoading(false); });
  }, [orgId, t]);

  useEffect(() => {
    const reads = readGeneration;
    fetchAll();
    return () => { reads.current++; };
  }, [fetchAll]);

  async function handleSaveSettings() {
    if (!orgId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/payroll/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          defaultTaxRate: payrollBasisPointsInput(defaultTaxPercent), overtimeThresholdHours: settings.overtimeThresholdHours,
          overtimeMultiplier: settings.overtimeMultiplier, defaultCurrency: settings.defaultCurrency,
          salaryExpenseAccountCode: settings.salaryExpenseAccountCode || null, taxPayableAccountCode: settings.taxPayableAccountCode || null,
          bankAccountCode: settings.bankAccountCode || null, autoApprovalEnabled: settings.autoApprovalEnabled,
        }),
      });
      if (res.ok) { await payrollSettingsJson(res, "settings"); toast.success(t("saved")); }
      else toast.error(t("saveFailed"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDeduction() {
    if (!orgId || !newDeduction.name) return;
    try {
      const res = await fetch("/api/v1/payroll/deductions/types", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: newDeduction.name,
          category: newDeduction.category,
          defaultAmountMinor: newDeduction.defaultAmount ? payrollCentsInput(newDeduction.defaultAmount) : undefined,
          defaultPercent: newDeduction.defaultPercent ? Number(newDeduction.defaultPercent) : undefined,
        }),
      });
      if (res.ok) {
        await payrollSettingsJson(res, "deduction");
        toast.success(t("deductionAdded"));
        setDeductionDrawer(false);
        setNewDeduction({ name: "", category: "post_tax", defaultAmount: "", defaultPercent: "" });
        fetchAll();
      }
      else toast.error(t("deductionFailed"));
    } catch {
      toast.error(t("deductionFailed"));
    }
  }

  async function handleDeleteDeduction(id: string) {
    if (!orgId) return;
    const confirmed = await confirm({
      title: t("deleteDeductionTitle"),
      description: t("deleteDeductionDescription"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/payroll/deductions/types/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await payrollSettingsJson(res, "deleted");
      fetchAll();
    } catch { toast.error(t("deleteDeductionFailed")); }
  }

  async function handleAddBracket() {
    if (!orgId || !newBracket.name) return;
    try {
      const res = await fetch("/api/v1/payroll/tax/brackets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: newBracket.name,
          jurisdictionLevel: newBracket.jurisdictionLevel,
          minIncomeMinor: payrollCentsInput(newBracket.minIncome || "0"),
          maxIncomeMinor: newBracket.maxIncome ? payrollCentsInput(newBracket.maxIncome) : null,
          rate: payrollBasisPointsInput(newBracket.rate || "0"),
        }),
      });
      if (res.ok) {
        await payrollSettingsJson(res, "bracket");
        toast.success(t("bracketAdded"));
        setBracketDrawer(false);
        setNewBracket({ name: "", jurisdictionLevel: "federal", minIncome: "", maxIncome: "", rate: "" });
        fetchAll();
      }
      else toast.error(t("bracketFailed"));
    } catch {
      toast.error(t("bracketFailed"));
    }
  }

  async function handleAddShift() {
    if (!orgId || !newShift.name) return;
    try {
      const res = await fetch("/api/v1/payroll/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: newShift.name,
          shiftType: newShift.shiftType,
          startTime: newShift.startTime,
          endTime: newShift.endTime,
          premiumPercent: parseFloat(newShift.premiumPercent || "0"),
        }),
      });
      if (res.ok) {
        await payrollSettingsJson(res, "shift");
        toast.success(t("shiftAdded"));
        setShiftDrawer(false);
        setNewShift({ name: "", shiftType: "regular", startTime: "09:00", endTime: "17:00", premiumPercent: "0" });
        fetchAll();
      } else {
        toast.error(t("shiftFailed"));
      }
    } catch {
      toast.error(t("shiftFailed"));
    }
  }

  async function handleAddLeavePolicy() {
    if (!orgId || !newLeave.name) return;
    try {
      const res = await fetch("/api/v1/payroll/leave/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: newLeave.name,
          leaveType: newLeave.leaveType,
          accrualMethod: newLeave.accrualMethod,
          accrualRate: parseFloat(newLeave.accrualRate || "0"),
          maxBalance: newLeave.maxBalance ? parseFloat(newLeave.maxBalance) : null,
        }),
      });
      if (res.ok) {
        await payrollSettingsJson(res, "policy");
        toast.success(t("policyAdded"));
        setLeaveDrawer(false);
        setNewLeave({ name: "", leaveType: "vacation", accrualMethod: "per_pay_period", accrualRate: "0", maxBalance: "" });
        fetchAll();
      } else {
        toast.error(t("policyFailed"));
      }
    } catch {
      toast.error(t("policyFailed"));
    }
  }

  async function handleAddBand() {
    if (!orgId || !newBand.name) return;
    try {
      const res = await fetch("/api/v1/payroll/compensation/bands", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: newBand.name,
          level: newBand.level,
          minSalaryMinor: payrollCentsInput(newBand.minSalary || "0"),
          midSalaryMinor: payrollCentsInput(newBand.midSalary || "0"),
          maxSalaryMinor: payrollCentsInput(newBand.maxSalary || "0"),
        }),
      });
      if (res.ok) {
        await payrollSettingsJson(res, "band");
        toast.success(t("bandAdded"));
        setBandDrawer(false);
        setNewBand({ name: "", level: "", minSalary: "", midSalary: "", maxSalary: "" });
        fetchAll();
      } else toast.error(t("bandFailed"));
    } catch {
      toast.error(t("bandFailed"));
    }
  }

  async function handleDeleteBand(id: string) {
    if (!orgId) return;
    const confirmed = await confirm({
      title: t("deleteBandTitle"),
      description: t("cannotUndo"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/payroll/compensation/bands/${id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await payrollSettingsJson(res, "deleted");
      fetchAll();
    } catch { toast.error(t("deleteBandFailed")); }
  }

  if (loading) return <BrandLoader />;
  if (moneyError) return <p role="alert">{moneyError}</p>;

  return (
    <ContentReveal className="space-y-6">
      <div className="space-y-8">
        {/* General Settings */}
        <motion.div {...anim(0)}>
          <Section title={t("general")} description={t("generalDescription")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("taxRate")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={defaultTaxPercent}
                  onChange={(e) => setDefaultTaxPercent(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("overtimeThreshold")}</Label>
                <Input
                  type="number"
                  value={settings.overtimeThresholdHours}
                  onChange={(e) => setSettings({ ...settings, overtimeThresholdHours: parseFloat(e.target.value || "40") })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("overtimeMultiplier")}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.overtimeMultiplier}
                  onChange={(e) => setSettings({ ...settings, overtimeMultiplier: parseFloat(e.target.value || "1.5") })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("currency")}</Label>
                <CurrencySelect
                  value={settings.defaultCurrency}
                  onValueChange={(v) => setSettings({ ...settings, defaultCurrency: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("salaryAccount")}</Label>
                <Input
                  value={settings.salaryExpenseAccountCode ?? ""}
                  onChange={(e) => setSettings({ ...settings, salaryExpenseAccountCode: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("taxAccount")}</Label>
                <Input
                  value={settings.taxPayableAccountCode ?? ""}
                  onChange={(e) => setSettings({ ...settings, taxPayableAccountCode: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("bankAccount")}</Label>
                <Input
                  value={settings.bankAccountCode ?? ""}
                  onChange={(e) => setSettings({ ...settings, bankAccountCode: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <Switch
                  checked={settings.autoApprovalEnabled}
                  onCheckedChange={(v: boolean) => setSettings({ ...settings, autoApprovalEnabled: v })}
                />
                <Label className="text-xs">{t("autoApprove")}</Label>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="mr-1.5 size-3.5" />
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Deduction Types */}
        <motion.div {...anim(0.05)}>
          <Section title={t("deductions")} description={t("deductionsDescription")}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setDeductionDrawer(true)}>
                  <Plus className="mr-1.5 size-3" />
                  {t("addType")}
                </Button>
              </div>
              {deductionTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("noDeductions")}</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {deductionTypes.map((dt) => (
                    <div key={dt.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{dt.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{t(settingsLabelKey(dt.category))}</Badge>
                          {dt.defaultAmount != null && <span className="text-xs text-muted-foreground">{unitPresentation.locale === "en-US" ? "$" + payrollCentsDecimal(dt.defaultAmount) : payrollMoneyDisplay(dt.defaultAmount, "USD", unitPresentation)}</span>}
                          {dt.defaultPercent != null && <span className="text-xs text-muted-foreground">{dt.defaultPercent}%</span>}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="size-7" aria-label={t("deleteDeductionTitle")} onClick={() => handleDeleteDeduction(dt.id)}>
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Tax Brackets */}
        <motion.div {...anim(0.1)}>
          <Section title={t("brackets")} description={t("bracketsDescription")}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setBracketDrawer(true)}>
                  <Plus className="mr-1.5 size-3" />
                  {t("addBracket")}
                </Button>
              </div>
              {taxBrackets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("noBrackets")}</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {taxBrackets.map((b) => (
                    <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("bracketSummary", { level: t(settingsLabelKey(b.jurisdictionLevel)), jurisdiction: b.jurisdiction ? ` · ${b.jurisdiction}` : "", min: payrollCentsDecimal(b.minIncome), ceiling: b.maxIncome != null ? t("bracketCeiling", { amount: payrollCentsDecimal(b.maxIncome) }) : t("unbounded"), rate: payrollCentsDecimal(b.rate) })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Shift Definitions */}
        <motion.div {...anim(0.15)}>
          <Section title={t("shifts")} description={t("shiftsDescription")}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setShiftDrawer(true)}>
                  <Plus className="mr-1.5 size-3" />
                  {t("addShift")}
                </Button>
              </div>
              {shifts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("noShifts")}</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {shifts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("shiftSummary", { start: s.startTime, end: s.endTime, type: t(settingsLabelKey(s.shiftType)) })}{s.premiumPercent ? t("shiftPremium", { percent: String(s.premiumPercent) }) : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px]", s.isActive ? "text-emerald-600" : "text-muted-foreground")}>
                        {s.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Leave Policies */}
        <motion.div {...anim(0.2)}>
          <Section title={t("policies")} description={t("policiesDescription")}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setLeaveDrawer(true)}>
                  <Plus className="mr-1.5 size-3" />
                  {t("addPolicy")}
                </Button>
              </div>
              {leavePolicies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("noPolicies")}</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {leavePolicies.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("leaveSummary", { type: t(settingsLabelKey(p.leaveType)), hours: String(p.accrualRate), method: t(settingsLabelKey(p.accrualMethod)) })}{p.maxBalance ? t("leaveCap", { hours: String(p.maxBalance) }) : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Approval Chains */}
        <motion.div {...anim(0.25)}>
          <Section title={t("chains")} description={t("chainsDescription")}>
            {approvalChains.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("noChains")}</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {approvalChains.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{t("steps", { count: c.steps.length })}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", c.isActive ? "text-emerald-600" : "text-muted-foreground")}>
                      {c.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Compensation Bands */}
        <motion.div {...anim(0.3)}>
          <Section title={t("bands")} description={t("bandsDescription")}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setBandDrawer(true)}>
                  <Plus className="mr-1.5 size-3" />
                  {t("addBand")}
                </Button>
              </div>
              {compensationBands.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("noBands")}</p>
              ) : (
                <div className="rounded-lg border divide-y">
                  {compensationBands.map((band) => (
                    <div key={band.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{band.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("bandSummary", { level: band.level ?? "—", min: payrollMoneyDisplay(band.minSalary, band.currency, unitPresentation), mid: payrollMoneyDisplay(band.midSalary, band.currency, unitPresentation), max: payrollMoneyDisplay(band.maxSalary, band.currency, unitPresentation) })}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="size-7" aria-label={t("deleteBandTitle")} onClick={() => handleDeleteBand(band.id)}>
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </motion.div>

        <div className="h-px bg-border" />

        {/* Self-Service Link */}
        <motion.div {...anim(0.35)}>
          <Section title={t("portal")} description={t("portalDescription")}>
            <div className="flex items-center gap-3">
              <Button asChild size="sm" variant="outline">
                <Link href="/payroll/self-service">
                  <ExternalLink className="mr-1.5 size-3" />
                  {t("openPortal")}
                </Link>
              </Button>
            </div>
          </Section>
        </motion.div>
      </div>

      {/* Deduction Drawer */}
      <Sheet open={deductionDrawer} onOpenChange={setDeductionDrawer}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <DollarSign className="size-5" />
              </div>
              <div>
                <SheetTitle>{t("deductionTitle")}</SheetTitle>
                <SheetDescription>{t("deductionDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddDeduction(); }}>
            <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input value={newDeduction.name} onChange={(e) => setNewDeduction({ ...newDeduction, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Select value={newDeduction.category} onValueChange={(v) => setNewDeduction({ ...newDeduction, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre_tax">{t("preTax")}</SelectItem>
                    <SelectItem value="post_tax">{t("postTax")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("defaultAmount")}</Label>
                  <CurrencyInput prefix={currencyLabel("USD", unitPresentation.locale, "$")} value={newDeduction.defaultAmount} onChange={(v) => setNewDeduction({ ...newDeduction, defaultAmount: v })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("defaultPercent")}</Label>
                  <Input type="number" step="0.01" value={newDeduction.defaultPercent} onChange={(e) => setNewDeduction({ ...newDeduction, defaultPercent: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="border-t px-4 py-3 sm:px-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeductionDrawer(false)}>{t("cancel")}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{t("create")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Tax Bracket Drawer */}
      <Sheet open={bracketDrawer} onOpenChange={setBracketDrawer}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Shield className="size-5" />
              </div>
              <div>
                <SheetTitle>{t("bracketTitle")}</SheetTitle>
                <SheetDescription>{t("bracketDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddBracket(); }}>
            <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input value={newBracket.name} onChange={(e) => setNewBracket({ ...newBracket, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("jurisdiction")}</Label>
                  <Select value={newBracket.jurisdictionLevel} onValueChange={(v) => setNewBracket({ ...newBracket, jurisdictionLevel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="federal">{t("federal")}</SelectItem>
                      <SelectItem value="state">{t("state")}</SelectItem>
                      <SelectItem value="local">{t("local")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("rate")}</Label>
                  <Input type="number" step="0.01" value={newBracket.rate} onChange={(e) => setNewBracket({ ...newBracket, rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("minIncome")}</Label>
                  <CurrencyInput prefix={currencyLabel("USD", unitPresentation.locale, "$")} value={newBracket.minIncome} onChange={(v) => setNewBracket({ ...newBracket, minIncome: v })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("maxIncome")}</Label>
                  <CurrencyInput prefix={currencyLabel("USD", unitPresentation.locale, "$")} value={newBracket.maxIncome} onChange={(v) => setNewBracket({ ...newBracket, maxIncome: v })} placeholder={t("unlimited")} />
                </div>
              </div>
            </div>
            <div className="border-t px-4 py-3 sm:px-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBracketDrawer(false)}>{t("cancel")}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{t("create")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Shift Drawer */}
      <Sheet open={shiftDrawer} onOpenChange={setShiftDrawer}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Clock className="size-5" />
              </div>
              <div>
                <SheetTitle>{t("addShift")}</SheetTitle>
                <SheetDescription>{t("shiftDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddShift(); }}>
            <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("type")}</Label>
                  <Select value={newShift.shiftType} onValueChange={(v) => setNewShift({ ...newShift, shiftType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">{t("regular")}</SelectItem>
                      <SelectItem value="overtime">{t("overtime")}</SelectItem>
                      <SelectItem value="night">{t("night")}</SelectItem>
                      <SelectItem value="weekend">{t("weekend")}</SelectItem>
                      <SelectItem value="holiday">{t("holiday")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("premium")}</Label>
                  <Input type="number" step="0.25" min={0} value={newShift.premiumPercent} onChange={(e) => setNewShift({ ...newShift, premiumPercent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("startTime")}</Label>
                  <Input type="time" value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("endTime")}</Label>
                  <Input type="time" value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="border-t px-4 py-3 sm:px-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShiftDrawer(false)}>{t("cancel")}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{t("create")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Leave Policy Drawer */}
      <Sheet open={leaveDrawer} onOpenChange={setLeaveDrawer}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <SheetTitle>{t("leaveTitle")}</SheetTitle>
                <SheetDescription>{t("leaveDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddLeavePolicy(); }}>
            <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input value={newLeave.name} onChange={(e) => setNewLeave({ ...newLeave, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("leaveType")}</Label>
                  <Select value={newLeave.leaveType} onValueChange={(v) => setNewLeave({ ...newLeave, leaveType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacation">{t("vacation")}</SelectItem>
                      <SelectItem value="sick">{t("sick")}</SelectItem>
                      <SelectItem value="personal">{t("personal")}</SelectItem>
                      <SelectItem value="parental">{t("parental")}</SelectItem>
                      <SelectItem value="bereavement">{t("bereavement")}</SelectItem>
                      <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                      <SelectItem value="other">{t("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("accrual")}</Label>
                  <Select value={newLeave.accrualMethod} onValueChange={(v) => setNewLeave({ ...newLeave, accrualMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_pay_period">{t("perPayPeriod")}</SelectItem>
                      <SelectItem value="monthly">{t("monthly")}</SelectItem>
                      <SelectItem value="annually">{t("annually")}</SelectItem>
                      <SelectItem value="front_loaded">{t("frontLoaded")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("hoursEarned")}</Label>
                  <Input type="number" step="0.5" value={newLeave.accrualRate} onChange={(e) => setNewLeave({ ...newLeave, accrualRate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("maxBalance")}</Label>
                  <Input type="number" value={newLeave.maxBalance} onChange={(e) => setNewLeave({ ...newLeave, maxBalance: e.target.value })} placeholder={t("unlimited")} />
                </div>
              </div>
            </div>
            <div className="border-t px-4 py-3 sm:px-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLeaveDrawer(false)}>{t("cancel")}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{t("create")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Compensation Band Drawer */}
      <Sheet open={bandDrawer} onOpenChange={setBandDrawer}>
        <SheetContent className="sm:max-w-lg w-full p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Layers className="size-5" />
              </div>
              <div>
                <SheetTitle>{t("bandTitle")}</SheetTitle>
                <SheetDescription>{t("bandDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddBand(); }}>
            <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("name")}</Label>
                  <Input value={newBand.name} onChange={(e) => setNewBand({ ...newBand, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("level")}</Label>
                  <Input value={newBand.level} onChange={(e) => setNewBand({ ...newBand, level: e.target.value })} placeholder={t("levelPlaceholder")} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("minSalary")}</Label>
                  <CurrencyInput prefix={currencyLabel("USD", unitPresentation.locale, "$")} value={newBand.minSalary} onChange={(v) => setNewBand({ ...newBand, minSalary: v })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("midSalary")}</Label>
                  <CurrencyInput prefix={currencyLabel("USD", unitPresentation.locale, "$")} value={newBand.midSalary} onChange={(v) => setNewBand({ ...newBand, midSalary: v })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("maxSalary")}</Label>
                  <CurrencyInput prefix={currencyLabel("USD", unitPresentation.locale, "$")} value={newBand.maxSalary} onChange={(v) => setNewBand({ ...newBand, maxSalary: v })} />
                </div>
              </div>
            </div>
            <div className="border-t px-4 py-3 sm:px-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBandDrawer(false)}>{t("cancel")}</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{t("create")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      {confirmDialog}
    </ContentReveal>
  );
}
