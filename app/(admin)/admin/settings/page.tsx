"use client";

import { workspaceErrorMessage } from "@/i18n/workspace-errors";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import { useTranslations } from "next-intl";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SiteSettings {
  registration_mode: string;
  allowed_email_domains: string;
  allow_user_org_creation: string;
  self_hosted_unlimited: string;
}

export default function AdminSettingsPage() {
  const t = useTranslations("Admin");
  const errors = useTranslations("WorkspaceErrors");

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v1/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data.settings);
        setStripeConfigured(data.stripeConfigured);
      })
      .catch(() => toast.error(t("failedToLoadSettings")))
      .finally(() => setLoading(false));
  }, [t]);

  async function save(updates: Partial<SiteSettings>) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(workspaceErrorMessage(errors, data.error, t("failedToSave"), res.status));
        return;
      }
      setSettings(data.settings);
      toast.success(t("settingsSaved"));
    } catch (err) {
      toast.error(workspaceErrorMessage(errors, err instanceof Error ? err.message : undefined, t("failedToSave")));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!settings) return null;

  return <SiteSettingsForm settings={settings} stripeConfigured={stripeConfigured} saving={saving}
    save={save} onSettingsChange={setSettings} />;
}
