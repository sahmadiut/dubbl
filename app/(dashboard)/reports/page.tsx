"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  BarChart3,
  Scale,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BookOpen,
  Target,
  Clock,
  ArrowDownUp,
  Receipt,
  ArrowLeftRight,
  Gauge,
  Layers,
  Compass,
  Users,
  CalendarDays,
  GitCompareArrows,
  ShoppingBag,
  Timer,
  Copy,
  Building2,
  FileText,
  Sparkles,
  Package2,
  FileCheck2,
} from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

const reportCategories = [
  {
    title: "category_big_picture_title",
    description: "category_big_picture_description",
    reports: [
      {
        title: "report_executive_summary_title",
        description: "report_executive_summary_description",
        href: "/reports/executive-summary",
        icon: Sparkles,
      },
      {
        title: "report_profit_and_loss_title",
        description: "report_profit_and_loss_description",
        href: "/reports/profit-and-loss",
        icon: TrendingUp,
      },
      {
        title: "report_balance_sheet_title",
        description: "report_balance_sheet_description",
        href: "/reports/balance-sheet",
        icon: BarChart3,
      },
      {
        title: "report_cash_flow_title",
        description: "report_cash_flow_description",
        href: "/reports/cash-flow",
        icon: ArrowDownUp,
      },
      {
        title: "report_pack_title",
        description: "report_pack_description",
        href: "/reports/pack",
        icon: Package2,
      },
    ],
  },
  {
    title: "category_profit_spending_title",
    description: "category_profit_spending_description",
    reports: [
      {
        title: "report_tracking_title",
        description: "report_tracking_description",
        href: "/reports/tracking",
        icon: Layers,
      },
      {
        title: "report_pnl_comparison_title",
        description: "report_pnl_comparison_description",
        href: "/reports/pnl-comparison",
        icon: ArrowLeftRight,
      },
      {
        title: "report_budget_vs_actual_title",
        description: "report_budget_vs_actual_description",
        href: "/reports/budget-vs-actual",
        icon: Target,
      },
      {
        title: "report_expense_analytics_title",
        description: "report_expense_analytics_description",
        href: "/reports/expense-analytics",
        icon: TrendingDown,
      },
      {
        title: "report_profitability_title",
        description: "report_profitability_description",
        href: "/reports/profitability",
        icon: Users,
      },
      {
        title: "report_vendor_spend_title",
        description: "report_vendor_spend_description",
        href: "/reports/vendor-spend",
        icon: ShoppingBag,
      },
    ],
  },
  {
    title: "category_getting_paid_title",
    description: "category_getting_paid_description",
    reports: [
      {
        title: "report_aged_receivables_title",
        description: "report_aged_receivables_description",
        href: "/reports/aged-receivables",
        icon: Clock,
      },
      {
        title: "report_aged_payables_title",
        description: "report_aged_payables_description",
        href: "/reports/aged-payables",
        icon: DollarSign,
      },
      {
        title: "report_payment_performance_title",
        description: "report_payment_performance_description",
        href: "/reports/payment-performance",
        icon: Timer,
      },
      {
        title: "report_duplicate_detection_title",
        description: "report_duplicate_detection_description",
        href: "/reports/duplicate-detection",
        icon: Copy,
      },
    ],
  },
  {
    title: "category_tax_title",
    description: "category_tax_description",
    reports: [
      {
        title: "report_vat_return_title",
        description: "report_vat_return_description",
        href: "/reports/vat-return",
        icon: FileCheck2,
      },
      {
        title: "report_tax_summary_title",
        description: "report_tax_summary_description",
        href: "/reports/tax-summary",
        icon: Receipt,
      },
      {
        title: "report_1099_title",
        description: "report_1099_description",
        href: "/reports/1099",
        icon: FileText,
      },
    ],
  },
  {
    title: "category_planning_title",
    description: "category_planning_description",
    reports: [
      {
        title: "report_cash_flow_forecast_title",
        description: "report_cash_flow_forecast_description",
        href: "/reports/cash-flow-forecast",
        icon: Compass,
      },
      {
        title: "report_financial_calendar_title",
        description: "report_financial_calendar_description",
        href: "/reports/financial-calendar",
        icon: CalendarDays,
      },
      {
        title: "report_financial_ratios_title",
        description: "report_financial_ratios_description",
        href: "/reports/financial-ratios",
        icon: Gauge,
      },
    ],
  },
  {
    title: "category_accountant_title",
    description: "category_accountant_description",
    reports: [
      {
        title: "report_trial_balance_title",
        description: "report_trial_balance_description",
        href: "/reports/trial-balance",
        icon: Scale,
      },
      {
        title: "report_general_ledger_title",
        description: "report_general_ledger_description",
        href: "/reports/general-ledger",
        icon: BookOpen,
      },
      {
        title: "report_comparative_balance_sheet_title",
        description: "report_comparative_balance_sheet_description",
        href: "/reports/comparative-balance-sheet",
        icon: GitCompareArrows,
      },
      {
        title: "report_consolidation_title",
        description: "report_consolidation_description",
        href: "/reports/consolidation",
        icon: Building2,
      },
    ],
  },
  {
    title: "category_save_schedule_title",
    description: "category_save_schedule_description",
    reports: [
      {
        title: "report_bank_reconciliation_status_title",
        description: "report_bank_reconciliation_status_description",
        href: "/reports/bank-reconciliation-status",
        icon: FileCheck2,
      },
      {
        title: "report_bank_cash_flow_title",
        description: "report_bank_cash_flow_description",
        href: "/reports/bank-cash-flow",
        icon: ArrowDownUp,
      },
      {
        title: "report_saved_title",
        description: "report_saved_description",
        href: "/reports/saved",
        icon: FileText,
      },
      {
        title: "report_schedules_title",
        description: "report_schedules_description",
        href: "/reports/schedules",
        icon: CalendarDays,
      },
    ],
  },
] as const;

export default function ReportsPage() {
  const t = useTranslations("ReportDirectory");
  useDocumentTitle(t("documentTitle"));
  return (
    <ContentReveal>
      <div className="space-y-6 sm:space-y-10">
        {reportCategories.map((category, i) => (
          <div key={category.title}>
            {i > 0 && <div className="mb-6 sm:mb-10 h-px bg-border" />}
            <Section title={t(category.title)} description={t(category.description)}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {category.reports.map((report) => (
                  <Link
                    key={report.href}
                    href={report.href}
                    className="group rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 sm:p-6 shadow-sm transition-all duration-150 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="flex size-9 sm:size-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                      <report.icon className="size-4 sm:size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="mt-3 sm:mt-4 text-sm font-semibold">{t(report.title)}</h3>
                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                      {t(report.description)}
                    </p>
                  </Link>
                ))}
              </div>
            </Section>
          </div>
        ))}
      </div>
    </ContentReveal>
  );
}
