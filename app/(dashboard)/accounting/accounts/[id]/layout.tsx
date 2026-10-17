"use client";

import { useTranslations } from "next-intl";
import { requireAccountResponse, accountFailureMessage, accountTypeLabel } from "@/i18n/account-presentation";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, BookOpen, Hash, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { coreAccountMoney, coreStoredMinor, type AccountMoney } from "@/lib/money/core-presentation";
import { journalMoney } from "@/lib/money/journal-display";
import { cn } from "@/lib/utils";

interface AccountDetail extends AccountMoney {
  id: string;
  code: string;
  name: string;
  type: string;
  subType?: string | null;
  description?: string | null;
  currencyCode?: string;
  isActive?: boolean;
  isSystem?: boolean;
  entryCount?: number;
}

interface AccountContextValue {
  account: AccountDetail | null;
  setAccount: (fn: (prev: AccountDetail | null) => AccountDetail | null) => void;
  refetch: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccountContext() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountContext must be used within account layout");
  return ctx;
}

const TYPE_CONFIG: Record<string, { dot: string; bg: string; text: string; border: string; badgeClass: string }> = {
  asset: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/10 dark:bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  liability: {
    dot: "bg-orange-500",
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    badgeClass: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  equity: {
    dot: "bg-purple-500",
    bg: "bg-purple-500/10 dark:bg-purple-500/15",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    badgeClass: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
  },
  revenue: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  expense: {
    dot: "bg-red-500",
    bg: "bg-red-500/10 dark:bg-red-500/15",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  },
};

const PAGE_TABS = [
  { value: "ledger", label: "ledger", icon: BookOpen, href: (id: string) => `/accounting/accounts/${id}` },
  { value: "settings", label: "settings", icon: Settings2, href: (id: string) => `/accounting/accounts/${id}/settings` },
] as const;

export default function AccountDetailLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Accounts");
  const errors = useTranslations("AccountErrors");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const fetchAccount = useCallback(() => {
    if (!orgId) return;
    fetch(`/api/v1/accounts/${id}?limit=1`, {
      headers: { "x-organization-id": orgId },
    })
      .then(async (r) => { return (await requireAccountResponse(r, errors, t("invalidAccountAmounts"))).json(); })
      .then((data) => {
        setAccount(coreAccountMoney(data.account));
        setError(null);
      })
      .catch((err) => { setAccount(null); setError(accountFailureMessage(err, t("invalidAccountAmounts"))); })
      .finally(() => setLoading(false));
  }, [id, orgId, t, errors]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  if (loading) return <BrandLoader />;

  if (!account) {
    return <p role="alert" className="text-muted-foreground">{error ?? t("accountNotFound")}</p>;
  }

  const bal = coreStoredMinor(account.balance, account.balanceMinor);
  const cur = account.amountCurrencyCode;
  const typeConfig = TYPE_CONFIG[account.type];
  const totalDebits = coreStoredMinor(account.totalDebits, account.totalDebitsMinor);
  const totalCredits = coreStoredMinor(account.totalCredits, account.totalCreditsMinor);
  const entryCount = account.entryCount || 0;

  return (
    <AccountContext.Provider value={{ account, setAccount, refetch: fetchAccount }}>
      <ContentReveal>
        {/* Back link */}
        <button
          onClick={() => router.push("/accounting/accounts")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToAccounts")}
        </button>

        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              typeConfig?.bg
            )}>
              <Hash className={cn("size-5", typeConfig?.text)} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight">{account.name}</h1>
                <Badge variant="outline" className={typeConfig?.badgeClass || ""}>
                  {accountTypeLabel(t, account.type)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{t("glCurrency", { currency: cur })}</Badge>
                {account.currencyCode !== cur && <Badge variant="outline" className="text-[10px]">{t("accountCurrency", { currency: account.currencyCode ?? cur })}</Badge>}
                {account.isActive === false && (
                  <Badge variant="outline" className="text-muted-foreground">{t("inactive")}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-mono">{account.code}</span>
                {account.subType && <> · {account.subType}</>}
                {account.description && <> · {account.description}</>}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          <div>
            <p className="text-[11px] text-muted-foreground">{t("balance")}</p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
              {journalMoney(bal, cur)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ArrowDownRight className="size-3 text-emerald-500" />
              {t("totalDebits")}
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-emerald-600">
              {totalDebits > 0n ? journalMoney(totalDebits, cur) : "-"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="size-3 text-red-500" />
              {t("totalCredits")}
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-red-600">
              {totalCredits > 0n ? journalMoney(totalCredits, cur) : "-"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">{t("entries")}</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{entryCount}</p>
          </div>
        </div>

        {/* Page tabs */}
        <nav className="-mt-2 mb-8 flex items-center gap-1 overflow-x-auto border-b border-border">
          {PAGE_TABS.map((tab) => {
            const Icon = tab.icon;
            const tabHref = tab.href(id);
            const active = tab.value === "settings"
              ? pathname.endsWith("/settings")
              : !pathname.endsWith("/settings");
            return (
              <button
                key={tab.value}
                onClick={() => router.push(tabHref)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t(tab.label)}
              </button>
            );
          })}
        </nav>

        {/* Tab content - only this animates on route change */}
        <ContentReveal key={pathname}>
          {children}
        </ContentReveal>
      </ContentReveal>
    </AccountContext.Provider>
  );
}
