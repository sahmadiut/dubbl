"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { projectMutationJson } from "@/i18n/project-presentation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { Section } from "@/components/dashboard/section";
import { projectCentsDecimal as centsToDecimal, projectCentsInput, projectHoursInput, projectHoursDecimal } from "@/lib/money/project-display";
import { useProject, PROJECT_COLORS } from "../project-context";

export default function SettingsPage() {
  const t = useTranslations("Projects");
  const { project: proj, orgId, projectId, refresh } = useProject();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [contactId, setContactId] = useState(proj?.contactId || "");
  const [projStartDate, setProjStartDate] = useState(proj?.startDate || "");
  const [projEndDate, setProjEndDate] = useState(proj?.endDate || "");
  const [projBudget, setProjBudget] = useState(centsToDecimal(proj?.budget ?? 0));
  const [projHourlyRate, setProjHourlyRate] = useState(centsToDecimal(proj?.hourlyRate ?? 0));
  const [projFixedPrice, setProjFixedPrice] = useState(centsToDecimal(proj?.fixedPrice ?? 0));
  useDocumentTitle(t("settingsTitle"));

  if (!proj) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    setSaving(true);
    const form = new FormData(e.currentTarget);

    try {
      const tagsRaw = (form.get("tags") as string || "").trim();
      const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [];

      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || null,
          contactId: contactId || null,
          status: form.get("status"),
          priority: form.get("priority"),
          billingType: form.get("billingType"),
          color: form.get("color"),
          budgetMinor: projectCentsInput(projBudget || "0"),
          hourlyRateMinor: projectCentsInput(projHourlyRate || "0"),
          fixedPriceMinor: projectCentsInput(projFixedPrice || "0"),
          estimatedHours: projectHoursInput(form.get("estimatedHours") as string || "0"),
          startDate: projStartDate || null,
          endDate: projEndDate || null,
          category: form.get("category") || null,
          tags,
          enableTasks: form.get("enableTasks") === "on",
          enableTimeTracking: form.get("enableTimeTracking") === "on",
          enableMilestones: form.get("enableMilestones") === "on",
          enableNotes: form.get("enableNotes") === "on",
          enableBilling: form.get("enableBilling") === "on",
        }),
      });

      await projectMutationJson(res);
      toast.success(t("updated"));
      window.dispatchEvent(new Event("projects-changed"));
      refresh();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: t("deleteTitle"),
      description: t("deleteConfirm"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectMutationJson(res, "delete");
      toast.success(t("deleted"));
      window.dispatchEvent(new Event("projects-changed"));
      router.push("/projects");
    } catch { toast.error(t("deleteFailed")); } finally { setDeleting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10">
      <Section title={t("general")} description={t("generalDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">{t("projectNameRequired")}</Label>
            <Input name="name" required defaultValue={proj.name} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("status")}</Label>
            <Select name="status" defaultValue={proj.status}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="completed">{t("completed")}</SelectItem>
                <SelectItem value="on_hold">{t("onHold")}</SelectItem>
                <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
                <SelectItem value="archived">{t("archived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("priority")}</Label>
            <Select name="priority" defaultValue={proj.priority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t("low")}</SelectItem>
                <SelectItem value="medium">{t("medium")}</SelectItem>
                <SelectItem value="high">{t("high")}</SelectItem>
                <SelectItem value="urgent">{t("urgent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("client")}</Label>
            <ContactPicker value={contactId} onChange={setContactId} type="customer" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("category")}</Label>
            <Input name="category" defaultValue={proj.category || ""} placeholder={t("categoryExample")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("color")}</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map(c => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" aria-label={t("colorChoice", { color: c })} name="color" value={c} defaultChecked={proj.color === c} className="sr-only peer" />
                  <div className="size-6 rounded-full ring-2 ring-transparent peer-checked:ring-offset-2 peer-checked:ring-gray-400 transition-all" style={{ backgroundColor: c }} />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("tags")}</Label>
            <Input name="tags" defaultValue={proj.tags.join(", ")} placeholder={t("commaSeparated")} />
          </div>
        </div>
        <div className="space-y-1.5 mt-4">
          <Label className="text-xs">{t("description")}</Label>
          <Textarea name="description" defaultValue={proj.description || ""} rows={3} />
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("financial")} description={t("financialDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("billingType")}</Label>
            <Select name="billingType" defaultValue={proj.billingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">{t("hourly")}</SelectItem>
                <SelectItem value="fixed">{t("fixedPrice")}</SelectItem>
                <SelectItem value="milestone">{t("milestone")}</SelectItem>
                <SelectItem value="non_billable">{t("nonBillable")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">{t("budget")}</Label><CurrencyInput prefix={proj.currency === "USD" ? "$" : proj.currency} value={projBudget} onChange={setProjBudget} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("hourlyRate")}</Label><CurrencyInput prefix={proj.currency === "USD" ? "$" : proj.currency} value={projHourlyRate} onChange={setProjHourlyRate} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("fixedPrice")}</Label><CurrencyInput prefix={proj.currency === "USD" ? "$" : proj.currency} value={projFixedPrice} onChange={setProjFixedPrice} /></div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("timeline")} description={t("timelineDescription")}>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="space-y-1.5"><Label className="text-xs">{t("startDate")}</Label><DatePicker value={projStartDate} onChange={setProjStartDate} placeholder={t("selectStart")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("endDate")}</Label><DatePicker value={projEndDate} onChange={setProjEndDate} placeholder={t("selectEnd")} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t("estimatedHours")}</Label><Input name="estimatedHours" type="number" step="any" min={0} defaultValue={proj.estimatedHours > 0 ? projectHoursDecimal(proj.estimatedHours) : ""} /></div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("features")} description={t("featuresDescription")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { name: "enableTasks", label: t("tasks"), desc: t("tasksDescription"), checked: proj.enableTasks },
            { name: "enableTimeTracking", label: t("timeTracking"), desc: t("timeDescription"), checked: proj.enableTimeTracking },
            { name: "enableMilestones", label: t("milestones"), desc: t("milestonesDescription"), checked: proj.enableMilestones },
            { name: "enableNotes", label: t("notes"), desc: t("notesDescription"), checked: proj.enableNotes },
            { name: "enableBilling", label: t("billing"), desc: t("billingDescription"), checked: proj.enableBilling },
          ].map((f) => (
            <label key={f.name} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50/50 transition-colors">
              <input type="checkbox" name={f.name} defaultChecked={f.checked} className="accent-emerald-600" />
              <div>
                <p className="text-[13px] font-medium">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      <div className="h-px bg-border" />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </div>

      <div className="h-px bg-border" />

      <Section title={t("dangerZone")} description={t("dangerDescription")}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{t("deleteProject")}</p>
            <p className="text-[12px] text-muted-foreground">{t("deleteDescription")}</p>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}{deleting ? t("deleting") : t("delete")}
          </Button>
        </div>
      </Section>
      {confirmDialog}
    </form>
  );
}
