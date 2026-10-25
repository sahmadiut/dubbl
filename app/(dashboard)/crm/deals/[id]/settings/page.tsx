"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/dashboard/section";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { useDealContext, getHeaders } from "../layout";
import { useCrmDetailPresentation } from "@/i18n/crm-detail-presentation";
import { crmDealMutationJson, crmDealDeletedJson } from "@/i18n/crm-presentation";

export default function DealSettingsPage() {
  const unitPresentation = useUnitPresentation();
  const { t, sourceLabel } = useCrmDetailPresentation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { deal, fetchDeal, confirm, saving, setSaving } = useDealContext();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/crm/deals/${id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          title: form.get("title") as string,
          notes: (form.get("notes") as string) || null,
          probability: form.get("probability") ? parseInt(form.get("probability") as string) : null,
          expectedCloseDate: (form.get("expectedCloseDate") as string) || null,
        }),
      });
      await crmDealMutationJson(res, id);
      toast.success(t("updated"));
      await fetchDeal();
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: t("deleteTitle", { title: deal.title }),
      description: t("deleteDescription"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/v1/crm/deals/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      await crmDealDeletedJson(res);
      toast.success(t("deleted"));
      router.push("/crm");
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <Section title={t("general")} description={t("generalDescription")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-1" className="text-xs">{t("dealTitle")}</Label>
            <Input aria-label={t("dealTitle")} id="rtl018-crm-deals--id--settings-page-tsx-1" dir="auto" name="title" required defaultValue={deal.title} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-2" className="text-xs">{t("probability")}</Label>
              <Input aria-label={t("probability")} id="rtl018-crm-deals--id--settings-page-tsx-2" dir="ltr"
                name="probability"
                type="number"
                min={0}
                max={100}
                defaultValue={deal.probability ?? ""}
                placeholder={t("probabilityPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-3" className="text-xs">{t("expectedCloseDate")}</Label>
              <Input aria-label={t("expectedCloseDate")} id="rtl018-crm-deals--id--settings-page-tsx-3" dir="ltr"
                name="expectedCloseDate"
                type="date"
                defaultValue={deal.expectedCloseDate || ""}
              />
            </div>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("details")} description={t("detailsDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-4" className="text-xs">{t("source")}</Label>
            <Input aria-label={t("source")} id="rtl018-crm-deals--id--settings-page-tsx-4" dir="auto"
              value={sourceLabel(deal.source)}
              disabled
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-5" className="text-xs">{t("contact")}</Label>
            <Input aria-label={t("contact")} id="rtl018-crm-deals--id--settings-page-tsx-5" dir="auto"
              value={deal.contact?.name || "-"}
              disabled
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-6" className="text-xs">{t("assignedTo")}</Label>
            <Input aria-label={t("assignedTo")} id="rtl018-crm-deals--id--settings-page-tsx-6" dir="auto"
              value={deal.assignedUser?.name || "-"}
              disabled
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rtl018-crm-deals--id--settings-page-tsx-7" className="text-xs">{t("value")}</Label>
            <Input aria-label={t("value")} id="rtl018-crm-deals--id--settings-page-tsx-7" dir="ltr"
              value={formatMoney(deal.valueCents, deal.currency, unitPresentation)}
              disabled
              className="bg-muted/50 font-mono tabular-nums"
            />
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("notes")} description={t("notesDescription")}>
        <Textarea aria-label={t("notesPlaceholder")} dir="auto"
          name="notes"
          defaultValue={deal.notes || ""}
          rows={3}
          placeholder={t("notesPlaceholder")}
        />
      </Section>

      <div className="flex justify-end">
        <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" type="submit" size="sm" disabled={saving}>
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </div>

      <div className="h-px bg-border" />

      <Section title={t("dangerZone")} description={t("dangerDescription")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("deleteDealHeading")}</p>
            <p className="text-xs text-red-600/70 dark:text-red-400/60">{t("deleteWarning")}</p>
          </div>
          <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" type="button" size="sm" variant="destructive" onClick={handleDelete}>
            {t("deleteDeal")}
          </Button>
        </div>
      </Section>
    </form>
  );
}
