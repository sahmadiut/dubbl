"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation } from "@/i18n/provider";
import { localeDirection } from "@/i18n/locale";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  Minus,
  ArrowRight,
  Mail,
  FileBox,
  Github,
  Sparkles,
  Zap,
} from "lucide-react";
import { GrainGradient } from "@paper-design/shaders-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, PLAN_PRICES, STORAGE_PLANS } from "@/lib/plans";

type LegalTranslator = ReturnType<typeof useTranslations<"PublicPricingLegal">>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(t: LegalTranslator, v: number): string {
  if (v === Infinity) return t("unlimited");
  return v.toLocaleString();
}

function fmtStorage(t: LegalTranslator, mb: number): string {
  if (mb === Infinity) return t("unlimited");
  if (mb >= 1024) return `${mb / 1024} GB`;
  return `${mb} MB`;
}

function fmtAudit(t: LegalTranslator, days: number): string {
  if (days === Infinity) return t("unlimited");
  if (days >= 365) return t("auditYear", {count: Math.floor(days / 365)});
  return t("auditDays", {count: days});
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const getStoragePlansMeta = (t: LegalTranslator) => [
  { key: "free" as const, name: t("free"), description: t("includedWithEveryOrg"), example: t("documentsReceiptsAndInvoiceAttachments") },
  { key: "starter" as const, name: t("starter"), description: t("forGrowingTeams"), example: t("bulkDocumentUploadsYearsOfReceipts") },
  { key: "growth" as const, name: t("growth"), description: t("forEstablishedBusinesses"), example: t("largeFileArchivesWithFullAttachmentHistory") },
  { key: "scale" as const, name: t("scale"), description: t("forLargeOrganizations"), example: t("enterpriseGradeDocumentArchival") },
];

const getComparisonRows = (t: LegalTranslator) => [
  { label: t("teamMembers"), free: fmt(t, PLAN_LIMITS.free.members), pro: fmt(t, PLAN_LIMITS.pro.members) },
  { label: t("journalEntriesMonth"), free: fmt(t, PLAN_LIMITS.free.entriesPerMonth), pro: fmt(t, PLAN_LIMITS.pro.entriesPerMonth) },
  { label: t("contacts"), free: fmt(t, PLAN_LIMITS.free.contacts), pro: fmt(t, PLAN_LIMITS.pro.contacts) },
  { label: t("invoicesMonth"), free: fmt(t, PLAN_LIMITS.free.invoicesPerMonth), pro: fmt(t, PLAN_LIMITS.pro.invoicesPerMonth) },
  { label: t("bankAccounts"), free: fmt(t, PLAN_LIMITS.free.bankAccounts), pro: fmt(t, PLAN_LIMITS.pro.bankAccounts) },
  { label: t("projects"), free: fmt(t, PLAN_LIMITS.free.projects), pro: fmt(t, PLAN_LIMITS.pro.projects) },
  { label: t("storageIncluded"), free: fmtStorage(t, PLAN_LIMITS.free.storageMb), pro: fmtStorage(t, PLAN_LIMITS.pro.storageMb) },
  { label: t("emailsMonth"), free: fmt(t, PLAN_LIMITS.free.emailsPerMonth), pro: fmt(t, PLAN_LIMITS.pro.emailsPerMonth) },
  { label: t("auditLogRetention"), free: fmtAudit(t, PLAN_LIMITS.free.auditLogDays), pro: fmtAudit(t, PLAN_LIMITS.pro.auditLogDays) },
];

const getFeatureRows = (t: LegalTranslator): { label: string; free: boolean; pro: boolean }[] => [
  { label: t("doubleEntryBookkeeping"), free: true, pro: true },
  { label: t("trialBalanceGeneralLedger"), free: true, pro: true },
  { label: t("balanceSheetIncomeStatement"), free: false, pro: true },
  { label: t("profitLossReport"), free: false, pro: true },
  { label: t("cashFlowStatement"), free: false, pro: true },
  { label: t("agedReceivablesPayables"), free: false, pro: true },
  { label: t("accountTransactionReports"), free: false, pro: true },
  { label: t("aPIAccess"), free: PLAN_LIMITS.free.apiAccess, pro: PLAN_LIMITS.pro.apiAccess },
  { label: t("cRMSalesPipeline"), free: true, pro: true },
  { label: t("invoicingBilling"), free: true, pro: true },
  { label: t("bankReconciliation"), free: true, pro: true },
  { label: t("multiCurrencySupport"), free: false, pro: true },
  { label: t("communitySupport"), free: true, pro: true },
  { label: t("emailSupport"), free: false, pro: true },
  { label: t("prioritySupport"), free: false, pro: true },
];

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */

function ComparisonValue({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <div className="mx-auto flex size-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      </div>
    ) : (
      <Minus className="mx-auto size-4 text-muted-foreground/25" />
    );
  }
  return (
    <span className="font-mono text-sm font-medium tabular-nums text-foreground">
      <BidiText>{value}</BidiText>
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/40 to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  const t = useTranslations("PublicPricingLegal");
  const direction = localeDirection(usePresentation().locale);
  const comparisonRows = getComparisonRows(t);
  const featureRows = getFeatureRows(t);
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const price = (plan: keyof typeof PLAN_PRICES) =>
    interval === "annual" ? PLAN_PRICES[plan].annual : PLAN_PRICES[plan].monthly;

  return (
    <div className="relative">
      <Container className="relative pt-32 pb-24">
        {/* Hero */}
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 dark:border-emerald-800 dark:bg-emerald-950">
            <div className="size-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("transparentPricing")}</span>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            {t.rich("pricingHeading", {em: (chunks) => <span className="italic bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 bg-clip-text text-transparent dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300">{chunks}</span>})}
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
            {t("twoSimplePlansStorageAddOnsWhenYou")}</p>

          <div className="relative mt-8 grid max-w-full grid-cols-2 rounded-full border bg-muted/50 p-1 w-fit mx-auto">
            <motion.div
              className="absolute inset-y-1 start-0 w-[calc(50%-2px)] rounded-full bg-background shadow-sm"
              initial={false}
              animate={{ x: interval === "monthly" ? (direction === "rtl" ? -4 : 4) : (direction === "rtl" ? "calc(-100% - 4px)" : "calc(100% + 4px)") }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
            <button
              onClick={() => setInterval("monthly")}
              aria-pressed={interval === "monthly"}
              className={cn(
                "relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                interval === "monthly" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("monthly")}</button>
            <button
              onClick={() => setInterval("annual")}
              aria-pressed={interval === "annual"}
              className={cn(
                "relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors",
                interval === "annual" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("annual")}<span className="ms-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{t("save17")}</span>
            </button>
          </div>
        </motion.div>

        {/* Seat Plans */}
        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <SectionLabel>{t("teamPlans")}</SectionLabel>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* Free */}
            <div className="group relative flex flex-col rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg hover:shadow-black/5">
              <div className="flex flex-1 flex-col p-8 lg:p-10">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                    <Sparkles className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t("free")}</h3>
                    <p className="text-xs text-muted-foreground">{t("forIndividuals")}</p>
                  </div>
                </div>

                <div className="mt-8 flex items-baseline gap-2">
                  <span dir="ltr" className="[unicode-bidi:isolate] font-mono text-6xl font-bold tracking-tighter text-foreground">
                    $0
                  </span>
                  <span className="text-sm text-muted-foreground">{t("forever")}</span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {t("everythingYouNeedForPersonalBookkeepingNoCredit")}</p>

                <div className="mt-8 flex-1">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                      t("memberOwner", {count: fmt(t, PLAN_LIMITS.free.members)}),
                      t("entriesPerMonth", {count: fmt(t, PLAN_LIMITS.free.entriesPerMonth)}),
                      t("contactsCount", {count: fmt(t, PLAN_LIMITS.free.contacts)}),
                      t("invoicesPerMonth", {count: fmt(t, PLAN_LIMITS.free.invoicesPerMonth)}),
                      t("bankAccountCount", {count: fmt(t, PLAN_LIMITS.free.bankAccounts)}),
                      t("projectsCount", {count: fmt(t, PLAN_LIMITS.free.projects)}),
                      t("emailsPerMonth", {count: fmt(t, PLAN_LIMITS.free.emailsPerMonth)}),
                      t("singleCurrency"),
                      t("trialBalanceGl"),
                      t("storageAmount", {amount: fmtStorage(t, PLAN_LIMITS.free.storageMb)}),
                      t("auditLog", {duration: fmtAudit(t, PLAN_LIMITS.free.auditLogDays)}),
                      t("communitySupport"),
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-[13px]">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-10">
                  <Button variant="outline" className="w-full h-12 text-sm font-medium" asChild>
                    <a href="/sign-up">{t("getStartedFree")}</a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Pro */}
            <div className="group relative flex flex-col rounded-2xl border-2 border-emerald-500/40 bg-card transition-shadow hover:shadow-lg hover:shadow-emerald-500/10 dark:border-emerald-500/30">
              {/* Badge */}
              <div className="absolute end-6 top-6">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 dark:border-emerald-800 dark:bg-emerald-950">
                  <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {t("popular")}</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-8 lg:p-10">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
                    <Zap className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t("pro")}</h3>
                    <p className="text-xs text-muted-foreground">{t("forTeams")}</p>
                  </div>
                </div>

                <div className="mt-8 flex items-baseline gap-2">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={interval}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      dir="ltr" className="[unicode-bidi:isolate] font-mono text-6xl font-bold tracking-tighter text-foreground"
                    >
                      ${price("pro")}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-sm text-muted-foreground">{t("seatMo")}</span>
                  {interval === "annual" && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      dir="ltr" className="[unicode-bidi:isolate] text-sm text-muted-foreground line-through"
                    >
                      ${PLAN_PRICES.pro.monthly}
                    </motion.span>
                  )}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={interval}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="mt-1 text-xs text-muted-foreground/70"
                  >
                    {interval === "annual" ? t("billedAnnual", {amount: price("pro") * 12}) : t("billedMonthly")}
                  </motion.p>
                </AnimatePresence>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {t("advancedReportsAPIAccessMultiCurrencyAndTeam")}</p>

                <div className="mt-8 flex-1">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                      t("upToMembers", {count: fmt(t, PLAN_LIMITS.pro.members)}),
                      t("unlimitedEntries"),
                      t("unlimitedContacts"),
                      t("unlimitedInvoices"),
                      t("unlimitedBankAccounts"),
                      t("projectsCount", {count: fmt(t, PLAN_LIMITS.pro.projects)}),
                      t("emailsPerMonth", {count: fmt(t, PLAN_LIMITS.pro.emailsPerMonth)}),
                      t("allStandardReports"),
                      t("storageAmount", {amount: fmtStorage(t, PLAN_LIMITS.pro.storageMb)}),
                      t("auditLog", {duration: fmtAudit(t, PLAN_LIMITS.pro.auditLogDays)}),
                      t("fullApiAccess"),
                      t("multiCurrency"),
                      t("prioritySupport"),
                    ].map((f) => (
                      <div key={f} className="flex items-center gap-2 text-[13px]">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-10">
                  <Button
                    className="w-full h-12 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                    asChild
                  >
                    <a href="/sign-up?plan=pro">
                      {t("startFreeTrial")}<ArrowRight className="ms-1.5 size-4 shrink-0 [&:dir(rtl)]:rotate-180" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Storage Add-ons */}
        <motion.div
          className="mt-32"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <SectionLabel>{t("storageEmails")}</SectionLabel>

          <div className="mt-4 mx-auto max-w-2xl text-center">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("addStorageAsYouGrow")}</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {t("fileStorageForDocumentsReceiptsAndAttachmentsCustomer")}</p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {getStoragePlansMeta(t).map((meta, i) => {
              const plan = STORAGE_PLANS[meta.key];
              const currentPrice = interval === "annual" ? plan.annual : plan.monthly;
              const files = fmtStorage(t, plan.filesMb);
              const emails = t("emailCountPerMonth", {count: plan.emailsPerMonth.toLocaleString()});

              return (
                <motion.div
                  key={meta.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card transition-all hover:shadow-lg hover:shadow-black/5 hover:border-emerald-500/30"
                >
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{meta.name}</h3>
                      {i === 0 && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t("included")}</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-baseline gap-1">
                      {currentPrice === 0 ? (
                        <span dir="ltr" className="[unicode-bidi:isolate] font-mono text-3xl font-bold tracking-tighter">$0</span>
                      ) : (
                        <>
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={interval}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2 }}
                              dir="ltr" className="[unicode-bidi:isolate] font-mono text-3xl font-bold tracking-tighter"
                            >
                              ${currentPrice}
                            </motion.span>
                          </AnimatePresence>
                          <span className="text-xs text-muted-foreground">{t("mo")}</span>
                          {interval === "annual" && plan.monthly > 0 && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              dir="ltr" className="[unicode-bidi:isolate] text-sm text-muted-foreground line-through"
                            >
                              ${plan.monthly}
                            </motion.span>
                          )}
                        </>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">{meta.description}</p>

                    {/* Stats */}
                    <div className="mt-5 space-y-3 flex-1">
                      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FileBox className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs text-muted-foreground">{t("files")}</span>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums"><IdentifierText>{files}</IdentifierText></span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs text-muted-foreground">{t("emails")}</span>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums"><IdentifierText>{emails}</IdentifierText></span>
                      </div>

                      <p className="text-[11px] leading-relaxed text-muted-foreground/70 px-1">
                        {meta.example}
                      </p>
                    </div>

                    <div className="mt-6">
                      {i === 0 ? (
                        <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                          {t("included")}</Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs group-hover:border-emerald-500/40 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors"
                          asChild
                        >
                          <a href="/sign-up">{t("addStorage", {name: meta.name})}</a>
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Self-hosting callout */}
        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          <div className="rounded-2xl border border-border bg-muted/30 px-8 py-8 lg:px-12">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Github className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {t("openSource")}</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("selfHostWithZeroLimits")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("dubblIsApache20LicensedSelfHosted")}</p>
              </div>
              <Button
                variant="outline"
                asChild
              >
                <a
                  href="https://github.com/dubbl-org/dubbl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="me-2 size-4" />
                  {t("viewOnGitHub")}</a>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          className="mt-32"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <SectionLabel>{t("compare")}</SectionLabel>

          <div className="mt-4 mx-auto max-w-2xl text-center mb-12">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("everyDetailSideBySide")}</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[32rem]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-4 ps-6 pe-4 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[55%]">
                    {t("feature")}</th>
                  <th className="py-4 text-center w-[22.5%]">
                    <span className="text-sm font-semibold text-foreground">{t("free")}</span>
                  </th>
                  <th className="py-4 pe-6 text-center w-[22.5%]">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {t("pro")}</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        <IdentifierText>${price("pro")}</IdentifierText>{t("seat")}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Limits */}
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 pb-1 pt-6 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400"
                  >
                    {t("limits")}</td>
                </tr>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      i < comparisonRows.length - 1 && "border-b border-border/40"
                    )}
                  >
                    <td className="py-3 ps-6 pe-4 text-sm text-foreground">{row.label}</td>
                    <td className="py-3 text-center">
                      <ComparisonValue value={row.free} />
                    </td>
                    <td className="py-3 pe-6 text-center">
                      <ComparisonValue value={row.pro} />
                    </td>
                  </tr>
                ))}

                {/* Features & Support */}
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 pb-1 pt-6 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400"
                  >
                    {t("featuresSupport")}</td>
                </tr>
                {featureRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "transition-colors hover:bg-muted/30",
                      i < featureRows.length - 1 && "border-b border-border/40"
                    )}
                  >
                    <td className="py-3 ps-6 pe-4 text-sm text-foreground">{row.label}</td>
                    <td className="py-3 text-center">
                      <ComparisonValue value={row.free} />
                    </td>
                    <td className="py-3 pe-6 text-center">
                      <ComparisonValue value={row.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div
          className="mt-32"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          <SectionLabel>{t("fAQ")}</SectionLabel>

          <div className="mt-4 mx-auto max-w-2xl text-center mb-12">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("commonQuestions")}</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                q: t("canISwitchPlans"),
                a: t("yesUpgradeOrDowngradeAtAnyTimeUpgrades"),
              },
              {
                q: t("whatIfIExceedLimits"),
                a: t("weWonTCutYouOffYouLl"),
              },
              {
                q: t("annualBilling"),
                a: t("yesPayFor10MonthsGet12Switch"),
              },
              {
                q: t("isSelfHostingReallyFree"),
                a: t("yesApache20LicensedNoFeatureLimits"),
              },
              {
                q: t("canIAddStorageSeparately"),
                a: t("yesStorageAddOnsAreIndependentYouCan"),
              },
              {
                q: t("howDoesSeatPricingWork"),
                a: t("everyMemberCountsAsASeatProIs"),
              },
            ].map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.06 }}
                className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
              >
                <h3 className="text-sm font-semibold text-foreground">{faq.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-32"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 px-8 py-16 text-center lg:px-16 lg:py-20">
            <GrainGradient
              className="pointer-events-none !absolute !inset-0 !rounded-none"
              width="100%"
              height="100%"
              colors={["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#34d399", "#a7f3d0"]}
              colorBack="#10b981"
              softness={1}
              intensity={0.8}
              noise={0.9}
              shape="wave"
              scale={3.5}
              speed={0.2}
            />

            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                {t("startManagingYourBusinessToday")}</h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
                {t("selfHostInMinutesExtendViaAPIAnd")}</p>
              <p className="mt-6 text-sm text-white/40">
                {t("openSourceSelfHostableFreeForever")}</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/sign-up"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-sm font-medium text-emerald-700 transition-colors hover:bg-white/90"
                >
                  {t("getStarted")}<ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 px-8 text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  {t("contactSales")}</Link>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
