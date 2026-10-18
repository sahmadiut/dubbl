"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localePreferencesSchema } from "@/i18n/preferences-schema";
import { toast } from "sonner";

type Preferences = { language: string | null; timeZone: string | null; numerals: string | null; calendar: string | null; fontFamily: string | null };
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
          numerals: parsed.numerals ?? null, calendar: parsed.calendar ?? null, fontFamily: parsed.fontFamily ?? null });
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
    <Label htmlFor={`locale-${field}`} className="text-xs">{t(field)}</Label>
    <Select
      value={form?.[field] ?? undefined}
      onValueChange={value => setForm(form && { ...form, [field]: value })}
      disabled={!form || saving}
    >
      <SelectTrigger id={`locale-${field}`}>
        <SelectValue placeholder={t("inherit")} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
  return <Section title={t("title")} description={t("description")}>
    {error && <p role="alert" className="text-xs text-destructive mb-2">{t("error")}</p>}
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {select("language", [["en-US", t("english")], ["fa-IR", t("persian")]])}
        <div className="space-y-1.5">
          <Label htmlFor="locale-timezone" className="text-xs">{t("timeZone")}</Label>
          <Input id="locale-timezone" dir="ltr" value={form?.timeZone ?? ""} placeholder="UTC" disabled={!form || saving}
            onChange={event => setForm(form && { ...form, timeZone: event.target.value || null })} />
        </div>
        {select("numerals", [["latn", t("latinNumerals")], ["arabext", t("persianNumerals")]])}
        {select("calendar", [["gregory", t("gregorianCalendar")], ["persian", t("persianCalendar")]])}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t("fontFamily")}</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["vazirmatn", t("fontVazirmatn"), t("fontPreviewVazirmatn"), "var(--font-vazirmatn), sans-serif"],
            ["abar", t("fontAbar"), t("fontPreviewAbar"), "'Abar', sans-serif"],
            ["filimo", t("fontFilimo"), t("fontPreviewFilimo"), "'Filimo', sans-serif"],
            ["estedad", t("fontEstedad"), t("fontPreviewEstedad"), "'Estedad', sans-serif"],
            ["iransansx", t("fontIRANSansX"), t("fontPreviewIRANSansX"), "'IRANSansX', sans-serif"],
            ["digikala", t("fontDigikala"), t("fontPreviewDigikala"), "'Digikala', sans-serif"],
          ] as const).map(([value, label, preview, fontStyle]) => {
            const selected = (form?.fontFamily ?? "vazirmatn") === value;
            return (
              <button key={value} type="button" disabled={!form || saving}
                className={`rounded-lg border p-3 text-start transition-colors ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input hover:border-primary/40"} disabled:cursor-not-allowed disabled:opacity-50`}
                onClick={() => setForm(form && { ...form, fontFamily: value === "vazirmatn" ? null : value })}>
                <span className="block text-sm font-medium" style={{ fontFamily: fontStyle }}>{label}</span>
                <span className="block text-xs text-muted-foreground mt-1" style={{ fontFamily: fontStyle }}>{preview}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Button size="sm" onClick={save} disabled={!form || saving}>{t(saving ? "saving" : "save")}</Button>
      </div>
    </div>
  </Section>;
}
