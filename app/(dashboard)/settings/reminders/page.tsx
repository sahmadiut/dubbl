"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { useTranslations } from "next-intl";
import { requireSettingsResponse, settingsFailureMessage } from "@/i18n/settings-errors";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Mail, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ReminderTemplateFields } from "@/components/settings/reminder-template-fields";
import { Switch } from "@/components/ui/switch";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface ReminderRule {
  id: string;
  name: string;
  triggerType: "before_due" | "on_due" | "after_due";
  triggerDays: number;
  enabled: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
  documentType: "invoice" | "bill";
  recipientType: "contact_email" | "contact_persons" | "custom";
  customEmails: string[] | null;
  createdAt: string;
}

interface ReminderLog {
  id: string;
  documentType: string;
  documentId: string;
  recipientEmail: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  errorMessage: string | null;
  sentAt: string;
  reminderRule: ReminderRule | null;
}

const emptyForm: {
  name: string;
  triggerType: "before_due" | "on_due" | "after_due";
  triggerDays: number;
  enabled: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
  documentType: "invoice" | "bill";
  recipientType: "contact_email" | "contact_persons" | "custom";
  customEmails: string;
} = {
  name: "",
  triggerType: "before_due",
  triggerDays: 3,
  enabled: false,
  subjectTemplate: "",
  bodyTemplate: "",
  documentType: "invoice",
  recipientType: "contact_email",
  customEmails: "",
};

export default function RemindersPage() {
  const t = useTranslations("SettingsReminders");
  const errors = useTranslations("SettingsErrors");

  const TRIGGER_LABELS: Record<string, string> = {
    before_due: t("beforeDueDate"),
    on_due: t("onDueDate"),
    after_due: t("afterDueDate"),
  };

  const { confirm, dialog: confirmDialog } = useConfirm();
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logStatus, setLogStatus] = useState<string>("");
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  useDocumentTitle(t("settingsReminders"));

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId") || "";
    return { "x-organization-id": orgId, "Content-Type": "application/json" };
  }

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/reminders", { headers: getHeaders() });
      const data = await (await requireSettingsResponse(res, errors, t("failedToLoad"))).json();
      setRules(data.data || []);
    } catch (error) {
      toast.error(settingsFailureMessage(error, t("failedToLoad")));
    } finally {
      setLoading(false);
    }
  }, [errors, t]);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(logPage), limit: "10" });
      if (logStatus) params.set("status", logStatus);
      const res = await fetch(`/api/v1/reminders/logs?${params}`, {
        headers: getHeaders(),
      });
      const data = await (await requireSettingsResponse(res, errors, t("failedToLoadLogs"))).json();
      setLogs(data.data || []);
      setLogTotal(data.total || 0);
    } catch (error) {
      toast.error(settingsFailureMessage(error, t("failedToLoadLogs")));
    }
  }, [logPage, logStatus, errors, t]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSheetOpen(true);
  }

  function openEdit(rule: ReminderRule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      triggerDays: rule.triggerDays,
      enabled: rule.enabled,
      subjectTemplate: rule.subjectTemplate,
      bodyTemplate: rule.bodyTemplate,
      documentType: rule.documentType,
      recipientType: rule.recipientType,
      customEmails: rule.customEmails?.join(", ") || "",
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subjectTemplate.trim() || !form.bodyTemplate.trim()) {
      toast.error(t("pleaseFillInAllRequiredFields"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        triggerType: form.triggerType,
        triggerDays: form.triggerDays,
        enabled: form.enabled,
        subjectTemplate: form.subjectTemplate,
        bodyTemplate: form.bodyTemplate,
        documentType: form.documentType,
        recipientType: form.recipientType,
        customEmails:
          form.recipientType === "custom" && form.customEmails.trim()
            ? form.customEmails.split(",").map((e) => e.trim()).filter(Boolean)
            : null,
      };

      if (editingId) {
        const res = await fetch(`/api/v1/reminders/${editingId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        await requireSettingsResponse(res, errors, t("failedToUpdate"));
        toast.success(t("reminderRuleUpdated"));
      } else {
        const res = await fetch("/api/v1/reminders", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        await requireSettingsResponse(res, errors, t("failedToCreate"));
        toast.success(t("reminderRuleCreated"));
      }
      setSheetOpen(false);
      await fetchRules();
    } catch (error) {
      toast.error(settingsFailureMessage(error, t("somethingWentWrong")));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await confirm({
      title: t("deleteReminderRule"),
      description: t("thisRuleWillBePermanentlyRemoved"),
      confirmLabel: t("delete"),
      cancelLabel: t("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/v1/reminders/${id}`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          await requireSettingsResponse(res, errors, t("failedToDelete"));
          await fetchRules();
          toast.success(t("reminderRuleDeleted"));
        } catch (error) {
          toast.error(settingsFailureMessage(error, t("failedToDelete")));
          throw error;
        }
      },
    });
  }

  async function handleToggle(rule: ReminderRule) {
    try {
      const res = await fetch(`/api/v1/reminders/${rule.id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      await requireSettingsResponse(res, errors, t("failedToUpdate"));
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch (error) {
      toast.error(settingsFailureMessage(error, t("failedToUpdate")));
    }
  }

  function insertVariable(variable: string, field: "subjectTemplate" | "bodyTemplate") {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field] + variable,
    }));
  }

  if (loading) return <BrandLoader />;

  const logTotalPages = Math.ceil(logTotal / 10);

  return (
    <ContentReveal>
      <div className="space-y-8">
        {/* Reminder Rules */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{t("paymentReminders")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("configureAutomatedDunningRulesForOverdueInvoicesAndBills")}
              </p>
            </div>
            <Button size="sm" className="text-xs gap-1 h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5" onClick={openCreate}>
              <Plus className="size-3" /> {t("newRule")}
            </Button>
          </div>

          {rules.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Mail className="size-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">{t("noReminderRulesYet")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("createYourFirstRuleToStartSendingAutomatedPaymentReminders")}
              </p>
              <Button size="sm" className="text-xs gap-1 mt-4 h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5" onClick={openCreate}>
                <Plus className="size-3" /> {t("newRule")}
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{t("name")}</TableHead>
                    <TableHead className="text-xs">{t("trigger")}</TableHead>
                    <TableHead className="text-xs">{t("documentLabel")}</TableHead>
                    <TableHead className="text-xs">{t("enabled")}</TableHead>
                    <TableHead className="text-xs w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow
                      key={rule.id}
                      className="cursor-pointer"
                      onClick={() => openEdit(rule)}
                    >
                      <TableCell className="text-sm font-medium"><BidiText>{rule.name}</BidiText></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {TRIGGER_LABELS[rule.triggerType]}
                        {rule.triggerType !== "on_due" && (
                          <span> · {t("dayCount", { count: rule.triggerDays })}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {rule.documentType === "invoice" ? t("invoice") : t("bill")}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggle(rule)} aria-label={t("enabled")}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Reminder Log */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{t("reminderLog")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("historyOfSentFailedAndSkippedReminders")}
              </p>
            </div>
            <Select value={logStatus} onValueChange={(v) => { setLogStatus(v === "all" ? "" : v); setLogPage(1); }}>
              <SelectTrigger className="w-[130px] text-xs h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={t("allStatuses")}>
                <SelectValue placeholder={t("allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="sent">{t("sent")}</SelectItem>
                <SelectItem value="failed">{t("failed")}</SelectItem>
                <SelectItem value="skipped">{t("skipped")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center">
              <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t("noReminderLogsYet")}</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{t("status")}</TableHead>
                      <TableHead className="text-xs">{t("rule")}</TableHead>
                      <TableHead className="text-xs">{t("recipient")}</TableHead>
                      <TableHead className="text-xs">{t("subject")}</TableHead>
                      <TableHead className="text-xs">{t("sent")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {log.status === "sent" && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200">
                              <CheckCircle2 className="size-3" /> {t("sent")}
                            </Badge>
                          )}
                          {log.status === "failed" && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-red-600 border-red-200">
                              <XCircle className="size-3" /> {t("failed")}
                            </Badge>
                          )}
                          {log.status === "skipped" && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-200">
                              <AlertCircle className="size-3" /> {t("skipped")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <BidiText>{log.reminderRule?.name || "-"}</BidiText>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <IdentifierText>{log.recipientEmail}</IdentifierText>
                        </TableCell>
                        <TableCell className="text-sm min-w-0 whitespace-normal [overflow-wrap:anywhere] max-w-[200px]">
                          <BidiText>{log.subject}</BidiText>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <IdentifierText>{new Date(log.sentAt).toLocaleDateString()}</IdentifierText>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {logTotalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {t("pagination", { page: logPage, pages: logTotalPages, count: logTotal })}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                      disabled={logPage <= 1}
                      onClick={() => setLogPage((p) => p - 1)}
                    >
                      {t("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                      disabled={logPage >= logTotalPages}
                      onClick={() => setLogPage((p) => p + 1)}
                    >
                      {t("next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? t("editRule") : t("newReminderRule")}</SheetTitle>
            <SheetDescription>
              {editingId
                ? t("updateTheReminderRuleConfiguration")
                : t("configureWhenAndHowPaymentRemindersAreSent")}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="settings-reminders-1">{t("name")}</Label>
              <Input
                placeholder={t("eG7DaysBeforeDue")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-8 text-sm" aria-label={t("name")} id="settings-reminders-1" dir="auto"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="settings-reminders-2">{t("triggerType")}</Label>
                <Select
                  value={form.triggerType}
                  onValueChange={(v) =>
                    setForm({ ...form, triggerType: v as typeof form.triggerType })
                  }
                >
                  <SelectTrigger className="text-sm h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={t("triggerType")} id="settings-reminders-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before_due">{t("beforeDueDate")}</SelectItem>
                    <SelectItem value="on_due">{t("onDueDate")}</SelectItem>
                    <SelectItem value="after_due">{t("afterDueDate")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.triggerType !== "on_due" && (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="settings-reminders-3">{t("days")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.triggerDays}
                    onChange={(e) =>
                      setForm({ ...form, triggerDays: Number(e.target.value) || 0 })
                    }
                    className="h-8 text-sm" aria-label={t("days")} id="settings-reminders-3" dir="ltr"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="settings-reminders-4">{t("documentType")}</Label>
                <Select
                  value={form.documentType}
                  onValueChange={(v) =>
                    setForm({ ...form, documentType: v as typeof form.documentType })
                  }
                >
                  <SelectTrigger className="text-sm h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={t("documentType")} id="settings-reminders-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">{t("invoice")}</SelectItem>
                    <SelectItem value="bill">{t("bill")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="settings-reminders-5">{t("recipient")}</Label>
                <Select
                  value={form.recipientType}
                  onValueChange={(v) =>
                    setForm({ ...form, recipientType: v as typeof form.recipientType })
                  }
                >
                  <SelectTrigger className="text-sm h-auto min-h-8 max-w-full whitespace-normal py-1.5 [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal" aria-label={t("recipient")} id="settings-reminders-5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact_email">{t("contactEmail")}</SelectItem>
                    <SelectItem value="contact_persons">{t("contactPersons")}</SelectItem>
                    <SelectItem value="custom">{t("customEmails")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.recipientType === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="settings-reminders-6">{t("customEmailsLabel")}</Label>
                <Input
                  placeholder={t("email1ExampleComEmail2ExampleCom")}
                  value={form.customEmails}
                  onChange={(e) => setForm({ ...form, customEmails: e.target.value })}
                  className="h-8 text-sm" aria-label={t("customEmailsLabel")} id="settings-reminders-6" dir="ltr"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("separateMultipleEmailsWithCommas")}
                </p>
              </div>
            )}

            <ReminderTemplateFields
              subjectTemplate={form.subjectTemplate}
              bodyTemplate={form.bodyTemplate}
              onChange={(field, value) => setForm({ ...form, [field]: value })}
              onInsert={insertVariable}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t("enableRule")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("remindersWillBeSentAutomaticallyWhenEnabled")}
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })} aria-label={t("enableRule")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                onClick={() => setSheetOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                size="sm"
                className="text-xs h-auto min-h-7 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? t("saving") : editingId ? t("update") : t("create")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </ContentReveal>
  );
}
