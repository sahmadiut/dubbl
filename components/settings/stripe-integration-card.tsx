"use client";

import { useTranslations } from "next-intl";
import { stripeStatusLabel } from "@/i18n/provider-presentation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Unplug } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BankAccountItem {
  id: string;
  accountName: string;
  bankName: string | null;
}

interface IntegrationItem {
  id: string;
  connected: boolean;
  displayName?: string | null;
  label: string;
  status?: string;
  stripeAccountId?: string;
  livemode?: boolean;
  lastSyncAt?: string;
  initialSyncCompleted?: boolean;
  initialSyncDays?: number;
  errorMessage?: string;
  clearingAccountId?: string;
  revenueAccountId?: string;
  feesAccountId?: string;
  payoutBankAccountId?: string;
  healthy?: boolean;
  healthError?: string | null;
}

export function IntegrationCard({
  integration,
  accounts,
  bankAccounts,
  syncing,
  disconnecting,
  onSync,
  onDisconnect,
  onUpdateMapping,
}: {
  integration: IntegrationItem;
  accounts: Account[];
  bankAccounts: BankAccountItem[];
  syncing: boolean;
  disconnecting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onUpdateMapping: (field: string, value: string) => void;
}) {
  const t = useTranslations("SettingsStripe");
  const statusColor = {
    active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    disconnected: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  }[integration.status || "active"];

  const StatusIcon = {
    active: CheckCircle2,
    error: XCircle,
    disconnected: AlertCircle,
  }[integration.status || "active"] || AlertCircle;

  const maskedAccountId = integration.stripeAccountId
    ? `${integration.stripeAccountId.slice(0, 8)}...${integration.stripeAccountId.slice(-4)}`
    : "";

  const accountsConfigured = !!(integration.clearingAccountId && integration.revenueAccountId && integration.feesAccountId);
  const accountDisplayName = integration.displayName || integration.label;

  return (
    <div className="rounded-lg border space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-medium">{accountDisplayName}</h2>
            <span className="text-sm text-muted-foreground font-mono">{maskedAccountId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSync} disabled={syncing || !accountsConfigured}>
            {syncing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}{t("sync")}</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="text-destructive hover:text-destructive"
          >
            {disconnecting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unplug className="mr-2 h-3.5 w-3.5" />
            )}{t("disconnect")}</Button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <Badge className={statusColor}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {stripeStatusLabel(t, integration.status)}
        </Badge>
        {integration.livemode ? (
          <Badge variant="outline" className="text-xs">{t("live")}</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">{t("test")}</Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {integration.lastSyncAt
            ? t("lastSync", { date: new Date(integration.lastSyncAt).toLocaleString() })
            : t("notSyncedYet")}
        </span>
      </div>

      {integration.errorMessage && (
        <p className="text-sm text-destructive">{t("providerError")}</p>
      )}
      {!integration.initialSyncCompleted && accountsConfigured && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{t("initialSyncInProgress")}</p>
      )}

      {/* Account mapping warning */}
      {!accountsConfigured && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t("accountMappingsRequired")}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{t("selectAClearingRevenueAndFeesAccountBelowBefore")}</p>
          </div>
        </div>
      )}

      {/* Account Mappings */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t("accountMappings")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("clearingAccountAsset")}</Label>
            <Select
              value={integration.clearingAccountId || ""}
              onValueChange={(v) => onUpdateMapping("clearingAccountId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("selectAccount")} /></SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.type === "asset")
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("revenueAccount")}</Label>
            <Select
              value={integration.revenueAccountId || ""}
              onValueChange={(v) => onUpdateMapping("revenueAccountId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("selectAccount")} /></SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.type === "revenue")
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("feesAccountExpense")}</Label>
            <Select
              value={integration.feesAccountId || ""}
              onValueChange={(v) => onUpdateMapping("feesAccountId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("selectAccount")} /></SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.type === "expense")
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("payoutBankAccount")}</Label>
            <Select
              value={integration.payoutBankAccountId || ""}
              onValueChange={(v) => onUpdateMapping("payoutBankAccountId", v)}
            >
              <SelectTrigger><SelectValue placeholder={t("selectBankAccount")} /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map((ba) => (
                  <SelectItem key={ba.id} value={ba.id}>
                    {ba.accountName}{ba.bankName ? ` (${ba.bankName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
