"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Translate = ReturnType<typeof useTranslations<"SettingsRoles">>;

export function rolePermissions(t: Translate) {
  const categories: Record<string, string[]> = {
    [t("general")]: ["view:data"],
    [t("accounting")]: ["create:entries", "edit:entries", "post:entries", "void:entries", "manage:accounts", "manage:recurring", "manage:period-lock"],
    [t("invoicing")]: ["manage:invoices", "approve:invoices", "manage:credit-notes", "manage:debit-notes"],
    [t("bills")]: ["manage:bills", "approve:bills"],
    [t("banking")]: ["manage:banking", "manage:bank-rules"],
    [t("contacts")]: ["manage:contacts"],
    [t("payments")]: ["manage:payments"],
    [t("expenses")]: ["manage:expenses", "approve:expenses"],
    [t("inventory")]: ["manage:inventory"],
    [t("payroll")]: ["manage:payroll", "approve:payroll", "manage:timesheets", "manage:leave", "manage:contractors", "view:payslips", "manage:compensation", "manage:tax-config", "manage:shifts", "self-service:payroll", "view:payroll-reports"],
    [t("projects")]: ["manage:projects"],
    [t("assets")]: ["manage:assets"],
    [t("budgets")]: ["manage:budgets"],
    [t("tax")]: ["manage:tax-rates"],
    [t("costCenters")]: ["manage:cost-centers"],
    [t("admin")]: ["manage:teams", "invite:members", "change:roles", "remove:members", "manage:api-keys", "view:audit-log"],
    [t("owner")]: ["manage:billing", "delete:organization"],
  };

  // Plain-language label for each permission. The end user is not an accountant,
  // so these describe what the permission lets someone DO rather than echoing the
  // internal permission code (e.g. "post:entries" -> "Finalize transactions").
  const labels: Record<string, string> = {
    "view:data": t("seeDataReadOnly"),
    "create:entries": t("addTransactions"),
    "edit:entries": t("editTransactions"),
    "post:entries": t("finalizeTransactionsLockThemIn"),
    "void:entries": t("cancelTransactions"),
    "manage:accounts": t("manageTheChartOfAccounts"),
    "manage:recurring": t("manageRepeatingTransactions"),
    "manage:period-lock": t("lockPastDates"),
    "manage:invoices": t("manageInvoices"),
    "approve:invoices": t("approveInvoices"),
    "manage:credit-notes": t("manageRefundsToCustomers"),
    "manage:debit-notes": t("manageChargeBacksToSuppliers"),
    "manage:bills": t("manageBillsYouOwe"),
    "approve:bills": t("approveBillsYouOwe"),
    "manage:banking": t("manageBankAccountsFeeds"),
    "manage:bank-rules": t("manageAutoSortingRulesForBankActivity"),
    "manage:contacts": t("manageCustomersSuppliers"),
    "manage:payments": t("managePayments"),
    "manage:expenses": t("manageExpenses"),
    "approve:expenses": t("approveExpenses"),
    "manage:inventory": t("manageStockProducts"),
    "manage:payroll": t("managePayroll"),
    "approve:payroll": t("approvePayroll"),
    "manage:timesheets": t("manageTimesheets"),
    "manage:leave": t("manageTimeOff"),
    "manage:contractors": t("manageContractors"),
    "view:payslips": t("seePaySlips"),
    "manage:compensation": t("managePaySalaries"),
    "manage:tax-config": t("managePayrollTaxSetup"),
    "manage:shifts": t("manageShifts"),
    "self-service:payroll": t("seeTheirOwnPayInfo"),
    "view:payroll-reports": t("seePayrollReports"),
    "manage:projects": t("manageProjects"),
    "manage:assets": t("manageEquipmentAssets"),
    "manage:budgets": t("manageBudgets"),
    "manage:tax-rates": t("manageTaxRates"),
    "manage:cost-centers": t("manageCostCenters"),
    "manage:teams": t("manageTeams"),
    "invite:members": t("invitePeople"),
    "change:roles": t("changePeopleSAccessLevel"),
    "remove:members": t("removePeople"),
    "manage:api-keys": t("manageDeveloperAPIKeys"),
    "view:audit-log": t("seeTheActivityHistory"),
    "manage:billing": t("manageBillingSubscription"),
    "delete:organization": t("deleteTheWholeOrganization"),
  };


  return { categories, labels };
}

export function RolePermissionFields({ selectedPermissions, onToggleCategory, onTogglePermission }: {
  selectedPermissions: string[];
  onToggleCategory: (permissions: string[]) => void;
  onTogglePermission: (permission: string) => void;
}) {
  const t = useTranslations("SettingsRoles");
  const { categories, labels } = rolePermissions(t);
  return (
    <div className="space-y-3">
      <Label>{t("permissions")}</Label>
      {Object.entries(categories).map(([category, perms]) => {
        const allSelected = perms.every((p) => selectedPermissions.includes(p));
        const someSelected = perms.some((p) => selectedPermissions.includes(p));
        return (
          <div key={category} className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as unknown as HTMLInputElement).indeterminate = someSelected && !allSelected;
                  }
                }}
                aria-label={category}
                onCheckedChange={() => onToggleCategory(perms)}
              />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {category}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 ps-6">
              {perms.map((perm) => (
                <label key={perm} className="flex min-w-0 items-start gap-2 text-sm cursor-pointer [overflow-wrap:anywhere]">
                  <Checkbox
                    checked={selectedPermissions.includes(perm)}
                    onCheckedChange={() => onTogglePermission(perm)}
                  />
                  <span>{labels[perm] ?? perm}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
