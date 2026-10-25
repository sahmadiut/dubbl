"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { authoredUsdText } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  Clock,
  FileQuestion,
  Check,
  FileText,
  Building2,
  Globe,
} from "lucide-react";
import { GradientBackground } from "./gradient-background";
import { Container } from "@/components/shared/container";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { cn } from "@/lib/utils";
import { useLandingActivity } from "./use-landing-activity";

type LandingTranslator = ReturnType<typeof useTranslations>;

/* -------------------------------------------------------------------------- */
/*  Problem Cards — realistic mockup internals                                */
/* -------------------------------------------------------------------------- */

function BankTimelineMockup() {
  const t = useTranslations("LandingFeatures");
  const events = [
    { label: t("aCHTransferPayroll"), status: "success", time: t("demo2DaysAgo") },
    { label: t("wireVendor4092"), status: "failed", time: t("demo3DaysAgo") },
    { label: t("directDebitOfficeLease"), status: "delayed", time: t("demo5DaysAgo") },
    { label: t("cardPaymentSaaSSub"), status: "success", time: t("demo6DaysAgo") },
  ];

  const statusStyles: Record<string, { dot: string; label: string }> = {
    success: { dot: "bg-emerald-500", label: t("synced") },
    failed: { dot: "bg-red-500", label: t("failed") },
    delayed: { dot: "bg-amber-500", label: t("delayed") },
  };

  return (
    <div className="space-y-0">
      {events.map((ev, i) => {
        const s = statusStyles[ev.status];
        return (
          <div key={i} className="flex items-start gap-3 py-2">
            <div className="flex flex-col items-center pt-1">
              <span className={cn("size-2 rounded-full", s.dot)} />
              {i < events.length - 1 && (
                <span className="mt-1 h-5 w-px bg-border" />
              )}
            </div>
            <div className="flex flex-1 items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium leading-tight text-foreground">
                  {ev.label}
                </p>
                <p className="text-[10px] text-muted-foreground">{ev.time}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold",
                  ev.status === "success" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
                  ev.status === "failed" &&
                    "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
                  ev.status === "delayed" &&
                    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                )}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MissingRecordsMockup() {
  const presentation = usePresentation();
  const t = useTranslations("LandingFeatures");
  const rows = [
    { id: "INV-1041", vendor: "Acme Corp", amount: authoredUsdText("$3,200", presentation.locale), status: "ok" },
    { id: "INV-1042", vendor: "—", amount: "—", status: "missing" },
    { id: "INV-1043", vendor: "Globex Inc", amount: authoredUsdText("$890", presentation.locale), status: "ok" },
    { id: "INV-1044", vendor: "—", amount: authoredUsdText("$1,475", presentation.locale), status: "partial" },
  ];

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
      {/* Scan line animation */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 4, ease: "easeInOut" }}
      />
      <div className="grid grid-cols-4 border-b border-border bg-muted/60 text-[10px] font-semibold text-muted-foreground">
        <div className="border-e border-border px-3 py-1.5">{t("invoice")}</div>
        <div className="border-e border-border px-3 py-1.5">{t("vendor")}</div>
        <div className="border-e border-border px-3 py-1.5">{t("amount")}</div>
        <div className="px-3 py-1.5">{t("status")}</div>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-4 text-[10px]",
            i < rows.length - 1 && "border-b border-border",
            row.status !== "ok" && "bg-amber-500/5"
          )}
        >
          <div className="border-e border-border px-3 py-1.5 font-mono text-foreground">
            <IdentifierText>{row.id}</IdentifierText>
          </div>
          <div
            className={cn(
              "border-e border-border px-3 py-1.5",
              row.vendor === "—" ? "text-muted-foreground/40" : "text-foreground"
            )}
          >
            <BidiText>{row.vendor}</BidiText>
          </div>
          <div
            className={cn(
              "border-e border-border px-3 py-1.5",
              row.amount === "—" ? "text-muted-foreground/40" : "text-foreground"
            )}
          >
            <IdentifierText>{authoredUsdText(row.amount, presentation.locale)}</IdentifierText>
          </div>
          <div className="px-3 py-1.5">
            {row.status === "ok" ? (
              <span className="text-emerald-600 dark:text-emerald-400">{t("complete")}</span>
            ) : row.status === "missing" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                <AlertTriangle className="size-2.5" />
                {t("missing")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-2.5" />
                {t("partial")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Problem Section                                                           */
/* -------------------------------------------------------------------------- */

function ProblemSection() {
  const presentation = usePresentation();
  const t = useTranslations("LandingFeatures");
  return (
    <section className="py-16 md:py-20">
      <Container>
        {/* Header band with grain gradient */}
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-2xl border border-red-400/30 p-8 dark:border-red-500/20 md:p-12">
            <GradientBackground tone="red" />
            <div className="relative">
              <div className="mb-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-red-300/60 bg-red-900/30 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                  <span className="inline-block size-1.5 rounded-full bg-red-300" />
                  {t("theProblem")}
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                {t.rich("problemHeading", {em: (chunks) => <span className="text-red-950">{chunks}</span>})}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-red-100">
                {t("separateToolsForAccountingProjectTrackingInventoryPayrollAnd")}
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Asymmetric card grid */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {/* Hero card — spans 2 columns, full grain gradient bg */}
          <ScrollReveal delay={0.1} className="md:col-span-2">
            <motion.div
              whileHover={{ y: -6, scale: 1.005 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-red-400/30 dark:border-red-500/20"
            >
              {/* Full card grain gradient background */}
              <GradientBackground tone="red" />
              {/* Broken spreadsheet grid filling the entire card */}
              <div className="relative flex-1">
                {/* Grid of cells — fills naturally */}
                <div className="grid auto-rows-fr grid-cols-6 md:grid-cols-8">
                  {[
                    authoredUsdText("$142,500", presentation.locale), "#REF!", authoredUsdText("$—", presentation.locale), "MISMATCH", authoredUsdText("$156,800", presentation.locale), "#N/A", authoredUsdText("$178,300", presentation.locale), "#VALUE!",
                    authoredUsdText("$—", presentation.locale), authoredUsdText("$138,200", presentation.locale), "#DIV/0!", authoredUsdText("$161,400", presentation.locale), "#NULL!", authoredUsdText("$174,900", presentation.locale), "ERR:502", authoredUsdText("$—", presentation.locale),
                    "#NAME?", authoredUsdText("$89,200", presentation.locale), authoredUsdText("$—", presentation.locale), authoredUsdText("$3,200", presentation.locale), "CONFLICT", "#SPILL!", authoredUsdText("$45,100", presentation.locale), "NaN",
                    authoredUsdText("$—", presentation.locale), "#REF!", authoredUsdText("$67,800", presentation.locale), "MISSING", authoredUsdText("$—", presentation.locale), "#ERROR!", authoredUsdText("$12,350", presentation.locale), authoredUsdText("$—", presentation.locale),
                    authoredUsdText("$92,100", presentation.locale), "DUPLICATE", authoredUsdText("$—", presentation.locale), "#N/A", authoredUsdText("$55,670", presentation.locale), authoredUsdText("$—", presentation.locale), "TIMEOUT", authoredUsdText("$78,400", presentation.locale),
                    "#VALUE!", authoredUsdText("$—", presentation.locale), authoredUsdText("$34,500", presentation.locale), "OVERWRITE", authoredUsdText("$—", presentation.locale), "#REF!", authoredUsdText("$—", presentation.locale), authoredUsdText("$23,100", presentation.locale),
                    authoredUsdText("$67,200", presentation.locale), "#SPILL!", authoredUsdText("$—", presentation.locale), authoredUsdText("$44,800", presentation.locale), "#REF!", authoredUsdText("$—", presentation.locale), "MISMATCH", authoredUsdText("$91,300", presentation.locale),
                    authoredUsdText("$—", presentation.locale), authoredUsdText("$15,700", presentation.locale), "#NAME?", authoredUsdText("$—", presentation.locale), authoredUsdText("$82,400", presentation.locale), "NaN", authoredUsdText("$—", presentation.locale), "#NULL!",
                    "#ERROR!", authoredUsdText("$—", presentation.locale), authoredUsdText("$56,100", presentation.locale), "CONFLICT", authoredUsdText("$—", presentation.locale), authoredUsdText("$73,200", presentation.locale), "#DIV/0!", authoredUsdText("$—", presentation.locale),
                    authoredUsdText("$—", presentation.locale), authoredUsdText("$28,900", presentation.locale), authoredUsdText("$—", presentation.locale), "#VALUE!", authoredUsdText("$48,600", presentation.locale), "MISSING", authoredUsdText("$—", presentation.locale), "ERR:502",
                    authoredUsdText("$33,700", presentation.locale), "#REF!", "TIMEOUT", authoredUsdText("$—", presentation.locale), authoredUsdText("$61,500", presentation.locale), authoredUsdText("$—", presentation.locale), "#N/A", "DUPLICATE",
                    authoredUsdText("$—", presentation.locale), authoredUsdText("$77,400", presentation.locale), authoredUsdText("$—", presentation.locale), "#SPILL!", authoredUsdText("$—", presentation.locale), "OVERWRITE", authoredUsdText("$19,800", presentation.locale), authoredUsdText("$—", presentation.locale),
                    authoredUsdText("$41,200", presentation.locale), "#NULL!", authoredUsdText("$—", presentation.locale), authoredUsdText("$88,300", presentation.locale), "#REF!", "NaN", authoredUsdText("$—", presentation.locale), "#VALUE!",
                    authoredUsdText("$—", presentation.locale), "MISSING", authoredUsdText("$52,900", presentation.locale), authoredUsdText("$—", presentation.locale), "#NAME?", authoredUsdText("$—", presentation.locale), authoredUsdText("$66,700", presentation.locale), "CONFLICT",
                    "#DIV/0!", authoredUsdText("$—", presentation.locale), authoredUsdText("$71,800", presentation.locale), "#SPILL!", authoredUsdText("$—", presentation.locale), authoredUsdText("$95,200", presentation.locale), authoredUsdText("$—", presentation.locale), "#ERROR!",
                    authoredUsdText("$—", presentation.locale), authoredUsdText("$36,400", presentation.locale), "DUPLICATE", authoredUsdText("$—", presentation.locale), "TIMEOUT", authoredUsdText("$—", presentation.locale), "#REF!", authoredUsdText("$43,500", presentation.locale),
                    authoredUsdText("$84,600", presentation.locale), authoredUsdText("$—", presentation.locale), "#N/A", authoredUsdText("$—", presentation.locale), "MISMATCH", authoredUsdText("$57,300", presentation.locale), authoredUsdText("$—", presentation.locale), "#NULL!",
                    authoredUsdText("$—", presentation.locale), "OVERWRITE", authoredUsdText("$—", presentation.locale), "#VALUE!", authoredUsdText("$—", presentation.locale), authoredUsdText("$68,900", presentation.locale), "ERR:502", authoredUsdText("$—", presentation.locale),
                  ].map((cell, i) => {
                    const isError = cell.startsWith("#") || ["MISMATCH", "MISSING", "CONFLICT", "DUPLICATE", "TIMEOUT", "OVERWRITE", "NaN", "ERR:502"].includes(cell);
                    const isEmpty = cell === authoredUsdText("$—", presentation.locale);
                    return (
                      <div
                        key={i}
                        className={cn(
                          "border-b border-r border-white/10 px-2 py-2 text-[9px] font-mono md:px-3 md:py-2.5 md:text-[10px]",
                          isError && "bg-white/10 font-bold text-white",
                          isEmpty && "text-white/30",
                          !isError && !isEmpty && "text-white/60"
                        )}
                      >
                        {isError ? (
                          <motion.span
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 2 + (i % 3), delay: (i % 5) * 0.4, ease: "easeInOut" }}
                          >
                            <IdentifierText>{cell}</IdentifierText>
                          </motion.span>
                        ) : (
                          cell
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overlay content card */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="pointer-events-auto mx-4 max-w-lg rounded-2xl border border-red-200/40 bg-white/80 p-6 shadow-2xl shadow-red-500/10 backdrop-blur-xl dark:border-red-400/20 dark:bg-card/80 md:p-8">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50">
                        <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {t("spreadsheetErrors")}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t("silentlyCorruptingYourData")}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t("copyPasteMistakesBrokenFormulasAndMissingReferencesSilently")}
                    </p>
                    <div className="mt-5 flex gap-3">
                      <div className="flex-1 rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/40 dark:bg-red-950/30">
                        <AnimatedCounter
                          target={67}
                          suffix="%"
                          className="text-2xl font-bold text-red-600 dark:text-red-400"
                        />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {t("containErrors")}
                        </p>
                      </div>
                      <div className="flex-1 rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/40 dark:bg-red-950/30">
                        <AnimatedCounter
                          target={42}
                          suffix="hrs"
                          className="text-2xl font-bold text-red-600 dark:text-red-400"
                        />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {t("wastedMonth")}
                        </p>
                      </div>
                      <div className="flex-1 rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/40 dark:bg-red-950/30">
                        <AnimatedCounter
                          target={23}
                          className="text-2xl font-bold text-red-600 dark:text-red-400"
                        />
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {t("errorsFound")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </ScrollReveal>

          {/* Right column — two stacked cards */}
          <div className="flex flex-col gap-5">
            {/* Delayed bank data */}
            <ScrollReveal delay={0.2}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <motion.div
                  className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent"
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 3, delay: 1, ease: "easeInOut" }}
                />
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40">
                      <Clock className="size-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("delayedBankData")}
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("statementsArriveDaysLateReconciliationIsAlwaysLaggingBehind")}
                  </p>
                  <BankTimelineMockup />
                </div>
              </motion.div>
            </ScrollReveal>

            {/* Missing records */}
            <ScrollReveal delay={0.3}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <motion.div
                  className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent"
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 3, delay: 2, ease: "easeInOut" }}
                />
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40">
                      <FileQuestion className="size-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("missingRecords")}
                    </h3>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("gapsInVendorDataLostInvoicesAndUnknownLine")}
                  </p>
                  <div className="mt-4">
                    <MissingRecordsMockup />
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Solution Dashboard                                                        */
/* -------------------------------------------------------------------------- */

/* --- View 0: Animated Marquee Rows --- */
const getMarqueeConfig = (t: LandingTranslator): { size: "lg" | "md" | "sm"; pills: { label: string; featured: boolean }[] }[] => [
  { size: "lg", pills: [{ label: t("invoice284712580Sent"), featured: true }, { label: t("pLReportGenerated"), featured: true }, { label: t("statementImported"), featured: false }, { label: t("expenseClaimApproved"), featured: false }, { label: t("taxReturnReady"), featured: true }] },
  { size: "sm", pills: [{ label: t("categorized"), featured: false }, { label: t("sent"), featured: false }, { label: t("paid"), featured: false }, { label: t("filed"), featured: false }, { label: t("logged"), featured: false }, { label: t("synced"), featured: false }, { label: t("approved"), featured: false }, { label: t("imported"), featured: false }, { label: t("autoTagged"), featured: false }, { label: t("booked"), featured: false }, { label: t("invoiced"), featured: false }, { label: t("tracked"), featured: false }] },
  { size: "md", pills: [{ label: t("quickBooksCSVParsed"), featured: false }, { label: t("chaseCSVParsed"), featured: false }, { label: t("billFromAWS3240"), featured: true }, { label: t("receipt340Office"), featured: true }, { label: t("xeroExportLoaded"), featured: false }, { label: t("waveCSVImported"), featured: false }, { label: t("bankStatementParsed"), featured: false }, { label: t("cSVImportComplete"), featured: false }] },
  { size: "lg", pills: [{ label: t("demo45000PaymentReceived"), featured: true }, { label: t("balanceSheetUpdated"), featured: false }, { label: t("multiCurrencyEnabled"), featured: false }, { label: t("payrollProcessed"), featured: true }, { label: t("cashFlowForecastReady"), featured: true }] },
  { size: "sm", pills: [{ label: t("reconciled"), featured: false }, { label: t("updated"), featured: false }, { label: t("matched"), featured: false }, { label: t("sorted"), featured: false }, { label: t("verified"), featured: false }, { label: t("closed"), featured: false }, { label: t("exported"), featured: false }, { label: t("synced"), featured: false }, { label: t("tagged"), featured: false }, { label: t("archived"), featured: false }, { label: t("settled"), featured: false }, { label: t("reviewed"), featured: false }] },
  { size: "md", pills: [{ label: t("invoiceToAcmeCorp"), featured: false }, { label: t("bill1200Rent"), featured: true }, { label: t("expense89SaaS"), featured: true }, { label: t("creditNoteIssued"), featured: false }, { label: t("recurringInvoiceSet"), featured: false }, { label: t("vendorPaymentSent"), featured: false }, { label: t("clientDepositLogged"), featured: false }, { label: t("journalEntryPosted"), featured: false }] },
  { size: "lg", pills: [{ label: t("yearEndCloseComplete"), featured: true }, { label: t("autoCategorized174900"), featured: true }, { label: t("gSTAutoCalculated"), featured: false }, { label: t("clientPortalLive"), featured: true }, { label: t("globalStatementImports"), featured: false }] },
  { size: "sm", pills: [{ label: t("booked"), featured: false }, { label: t("paid"), featured: false }, { label: t("sent"), featured: false }, { label: t("filed"), featured: false }, { label: t("logged"), featured: false }, { label: t("tagged"), featured: false }, { label: t("approved"), featured: false }, { label: t("synced"), featured: false }, { label: t("tracked"), featured: false }, { label: t("closed"), featured: false }, { label: t("imported"), featured: false }, { label: t("done"), featured: false }] },
  { size: "md", pills: [{ label: t("bankCSVReconciled"), featured: false }, { label: t("statementImported"), featured: false }, { label: t("payrollEntryPosted"), featured: false }, { label: t("multiCurrencyEntry"), featured: false }, { label: t("expenseCategorized"), featured: false }, { label: t("cSVMapped"), featured: false }, { label: t("bankCSVImported"), featured: false }, { label: t("transactionsMatched"), featured: false }] },
];

const marqueeSizeClasses = {
  lg: "px-5 py-2.5 text-sm",
  md: "px-3 py-1.5 text-[10px]",
  sm: "px-2 py-1 text-[9px]",
};

function MarqueeView({ active = false }: { active?: boolean }) {
  const presentation = usePresentation();
  const t = useTranslations("LandingFeatures");
  return (
    <div className="flex h-full flex-col justify-evenly overflow-hidden">
      {getMarqueeConfig(t).map((row, rowIdx) => {
        const duration = 25 + (rowIdx % 4) * 8;
        const reverse = rowIdx % 2 === 1;
        const sizeClass = marqueeSizeClasses[row.size];
        return (
          <div key={rowIdx} className="relative flex overflow-hidden">
            <div
              className="flex shrink-0 items-center gap-2"
              style={{
                animation: `marquee-${reverse ? "reverse" : "forward"} ${duration}s linear infinite`,
                animationPlayState: active ? "running" : "paused",
              }}
            >
              {[...row.pills, ...row.pills, ...row.pills, ...row.pills].map((pill, j) => {
                const isFeatured = pill.featured;
                return (
                  <span
                    key={j}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full font-medium text-white backdrop-blur-sm",
                      sizeClass,
                      isFeatured
                        ? "border border-white/20 bg-white/20"
                        : "bg-white/10"
                    )}
                  >
                    <IdentifierText>{authoredUsdText(pill.label, presentation.locale)}</IdentifierText>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes marquee-forward {
          from { transform: translateX(0); }
          to { transform: translateX(-25%); }
        }
        @keyframes marquee-reverse {
          from { transform: translateX(-25%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* --- View 1: Connected Node Network --- */
const getNetworkNodes = (t: LandingTranslator) => [
  { label: t("invoices"), x: 8, y: 12 },
  { label: t("cSVImport"), x: 28, y: 8 },
  { label: t("reconciliation"), x: 5, y: 42 },
  { label: t("expenses"), x: 25, y: 48 },
  { label: t("pLReport"), x: 48, y: 15 },
  { label: t("taxFiling"), x: 72, y: 10 },
  { label: t("clients"), x: 88, y: 18 },
  { label: t("bills"), x: 68, y: 42 },
  { label: t("payroll"), x: 8, y: 75 },
  { label: t("receipts"), x: 42, y: 78 },
  { label: t("accounts"), x: 75, y: 75 },
  { label: t("multiCurrency2"), x: 88, y: 55 },
  { label: t("balanceSheet"), x: 52, y: 52 },
  { label: t("journalEntries2"), x: 15, y: 25 },
];

const networkEdges = [
  [0, 1], [0, 13], [1, 4], [2, 3], [2, 8], [3, 12],
  [4, 5], [5, 6], [6, 7], [7, 11], [8, 9], [9, 10],
  [10, 11], [12, 7], [12, 9], [13, 3],
];

function NetworkView() {
  const t = useTranslations("LandingFeatures");
  const nodes = getNetworkNodes(t);
  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0 h-full w-full">
        {networkEdges.map(([from, to], i) => (
          <motion.line
            key={i}
            x1={`${nodes[from].x}%`}
            y1={`${nodes[from].y}%`}
            x2={`${nodes[to].x}%`}
            y2={`${nodes[to].y}%`}
            stroke="white"
            strokeOpacity="0.15"
            strokeWidth="1"
            strokeDasharray="6 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, strokeDashoffset: [0, -20] }}
            transition={{
              pathLength: { duration: 1.5, delay: i * 0.08 },
              strokeDashoffset: { duration: 3, ease: "linear" },
            }}
          />
        ))}
      </svg>
      {nodes.map((node, i) => (
        <motion.div
          key={i}
          className="absolute rounded-xl bg-white/15 px-3 py-1.5 text-[10px] font-medium text-white backdrop-blur-sm"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: [0, -5, 0],
          }}
          transition={{
            opacity: { duration: 0.4, delay: i * 0.06 },
            scale: { duration: 0.4, delay: i * 0.06 },
            y: { duration: 3 + (i % 3), delay: i * 0.2, ease: "easeInOut" },
          }}
        >
          {node.label}
        </motion.div>
      ))}
    </div>
  );
}

/* --- View 2: Stacked Receipt Cards --- */
const getReceiptCards = (t: LandingTranslator) => [
  { desc: t("invoiceAcmeCorp"), amount: "+$12,580", status: t("sent"), x: 4, y: 6, rotate: -4, z: 1 },
  { desc: t("billAWSHosting"), amount: "-$3,240", status: t("paid"), x: 62, y: 4, rotate: 3, z: 2 },
  { desc: t("payrollMarch"), amount: "-$28,450", status: t("processed"), x: 30, y: 18, rotate: -2, z: 3 },
  { desc: t("clientPayment"), amount: "+$45,000", status: t("received"), x: 72, y: 28, rotate: 5, z: 2 },
  { desc: t("expenseOfficeRent"), amount: "-$8,900", status: t("booked"), x: 6, y: 55, rotate: 2, z: 1 },
  { desc: t("bankCSVChase"), amount: "+$67,800", status: t("imported"), x: 55, y: 62, rotate: -5, z: 2 },
  { desc: t("revenueSales"), amount: "+$92,100", status: t("booked"), x: 78, y: 70, rotate: 3, z: 1 },
  { desc: t("creditNoteCN041"), amount: "-$2,400", status: t("issued"), x: 22, y: 72, rotate: -3, z: 3 },
];

function ReceiptView() {
  const presentation = usePresentation();
  const t = useTranslations("LandingFeatures");
  return (
    <div className="relative h-full w-full">
      {getReceiptCards(t).map((card, i) => (
        <motion.div
          key={i}
          className="absolute w-[160px] rounded-xl bg-white/15 p-3 backdrop-blur-sm md:w-[180px]"
          style={{
            left: `${card.x}%`,
            top: `${card.y}%`,
            zIndex: card.z,
          }}
          initial={{ opacity: 0, scale: 0.85, rotate: card.rotate }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: card.rotate,
            y: [0, -4, 0],
          }}
          transition={{
            opacity: { duration: 0.4, delay: i * 0.08 },
            scale: { duration: 0.4, delay: i * 0.08 },
            y: { duration: 3.5 + (i % 3), delay: i * 0.3, ease: "easeInOut" },
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <div className="flex size-4 items-center justify-center rounded-full bg-white/20">
              <Check className="size-2.5 text-white" />
            </div>
            <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere] text-[9px] text-white/70"><BidiText>{card.desc}</BidiText></span>
          </div>
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-bold tabular-nums",
              card.amount.startsWith("+") ? "text-emerald-200" : "text-white"
            )}>
              <IdentifierText>{authoredUsdText(card.amount, presentation.locale)}</IdentifierText>
            </span>
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[8px] font-medium text-white">
              {card.status}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* --- Main Showcase Component --- */
const CYCLE_DURATION = 6000;

function SolutionShowcase() {
  const t = useTranslations("LandingFeatures");
  const [activeView, setActiveView] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const { ref, isActive } = useLandingActivity();

  const advance = useCallback(() => {
    setActiveView((v) => (v + 1) % 3);
    setProgressKey((k) => k + 1);
  }, []);

  const goTo = useCallback((idx: number) => {
    setActiveView(idx);
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(advance, CYCLE_DURATION);
    return () => clearTimeout(timer);
  }, [activeView, progressKey, advance, isActive]);

  const views = [MarqueeView, NetworkView, ReceiptView];
  const ActiveView = views[activeView];

  return (
    <div ref={ref} className="relative min-h-[400px] md:min-h-[500px]">
      {/* View content — fills entire space, radial fade in center */}
      <div className="absolute inset-0 overflow-hidden" style={{
        maskImage: "radial-gradient(ellipse 120px 100px at center, transparent 40%, black 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 120px 100px at center, transparent 40%, black 100%)",
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            className="h-full w-full"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <ActiveView active={isActive} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Center logo badge — frosted glass with border */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <motion.div
          className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.1] px-5 py-4 shadow-xl shadow-emerald-900/20 ring-1 ring-white/[0.06] backdrop-blur-xl"
          animate={{
            boxShadow: [
              "0 10px 40px -10px rgba(16, 185, 129, 0.15)",
              "0 10px 40px -10px rgba(16, 185, 129, 0.3)",
              "0 10px 40px -10px rgba(16, 185, 129, 0.15)",
            ],
          }}
          transition={{ duration: 4, ease: "easeInOut" }}
        >
          <svg
            viewBox="0 0 40 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-10 shrink-0"
          >
            <path
              d="M18 4h8a10 10 0 0 1 10 10v4a10 10 0 0 1-10 10h-8V4z"
              fill="white"
              fillOpacity="0.4"
            />
            <path
              d="M4 4h8a10 10 0 0 1 10 10v4a10 10 0 0 1-10 10H4V4z"
              fill="white"
              fillOpacity="0.85"
            />
          </svg>
          <span className="text-sm font-semibold tracking-tight text-white/90">dubbl</span>
        </motion.div>
      </div>

      {/* Progress bars — bottom center, compact */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {[0, 1, 2].map((idx) => (
          <button
            key={`${idx}-${progressKey}`}
            onClick={() => goTo(idx)}
            aria-label={t("showView", {number: idx + 1})}
            aria-pressed={idx === activeView}
            className="h-1 w-8 cursor-pointer overflow-hidden rounded-full bg-white/25"
          >
            <div
              className={cn(
                "h-full rounded-full bg-white/70",
                idx < activeView && "w-full",
                idx > activeView && "w-0",
                idx === activeView && (isActive ? "animate-[progress-fill_6s_linear_forwards]" : "w-full")
              )}
            />
          </button>
        ))}
      </div>

      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Solution Section                                                          */
/* -------------------------------------------------------------------------- */

const getCapabilities = (t: LandingTranslator) => [
  {
    headline: t("unlimitedInvoices"),
    description: t("createSendAndTrackInvoicesWithNoCapsOr"),
    icon: FileText,
  },
  {
    headline: t("cSVImportExport"),
    description: t("importFromQuickBooksXeroFreshBooksWaveOrAnyCSV"),
    icon: Building2,
  },
  {
    headline: t("demo15MCPToolModules"),
    description: t("letAIAgentsManageYourBusinessDataThroughThe"),
    icon: Globe,
  },
];

function SolutionSection() {
  const t = useTranslations("LandingFeatures");
  return (
    <section className="py-16 md:py-20">
      <Container>
        {/* Header band with green grain gradient */}
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 p-8 dark:border-emerald-500/20 md:p-12">
            <GradientBackground />
            <div className="relative">
              <div className="mb-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-emerald-900/30 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                  <span className="inline-block size-1.5 rounded-full bg-emerald-300" />
                  {t("theSolution")}
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
                {t.rich("solutionHeading", {em: (chunks) => <span className="text-emerald-950">{chunks}</span>})}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-emerald-100">
                {t("dubblBringsAccountingInvoicingInventoryProjectManagementPayrollAnd")}
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Capabilities row */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {getCapabilities(t).map((cap, i) => (
            <ScrollReveal key={cap.headline} delay={0.1 + i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-emerald-300/50 dark:hover:border-emerald-700/50"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/50">
                  <cap.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {cap.headline}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {cap.description}
                  </p>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        {/* Dashboard card with grain gradient background */}
        <ScrollReveal delay={0.2}>
          <div className="mt-8">
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-emerald-400/30 dark:border-emerald-500/20"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <GradientBackground />
              <div className="relative">
                <SolutionShowcase />
              </div>
            </motion.div>
          </div>
        </ScrollReveal>

        {/* Trust signals */}
        <ScrollReveal delay={0.3}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              t("selfHostable"),
              t("fullAuditTrail"),
              t("cSVImportFromAnySource"),
              "API-first",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="size-4 text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Export                                                                     */
/* -------------------------------------------------------------------------- */

export function FeatureSections() {
  return (
    <>
      <ProblemSection />
      <SolutionSection />
    </>
  );
}
