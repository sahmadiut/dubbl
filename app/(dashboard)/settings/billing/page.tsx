"use client";

import { useTranslations } from "next-intl";

import { requireClientResponse } from "@/lib/api/client-response";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BillingContent } from "@/components/settings/billing-content";

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

export default function BillingPage() {
  const t = useTranslations("SettingsBilling");
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [selfHosted, setSelfHosted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) { setError(t("selectAnOrganizationToViewBilling")); setLoading(false); return; }

    fetch("/api/v1/billing", {
      headers: { "x-organization-id": orgId },
    })
      .then(async r => (await requireClientResponse(r, t("unableToLoadBilling"))).json())
      .then((data) => {
        if (data.billing) setBilling(data.billing);
        if (data.selfHosted) setSelfHosted(true);
        if (!data.billing && !data.selfHosted) throw new Error(t("billingInformationMissing"));
      })
      .catch(() => setError(t("unableToLoadBillingPleaseTryAgain")))
      .finally(() => setLoading(false));
  }, [t]);

  async function checkout(type: "seats" | "storage", plan?: string) {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || checkoutLoading) return;
    setCheckoutLoading(plan || type);

    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ type, plan, interval }),
      });
      const data = await (await requireClientResponse(res, t("unableToStartCheckout"))).json();
      if (data.url) window.location.href = data.url;
      else if (data.updated) {
        toast.success(t("planUpdatedSuccessfully"));
        window.location.reload();
      } else throw new Error(typeof data.error === "string" ? data.error : t("failedToStartCheckout"));
    } catch {
      toast.error(t("failedToStartCheckout"));
      setCheckoutLoading(null);
    }
  }

  async function openPortal() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || portalLoading) return;
    setPortalLoading(true);

    try {
      const res = await fetch("/api/v1/billing/portal", {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      const data = await (await requireClientResponse(res, t("unableToOpenBillingPortal"))).json();
      if (typeof data.url !== "string" || !data.url) throw new Error(t("billingPortalURLMissing"));
      window.location.href = data.url;
    } catch {
      toast.error(t("failedToOpenBillingPortal"));
      setPortalLoading(false);
    }
  }

  return <BillingContent billing={billing} selfHosted={selfHosted} loading={loading} error={error}
    checkoutLoading={checkoutLoading} portalLoading={portalLoading} interval={interval}
    setInterval={setInterval} checkout={checkout} openPortal={openPortal} />;
}
