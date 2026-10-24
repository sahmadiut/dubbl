"use client";

import { useTranslations } from "next-intl";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search, Plus, Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useSidebar } from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { NotificationDropdown } from "@/components/dashboard/notification-dropdown";

/* ------------------------------------------------------------------ */
/*  Custom topbar action slot                                          */
/* ------------------------------------------------------------------ */

const TopbarActionCtx = createContext<{
  setAction: (node: ReactNode) => void;
}>({ setAction: () => {} });

/** Render a custom action in the topbar from any page. */
export function useTopbarAction(node: ReactNode) {
  const { setAction } = useContext(TopbarActionCtx);
  useLayoutEffect(() => {
    setAction(node);
    return () => setAction(null);
  }, [node, setAction]);
}

export function Topbar() {
  const [customAction, setCustomAction] = useState<ReactNode>(null);
  const stableSetAction = useCallback((n: ReactNode) => setCustomAction(n), []);

  return (
    <TopbarActionCtx.Provider value={{ setAction: stableSetAction }}>
      <TopbarInner customAction={customAction} />
    </TopbarActionCtx.Provider>
  );
}

function TopbarInner({ customAction }: { customAction: ReactNode }) {
  const t = useTranslations("Shell");
  const LABELS: Record<string, string> = {
    // Top-level
    dashboard: t("overview"),
    sales: t("sales"),
    purchases: t("purchases"),
    contacts: t("contacts"),
    accounting: t("accounting"),
    projects: t("projects"),
    inventory: t("inventory"),
    payroll: t("payroll"),
    reports: t("reports"),
    notifications: t("notifications"),
    documents: t("documents"),
    settings: t("settings"),
    tax: t("tax"),
    crm: t("cRM"),
    portal: t("portal"),
    consolidation: t("consolidation"),
    // Sales
    invoices: t("invoices"),
    quotes: t("quotes"),
    receipts: t("cashSales"),
    "credit-notes": t("creditNotes"),
    recurring: t("recurring"),
    payments: t("payments"),
    "customer-prepayments": t("prepayments"),
    "revenue-schedules": t("revenueSchedules"),
    new: t("new"),
    // Purchases
    bills: t("bills"),
    expenses: t("expenses"),
    orders: t("purchaseOrders"),
    requisitions: t("requisitions"),
    "vendor-spend": t("vendorSpend"),
    "debit-notes": t("supplierCredits"),
    "goods-receipts": t("goodsReceived"),
    // Accounting
    transactions: t("transactions"),
    accounts: t("accounts"),
    banking: t("banking"),
    "fixed-assets": t("fixedAssets"),
    budgets: t("budgets"),
    reconcile: t("reconcile"),
    loans: t("loans"),
    "opening-balances": t("openingBalances"),
    accruals: t("accruals"),
    "recurring-journals": t("recurringJournals"),
    // Settings
    general: t("general"),
    members: t("members"),
    roles: t("roles"),
    billing: t("billing"),
    advisors: t("advisors"),
    pipelines: t("pipelines"),
    "bank-rules": t("bankRules"),
    "approval-workflows": t("approvals"),
    webhooks: t("webhooks"),
    "api-keys": t("aPIKeys"),
    "audit-log": t("auditLog"),
    "cost-centers": t("costCenters"),
    tags: t("tags"),
    reminders: t("reminders"),
    "document-templates": t("documentTemplates"),
    currencies: t("currencies"),
    "tax-rates": t("taxRates"),
    // Payroll
    employees: t("employees"),
    runs: t("payRuns"),
    contractors: t("contractors"),
    "time-leave": t("timeLeave"),
    compensation: t("compensation"),
    timesheets: t("timesheets"),
    payslips: t("payslips"),
    "tax-forms": t("taxForms"),
    leave: t("leave"),
    reviews: t("reviews"),
    pay: t("pay"),
    // Reports
    "trial-balance": t("trialBalance"),
    "balance-sheet": t("balanceSheet"),
    "comparative-balance-sheet": t("comparativeBalanceSheet"),
    "income-statement": t("incomeStatement"),
    "profit-and-loss": t("profitLoss"),
    "pnl-comparison": t("pLComparison"),
    "cash-flow": t("cashFlow"),
    "cash-flow-forecast": t("cashFlowForecast"),
    "general-ledger": t("generalLedger"),
    "aged-receivables": t("agedReceivables"),
    "aged-payables": t("agedPayables"),
    "budget-vs-actual": t("budgetVsActual"),
    "financial-ratios": t("financialRatios"),
    "financial-calendar": t("financialCalendar"),
    "payment-performance": t("paymentPerformance"),
    "expense-analytics": t("expenseAnalytics"),
    profitability: t("profitability"),
    "tax-summary": t("taxSummary"),
    forecasting: t("forecasting"),
    custom: t("customReports"),
    "report-schedules": t("reportSchedules"),
    scheduled: t("scheduled"),
    // Inventory
    "stock-takes": t("stockTakes"),
    warehouses: t("warehouses"),
    valuation: t("valuation"),
    categories: t("categories"),
    transfers: t("transfers"),
    alerts: t("alerts"),
    history: t("history"),
    suppliers: t("suppliers"),
    bom: t("billOfMaterials"),
    assembly: t("assemblyOrders"),
    variants: t("variants"),
    "landed-costs": t("landedCosts"),
    // CRM
    deals: t("deals"),
    analytics: t("analytics"),
    "duplicate-detection": t("duplicateDetection"),
    // Projects
    tasks: t("tasks"),
    milestones: t("milestones"),
    notes: t("notes"),
    team: t("team"),
    teams: t("teams"),
    time: t("timeTracking"),
    // Tax
    "sales-tax": t("salesTax"),
    "schedule-c": t("scheduleC"),
    "vat-return": t("vATReturn"),
    bas: t("bAS"),
    periods: t("taxPeriods"),
    // Workflows
    workflows: t("workflows"),
    "approval-requests": t("approvalRequests"),
    // Signatures
    signature: t("signature"),
    sign: t("sign"),
    // Misc
    "scheduled-payments": t("scheduledPayments"),
    "self-service": t("selfService"),
    statements: t("statements"),
    imports: t("imports"),
    batches: t("batches"),
    docs: t("docs"),
    admin: t("admin"),
    "email-preview": t("emailPreview"),
  };

  function getLabel(segment: string): string {
    return LABELS[segment] || segment;
  }

  type DrawerType = "contact" | "project" | "invoice" | "bill" | "entry" | "inventory" | "quote" | "salesReceipt" | "purchaseOrder" | "expense" | "fixedAsset" | "budget" | "employee" | "creditNote" | "recurring" | "account" | "bankAccount" | "warehouse" | "stockTake" | "category" | "transfer" | "contractor" | "debitNote" | "customerCredit" | "loan" | "openingBalance" | "accrualSchedule" | "revenueSchedule" | "recurringJournal";

  const CTA_MAP: Record<string, { label: string; drawer: DrawerType } | null> = {
    sales: { label: t("newInvoice"), drawer: "invoice" },
    "sales/quotes": { label: t("newQuote"), drawer: "quote" },
    "sales/receipts": { label: t("newCashSale"), drawer: "salesReceipt" },
    "sales/credit-notes": { label: t("newCreditNote"), drawer: "creditNote" },
    "sales/recurring": { label: t("newRecurring"), drawer: "recurring" },
    "sales/customer-prepayments": { label: t("newPrepayment"), drawer: "customerCredit" },
    "sales/revenue-schedules": { label: t("newRevenueSchedule"), drawer: "revenueSchedule" },
    purchases: { label: t("newBill"), drawer: "bill" },
    "purchases/expenses": { label: t("newExpense"), drawer: "expense" },
    "purchases/orders": { label: t("newPO"), drawer: "purchaseOrder" },
    "purchases/debit-notes": { label: t("newSupplierCredit"), drawer: "debitNote" },
    accounting: { label: t("newEntry"), drawer: "entry" },
    "accounting/accounts": { label: t("newAccount"), drawer: "account" },
    "accounting/banking": { label: t("newAccount"), drawer: "bankAccount" },
    "accounting/fixed-assets": { label: t("newAsset"), drawer: "fixedAsset" },
    "accounting/budgets": { label: t("newBudget"), drawer: "budget" },
    "accounting/loans": { label: t("newLoan"), drawer: "loan" },
    "accounting/opening-balances": { label: t("setOpeningBalances"), drawer: "openingBalance" },
    "accounting/accruals": { label: t("newAccrual"), drawer: "accrualSchedule" },
    "accounting/recurring-journals": { label: t("newRecurringJournal"), drawer: "recurringJournal" },
    contacts: { label: t("newContact"), drawer: "contact" },
    projects: { label: t("newProject2"), drawer: "project" },
    inventory: { label: t("newItem"), drawer: "inventory" },
    "inventory/stock-takes": { label: t("newStockTake"), drawer: "stockTake" },
    "inventory/warehouses": { label: t("newWarehouse"), drawer: "warehouse" },
    "inventory/transfers": { label: t("newTransfer"), drawer: "transfer" },
    "inventory/valuation": null,
    "payroll/employees": { label: t("newEmployee"), drawer: "employee" },
    "payroll/contractors": { label: t("addContractor"), drawer: "contractor" },
    "payroll/time-leave": null,
    "payroll/compensation": null,
    "payroll/analytics": null,
    teams: null,
  };

  const pathname = usePathname();
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const entityTitle = useEntityTitle();
  const { toggleSidebar, isMobile } = useSidebar();
  const segments = pathname.split("/").filter(Boolean);

  // For group roots, show the default subtab in the breadcrumb
  const DEFAULT_SUBTABS: Record<string, string> = {
    settings: "general",
    sales: "invoices",
    purchases: "bills",
    accounting: "transactions",
  };
  const defaultSub = segments.length === 1 ? DEFAULT_SUBTABS[segments[0]] : undefined;
  const effectiveSegments = defaultSub ? [segments[0], defaultSub] : segments;

  // For entity detail pages like /projects/[id] or /accounting/banking/[id],
  // detect the pattern and show proper breadcrumbs
  const isEntityDetail = segments.length >= 2 && segments[0] in LABELS && !(segments[1] in LABELS);
  // Also detect nested entity detail: /accounting/banking/[id] where segments[2] is not a known label
  const isNestedEntityDetail = segments.length >= 3 && segments[0] in LABELS && segments[1] in LABELS && !(segments[2] in LABELS);
  let pageTitle: string;
  let parentLabel: string | null;
  let parentHref: string | null = null;

  if (isNestedEntityDetail) {
    parentLabel = getLabel(segments[1]);
    parentHref = `/${segments[0]}/${segments[1]}`;
    if (entityTitle) {
      pageTitle = entityTitle;
    } else {
      const subTab = segments.length > 3 ? segments[segments.length - 1] : null;
      pageTitle = subTab ? (getLabel(subTab)) : (getLabel(segments[1]));
      if (!subTab) parentLabel = null;
    }
  } else if (isEntityDetail) {
    parentLabel = getLabel(segments[0]);
    parentHref = `/${segments[0]}`;
    if (entityTitle) {
      pageTitle = entityTitle;
    } else {
      const subTab = segments.length > 2 ? segments[segments.length - 1] : null;
      pageTitle = subTab ? (getLabel(subTab)) : (getLabel(segments[0]));
      if (!subTab) parentLabel = null;
    }
  } else {
    pageTitle = effectiveSegments[effectiveSegments.length - 1] ? getLabel(effectiveSegments[effectiveSegments.length - 1]) : t("overview");
    parentLabel = effectiveSegments.length > 1 ? getLabel(effectiveSegments[0]) : null;
  }

  const subtabKey = `${segments[0]}/${segments[1]}`;
  const cta = subtabKey in CTA_MAP ? CTA_MAP[subtabKey] : CTA_MAP[segments[0]];

  const openCommandPalette = useCallback(() => {
    document.dispatchEvent(new CustomEvent("open-command-palette"));
  }, []);

  return (
    <header className="shrink-0">
      <div className="mx-auto flex h-14 w-full max-w-[1250px] items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {isMobile && (
            <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={toggleSidebar} aria-label={t("toggleSidebar")}>
              <Menu className="size-4" />
            </Button>
          )}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo className="h-5 w-auto" />
            <span className="text-[14px] font-semibold tracking-tight hidden sm:inline">dubbl</span>
          </Link>
          <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
          {parentLabel && effectiveSegments.length > 1 && (
            <div className="hidden sm:contents">
              {parentHref ? (
                <Link href={parentHref} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  {parentLabel}
                </Link>
              ) : (
                <span className="text-[13px] text-muted-foreground shrink-0">{parentLabel}</span>
              )}
              <span className="text-muted-foreground/40 shrink-0">/</span>
            </div>
          )}
          <h1 className="text-[13px] text-muted-foreground truncate">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationDropdown />
          <ThemeToggle className="[&_button]:size-6 [&_button_svg]:size-3" />
          <div className="h-4 w-px bg-border" />
          <Button
            variant="outline"
            size="sm"
            onClick={openCommandPalette}
            className="hidden sm:flex items-center gap-2 text-muted-foreground text-xs h-7 px-2.5"
          >
            <Search className="size-3" />
            <span>{t("search")}</span>
            <kbd className="pointer-events-none ms-1 inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </Button>
          {cta && (
            <>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => openDrawer(cta.drawer)}
              >
                <Plus className="size-3" />
                <span className="hidden sm:inline">{cta.label}</span>
              </Button>
            </>
          )}
          {customAction && (
            <>
              <div className="h-4 w-px bg-border" />
              {customAction}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
