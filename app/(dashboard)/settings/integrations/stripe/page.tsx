"use client";

import { useTranslations } from "next-intl";
import { stripeOAuthError } from "@/i18n/provider-presentation";

import { requireClientResponse } from "@/lib/api/client-response";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationCard } from "@/components/settings/stripe-integration-card";

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

function getOrgId() {
  return localStorage.getItem("activeOrgId") || "";
}

function orgHeaders(extra?: Record<string, string>) {
  return { "x-organization-id": getOrgId(), ...extra };
}

export default function StripeIntegrationPage() {
  const t = useTranslations("SettingsStripe");
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);

  const fetchStatus = useCallback(async () => {
    setStatusError(null);
    try {
      const res = await fetch("/api/v1/integrations/stripe/status", {
        headers: orgHeaders(),
      });
      const json = await (await requireClientResponse(res, t("unableToLoadStripeIntegrationStatus"))).json();
      if (typeof json.connected !== "boolean" || !Array.isArray(json.integrations)) throw new Error(t("invalidIntegrationStatus"));
      setConnected(json.connected ?? false);
      setIntegrations(json.integrations || []);
    } catch {
      setStatusError(t("unableToLoadStripeIntegrationStatusPleaseTryAgain"));
      toast.error(t("failedToLoadStripeIntegrationStatus"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchAccounts = useCallback(async () => {
    try {
      const [accRes, bankRes] = await Promise.all([
        fetch("/api/v1/accounts", { headers: orgHeaders() }),
        fetch("/api/v1/bank-accounts", { headers: orgHeaders() }),
      ]);
      const accJson = await accRes.json();
      const bankJson = await bankRes.json();
      setAccounts(accJson.data || accJson.accounts || []);
      setBankAccounts(bankJson.data || bankJson.bankAccounts || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchAccounts();
  }, [fetchStatus, fetchAccounts]);

  // Check for URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success(t("stripeAccountConnectedSuccessfully"));
      window.history.replaceState({}, "", window.location.pathname);
    }
    const error = params.get("error");
    if (error) {
      toast.error(stripeOAuthError(t, error));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [t]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/v1/integrations/stripe/connect", {
        headers: orgHeaders(),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(t("failedToInitiateConnection"));
        setConnecting(false);
      }
    } catch {
      toast.error(t("failedToInitiateStripeConnection"));
      setConnecting(false);
    }
  }

  async function handleSync(integrationId: string) {
    setSyncingId(integrationId);
    try {
      const res = await fetch("/api/v1/integrations/stripe/sync", {
        method: "POST",
        headers: orgHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ integrationId }),
      });
      if (res.ok) {
        toast.success(t("syncStarted"));
        setTimeout(fetchStatus, 3000);
      } else {
        toast.error(t("failedToStartSync"));
      }
    } catch {
      toast.error(t("failedToStartSync"));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(integrationId: string) {
    if (!confirm(t("areYouSureYouWantToDisconnectThisStripe"))) return;
    setDisconnectingId(integrationId);
    try {
      const res = await fetch("/api/v1/integrations/stripe/disconnect", {
        method: "POST",
        headers: orgHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ integrationId }),
      });
      if (res.ok) {
        toast.success(t("stripeAccountDisconnected"));
        fetchStatus();
      } else {
        toast.error(t("failedToDisconnect"));
      }
    } catch {
      toast.error(t("failedToDisconnect"));
    } finally {
      setDisconnectingId(null);
    }
  }

  async function updateMapping(integrationId: string, field: string, value: string) {
    try {
      const res = await fetch("/api/v1/integrations/stripe/settings", {
        method: "PATCH",
        headers: orgHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ integrationId, [field]: value }),
      });
      if (res.ok) {
        toast.success(t("settingsUpdated"));
        fetchStatus();
      } else {
        toast.error(t("failedToUpdateSettings"));
      }
    } catch {
      toast.error(t("failedToUpdateSettings"));
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-1" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (statusError) return <p role="alert" className="text-sm text-destructive">{statusError}</p>;

  if (!connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold">{t("stripeIntegration")}</h1>
          <p className="text-sm text-muted-foreground">{t("connectYourStripeAccountToAutomaticallySyncChargesFees")}</p>
        </div>

        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="font-medium">{t("connectStripe")}</h2>
              <p className="text-sm text-muted-foreground">{t("authorizeDubblToReadYourStripeData")}</p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>{t("whenConnectedDubblWillAutomatically")}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("recordEachPaymentYouTakeAsIncome")}</li>
              <li>{t("trackStripesProcessingFeesAsAnExpense")}</li>
              <li>{t("recordRefundsYouGiveBackToCustomers")}</li>
              <li>{t("matchStripePayoutsToTheMoneyThatLandsIn")}</li>
              <li>{t("addYourStripeCustomersToYourContacts")}</li>
            </ul>
          </div>

          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("connecting")}</>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />{t("connectStripeAccount")}</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("stripeIntegration")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("manageAccounts", { count: integrations.length })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-2 h-3.5 w-3.5" />
          )}{t("connectAnotherAccount")}</Button>
      </div>

      {integrations.map((integration) => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          accounts={accounts}
          bankAccounts={bankAccounts}
          syncing={syncingId === integration.id}
          disconnecting={disconnectingId === integration.id}
          onSync={() => handleSync(integration.id)}
          onDisconnect={() => handleDisconnect(integration.id)}
          onUpdateMapping={(field, value) => updateMapping(integration.id, field, value)}
        />
      ))}
    </div>
  );
}
