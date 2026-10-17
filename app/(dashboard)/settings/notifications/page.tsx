"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { NotificationPreferencesForm, buildDefaultState, mergePrefs, preferencePayload, type PrefState } from "@/components/settings/notification-preferences-form";
import { toast } from "sonner";

export default function NotificationPreferencesPage() {
  const t = useTranslations("SettingsNotifications");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<PrefState>(buildDefaultState);

  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    fetch("/api/v1/notifications/preferences", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          setPrefs(mergePrefs(data.preferences));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    setSaving(true);
    try {
      const preferences = preferencePayload(prefs);

      const res = await fetch("/api/v1/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ preferences }),
      });

      if (!res.ok) throw new Error(t("failedToSave"));

      toast.success(t("notificationPreferencesSaved"));
    } catch {
      toast.error(t("failedToSavePreferences"));
    } finally {
      setSaving(false);
    }
  };

  const toggleInApp = (type: string) => {
    setPrefs((p) => ({ ...p, [type]: { ...p[type], inApp: !p[type].inApp } }));
  };

  const toggleEmail = (type: string) => {
    setPrefs((p) => ({ ...p, [type]: { ...p[type], email: !p[type].email } }));
  };

  if (loading) return <BrandLoader />;
  return <NotificationPreferencesForm prefs={prefs} saving={saving} onSave={handleSave} onToggleInApp={toggleInApp} onToggleEmail={toggleEmail} />;
}
