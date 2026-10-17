"use client";

import { useTranslations } from "next-intl";

import { motion, AnimatePresence } from "motion/react";
import { Check, Users, HardDrive, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";

interface BillingInfo {
  plan: "free" | "pro";
  status: string;
  seatCount: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: "monthly" | "annual";
  storagePlan: "free" | "starter" | "growth" | "scale";
  storageUsedBytes: number;
  emailsPerMonth: number;
  emailsSentThisMonth: number;
}

function formatStorageSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const STORAGE_LIMITS: Record<string, number> = {
  free: 5120 * 1024 * 1024,
  starter: 25600 * 1024 * 1024,
  growth: 76800 * 1024 * 1024,
  scale: 307200 * 1024 * 1024,
};

const SEAT_PRICE_MONTHLY = 12;
const SEAT_PRICE_ANNUAL = 10;

export function BillingContent({ billing, selfHosted, loading, error, checkoutLoading, portalLoading, interval, setInterval, checkout, openPortal }: {
  billing: BillingInfo | null;
  selfHosted: boolean;
  loading: boolean;
  error: string | null;
  checkoutLoading: string | null;
  portalLoading: boolean;
  interval: "monthly" | "annual";
  setInterval: (value: "monthly" | "annual") => void;
  checkout: (type: "seats" | "storage", plan?: string) => void;
  openPortal: () => void;
}) {
  const t = useTranslations("SettingsBilling");
  const storagePlans = [
    { id: "free", name: t("free"), storage: "5 GB", monthly: 0, annual: 0, emails: 100, description: t("includedWithEveryOrganization") },
    { id: "starter", name: t("starter"), storage: "25 GB", monthly: 15, annual: 13, emails: 500, description: t("forGrowingTeamsWithMoreData") },
    { id: "growth", name: t("growth"), storage: "75 GB", monthly: 45, annual: 38, emails: 3000, description: t("forEstablishedBusinesses") },
    { id: "scale", name: t("scale"), storage: "300 GB", monthly: 120, annual: 100, emails: 10000, description: t("forLargeOrganizations") },
  ];

  const currentPlan = billing?.plan || "free";
  const seatCount = billing?.seatCount || 1;
  const currentStorage = billing?.storagePlan || "free";
  const isPro = currentPlan === "pro";

  if (loading) return <BrandLoader />;
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (selfHosted) {
    return (
      <ContentReveal className="space-y-6">
        <div className="rounded-xl border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Check className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold">{t("allFeaturesUnlocked")}</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{t("thisIsASelfHostedInstanceWithAllPro")}</p>
        </div>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal className="space-y-10">
      {/* Seat-based pricing */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("teamSeats")}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{t("perSeatPricingForYourTeam")}</p>

        <div className="flex items-center gap-1 mb-4 rounded-lg border bg-muted/50 p-1 w-fit">
          <button
            onClick={() => setInterval("monthly")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              interval === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >{t("monthly")}</button>
          <button
            onClick={() => setInterval("annual")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              interval === "annual" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >{t("annual")}<span className="ml-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("save17")}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Free tier */}
          <div
            className={cn(
              "flex flex-col rounded-xl border p-6",
              !isPro && "border-emerald-300 ring-1 ring-emerald-300 dark:border-emerald-800 dark:ring-emerald-800"
            )}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{t("free")}</h4>
              {!isPro && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/60 dark:text-emerald-400">{t("current")}</Badge>
              )}
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold tracking-tight">$0</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("forIndividualsGettingStarted")}</p>
            <ul className="mt-4 flex-1 space-y-2">
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("included1TeamMemberIncluded")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("included25EmailsMo")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("allCoreFeatures")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("communitySupport")}</li>
            </ul>
            <div className="mt-6">
              <Button variant="outline" size="sm" className="w-full" disabled={!isPro}>
                {!isPro ? t("currentPlan") : t("downgrade")}
              </Button>
            </div>
          </div>

          {/* Pro tier */}
          <div
            className={cn(
              "flex flex-col rounded-xl border p-6",
              isPro && "border-emerald-300 ring-1 ring-emerald-300 dark:border-emerald-800 dark:ring-emerald-800"
            )}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{t("pro")}</h4>
              {isPro && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/60 dark:text-emerald-400">
                  {t("currentSeats", { count: seatCount })}
                </Badge>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <AnimatePresence mode="wait">
                <motion.span
                  key={interval}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-3xl font-bold tracking-tight"
                >
                  ${interval === "annual" ? SEAT_PRICE_ANNUAL : SEAT_PRICE_MONTHLY}
                </motion.span>
              </AnimatePresence>
              <span className="text-sm text-muted-foreground">{t("seatMo")}</span>
              {interval === "annual" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ml-1 text-xs text-muted-foreground line-through"
                >
                  ${SEAT_PRICE_MONTHLY}
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
                className="mt-2 text-xs text-muted-foreground"
              >
                {interval === "annual" ? t("billedAnnual", { amount: SEAT_PRICE_ANNUAL * 12 }) : t("billedMonthlyPerSeat")}
              </motion.p>
            </AnimatePresence>
            <ul className="mt-4 flex-1 space-y-2">
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("unlimitedTeamMembers")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("included100EmailsMo")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("allFeaturesAPIAccess")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("prioritySupport")}</li>
              <li className="flex items-center gap-2 text-[13px]">
                <Check className="size-3.5 shrink-0 text-emerald-600" />{t("auditLog")}</li>
            </ul>
            <div className="mt-6">
              {isPro ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={openPortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? t("loading") : t("manageBilling")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => checkout("seats", "pro")}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === "pro" ? t("loading") : t("upgradeToPro")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {isPro && billing?.currentPeriodEnd && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t(billing.cancelAtPeriodEnd ? "cancelsOn" : "renewsOn", { date: new Date(billing.currentPeriodEnd).toLocaleDateString() })}
          </p>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Storage plans */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t("organizationStorage")}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{t("storageAndEmailPlansForYourOrganizationEachPlan")}</p>

        {/* Storage usage bar */}
        {(() => {
          const usedBytes = billing?.storageUsedBytes || 0;
          const limitBytes = STORAGE_LIMITS[currentStorage] || STORAGE_LIMITS.free;
          const pct = Math.min((usedBytes / limitBytes) * 100, 100);
          const isHigh = pct > 80;
          const isCritical = pct > 95;
          return (
            <div className="rounded-lg border bg-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{t("storageUsed")}</span>
                <span className={cn(
                  "text-xs font-mono tabular-nums",
                  isCritical ? "text-red-600 dark:text-red-400" : isHigh ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  {formatStorageSize(usedBytes)} / {storagePlans.find((p) => p.id === currentStorage)?.storage || "5 GB"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isCritical ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.max(pct, 0.5)}%` }}
                />
              </div>
              {isCritical && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">{t("storageAlmostFullConsiderUpgradingYourPlan")}</p>
              )}
            </div>
          );
        })()}

        {/* Email usage bar */}
        {(() => {
          const sent = billing?.emailsSentThisMonth || 0;
          const limit = billing?.emailsPerMonth || 25;
          const pct = Math.min((sent / limit) * 100, 100);
          const isHigh = pct > 80;
          const isCritical = pct > 95;
          return (
            <div className="rounded-lg border bg-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{t("emailsSentThisMonth")}</span>
                </div>
                <span className={cn(
                  "text-xs font-mono tabular-nums",
                  isCritical ? "text-red-600 dark:text-red-400" : isHigh ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  {sent} / {limit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isCritical ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.max(pct, 0.5)}%` }}
                />
              </div>
              {isCritical && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">{t("emailLimitAlmostReachedUpgradeYourStoragePlanFor")}</p>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {storagePlans.map((plan) => {
            const isCurrent = plan.id === currentStorage;
            const currentPrice = interval === "annual" ? plan.annual : plan.monthly;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border p-5 transition-shadow",
                  isCurrent
                    ? "border-emerald-300 ring-1 ring-emerald-300 dark:border-emerald-800 dark:ring-emerald-800"
                    : "hover:shadow-sm"
                )}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{plan.name}</h4>
                  {isCurrent && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] dark:bg-emerald-900/60 dark:text-emerald-400">{t("current")}</Badge>
                  )}
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold tracking-tight">{plan.storage}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={interval}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="text-lg font-semibold"
                    >
                      ${currentPrice}
                    </motion.span>
                  </AnimatePresence>
                  {currentPrice > 0 && <span className="text-xs text-muted-foreground">{t("mo")}</span>}
                  {interval === "annual" && plan.monthly > 0 && (
                    <span className="text-xs text-muted-foreground line-through">${plan.monthly}</span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{plan.description}</p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  <li className="flex items-center gap-2 text-[12px]">
                    <Check className="size-3 shrink-0 text-emerald-600" />
                    {t("fileStorage", { storage: plan.storage })}
                  </li>
                  <li className="flex items-center gap-2 text-[12px]">
                    <Check className="size-3 shrink-0 text-emerald-600" />
                    {t("monthlyEmails", { count: plan.emails })}
                  </li>
                </ul>
                <div className="mt-4">
                  {isCurrent ? (
                    <Button variant="outline" size="sm" className="w-full text-xs" disabled>{t("current")}</Button>
                  ) : (
                    <Button
                      variant={plan.id === "free" ? "outline" : "default"}
                      size="sm"
                      className={cn(
                        "w-full text-xs",
                        plan.id !== "free" && "bg-emerald-600 hover:bg-emerald-700"
                      )}
                      onClick={() => checkout("storage", plan.id)}
                      disabled={checkoutLoading !== null}
                    >
                      {checkoutLoading === plan.id ? t("loading") : plan.id === "free" ? t("downgrade") : t("upgrade")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Transparency note + contact */}
      <div className="rounded-xl border bg-muted/30 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-lg">
            <h3 className="text-sm font-semibold">{t("openSourceTransparentPricing")}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{t("dubblIsOpenSourceOurPricingIsDesignedTo")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => window.location.href = "mailto:support@dubbl.dev"}
          >
            <Mail className="size-3.5" />{t("contactUs")}</Button>
        </div>
      </div>
    </ContentReveal>
  );
}
