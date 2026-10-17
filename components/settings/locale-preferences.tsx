"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localePreferencesSchema } from "@/i18n/preferences-schema";
import { toast } from "sonner";

type Preferences = { language: string | null; timeZone: string | null; numerals: string | null; calendar: string | null };
export function LocalePreferences() {
  const t = useTranslations("LocalePreferences");
  const [form, setForm] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    let active = true;
    fetch("/api/v1/user/locale-preferences", { headers: { "x-organization-id": orgId } })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        const parsed = localePreferencesSchema.parse(data.preferences);
        if (active) setForm({ language: parsed.language ?? null, timeZone: parsed.timeZone ?? null,
          numerals: parsed.numerals ?? null, calendar: parsed.calendar ?? null });
      }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  async function save() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !form) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/user/locale-preferences", { method: "PATCH",
        headers: { "content-type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(form) });
      if (!response.ok) throw new Error();
      // Full navigation reloads both server and client locale from one request.
      window.location.reload();
    } catch { toast.error(t("error")); setSaving(false); }
  }
  const select = (field: "language" | "numerals" | "calendar", options: [string, string][]) => <div className="space-y-1.5">
    <Label htmlFor={`locale-${field}`}>{t(field)}</Label>
    <select id={`locale-${field}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm"
      disabled={!form || saving} value={form?.[field] ?? ""}
      onChange={event => setForm(form && { ...form, [field]: event.target.value || null })}>
      <option value="">{t("inherit")}</option>
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </div>;
  return <Section title={t("title")} description={t("description")}>
    {error && <p role="alert">{t("error")}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      {select("language", [["en-US", t("english")], ["fa-IR", t("persian")]])}
      <div className="space-y-1.5">
        <Label htmlFor="locale-timezone">{t("timeZone")}</Label>
        <Input id="locale-timezone" dir="ltr" value={form?.timeZone ?? ""} placeholder="UTC" disabled={!form || saving}
          onChange={event => setForm(form && { ...form, timeZone: event.target.value || null })} />
      </div>
      {select("numerals", [["latn", t("latinNumerals")], ["arabext", t("persianNumerals")]])}
      {select("calendar", [["gregory", t("gregorianCalendar")], ["persian", t("persianCalendar")]])}
    </div>
    <Button onClick={save} disabled={!form || saving}>{t(saving ? "saving" : "save")}</Button>
  </Section>;
}
