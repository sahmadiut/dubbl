"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { useTranslations } from "next-intl";
import { webhookStatusLabel } from "@/i18n/webhook-status";
import { settingsErrorMessage } from "@/i18n/settings-errors";

import { useState, useEffect, useCallback } from "react";
import { ContentReveal } from "@/components/ui/content-reveal";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Webhook,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Send,
  ToggleLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  secret: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface DeliveryItem {
  id: string;
  event: string;
  status: string;
  responseStatus: number | null;
  attempts: number;
  createdAt: string;
}

function getOrgId() {
  return localStorage.getItem("activeOrgId") || "";
}

function orgHeaders(extra?: Record<string, string>) {
  return { "x-organization-id": getOrgId(), ...extra };
}

export default function WebhooksPage() {
  const t = useTranslations("SettingsWebhooks");
  const te = useTranslations("SettingsErrors");

  const EVENT_GROUPS: Record<string, { label: string; events: string[] }> = {
    invoices: {
      label: t("invoices"),
      events: ["invoice.created", "invoice.paid", "invoice.overdue"],
    },
    payments: {
      label: t("payments"),
      events: ["payment.received"],
    },
    expenses: {
      label: t("expenses"),
      events: ["expense.created"],
    },
    bills: {
      label: t("bills"),
      events: ["bill.created", "bill.due"],
    },
    contacts: {
      label: t("contacts"),
      events: ["contact.created"],
    },
    accounting: {
      label: t("accounting"),
      events: ["journal.posted"],
    },
    approvals: {
      label: t("approvals"),
      events: ["approval.requested", "approval.completed"],
    },
  };

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Form state
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);

  // Expanded delivery log
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const fetchWebhooks = useCallback(() => {
    const orgId = getOrgId();
    if (!orgId) return;

    fetch("/api/v1/webhooks", { headers: orgHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setWebhooks(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const fetchDeliveries = useCallback((webhookId: string) => {
    setDeliveriesLoading(true);
    fetch(`/api/v1/webhooks/${webhookId}/deliveries?limit=20`, {
      headers: orgHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setDeliveries(data.data);
      })
      .finally(() => setDeliveriesLoading(false));
  }, []);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDeliveries([]);
    } else {
      setExpandedId(id);
      fetchDeliveries(id);
    }
  };

  const openCreate = () => {
    setEditingWebhook(null);
    setFormUrl("");
    setFormDescription("");
    setFormEvents([]);
    setSheetOpen(true);
  };

  const openEdit = (wh: WebhookItem) => {
    setEditingWebhook(wh);
    setFormUrl(wh.url);
    setFormDescription(wh.description || "");
    setFormEvents(wh.events || []);
    setSheetOpen(true);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  const handleSave = async () => {
    if (!formUrl.trim() || formEvents.length === 0) return;
    setSaving(true);

    const url = editingWebhook
      ? `/api/v1/webhooks/${editingWebhook.id}`
      : "/api/v1/webhooks";
    const method = editingWebhook ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: orgHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          url: formUrl.trim(),
          events: formEvents,
          description: formDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(settingsErrorMessage(te, data.error, t("failedToSaveWebhook"), res.status));
        return;
      }

      toast.success(editingWebhook ? t("webhookUpdated") : t("webhookCreated"));
      setSheetOpen(false);
      fetchWebhooks();
    } catch {
      toast.error(t("failedToSaveWebhook"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: "DELETE",
        headers: orgHeaders(),
      });

      if (res.ok) {
        toast.success(t("webhookDeleted"));
        fetchWebhooks();
      } else {
        toast.error(t("failedToDeleteWebhook"));
      }
    } catch {
      toast.error(t("failedToDeleteWebhook"));
    }
  };

  const handleToggleActive = async (wh: WebhookItem) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${wh.id}`, {
        method: "PATCH",
        headers: orgHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ isActive: !wh.isActive }),
      });

      if (res.ok) {
        toast.success(wh.isActive ? t("webhookDisabled") : t("webhookEnabled"));
        fetchWebhooks();
      } else {
        toast.error(t("failedToUpdateWebhook"));
      }
    } catch {
      toast.error(t("failedToUpdateWebhook"));
    }
  };

  const handleSendTest = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/webhooks/${id}/test`, {
        method: "POST",
        headers: orgHeaders(),
      });

      if (res.ok) {
        toast.success(t("testDeliverySent"));
        if (expandedId === id) fetchDeliveries(id);
      } else {
        toast.error(t("testDeliveryFailed"));
      }
    } catch {
      toast.error(t("testDeliveryFailed"));
    }
  };

  const getSuccessRate = (wh: WebhookItem): string | null => {
    // Success rate is shown from deliveries when expanded; we show a placeholder here
    return null;
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("webhooks")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("sendRealTimeEventNotificationsToExternalServices")}{webhooks.length > 0 && (
                <span className="ms-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {t("configuredCount", { count: webhooks.length })}
                </span>
              )}
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
            <Plus className="me-1.5 size-3.5" />
            {t("addWebhook")}
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title={t("noWebhooksYet")}
            description={t("emptyDescription")}
          >
            <Button
              size="sm"
              className="mt-3 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
              onClick={openCreate}
            >
              <Plus className="me-1.5 size-3.5" />
              {t("createYourFirstWebhook")}
            </Button>
          </EmptyState>
        ) : (
          <div className="rounded-xl border">
            {webhooks.map((wh, i) => (
              <div key={wh.id}>
                <div
                  className={`flex items-center gap-4 px-5 py-4 ${
                    i !== webhooks.length - 1 && expandedId !== wh.id
                      ? "border-b"
                      : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <Webhook className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  {/* URL + description (clickable to expand) */}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-start"
                    onClick={() => toggleExpand(wh.id)}
                  >
                    <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                      <IdentifierText>{wh.url}</IdentifierText>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                      <BidiText>{wh.description || "-"}</BidiText>
                    </p>
                  </button>

                  {/* Badges */}
                  <div className="hidden items-center gap-2 sm:flex">
                    <Badge variant="secondary" className="text-xs">
                      {t("eventCount", { count: wh.events.length })}
                    </Badge>
                    <Badge
                      variant={wh.isActive ? "default" : "outline"}
                      className={`text-xs ${
                        wh.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : ""
                      }`}
                    >
                      {wh.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </div>

                  {/* Expand indicator */}
                  <button
                    type="button"
                    className="hidden size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted sm:flex"
                    onClick={() => toggleExpand(wh.id)}
                  >
                    {expandedId === wh.id ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </button>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(wh)}>
                        <Pencil className="me-2 size-3.5" />
                        {t("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendTest(wh.id)}>
                        <Send className="me-2 size-3.5" />
                        {t("sendTest")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(wh)}
                      >
                        <ToggleLeft className="me-2 size-3.5" />
                        {wh.isActive ? t("disable") : t("enable")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(wh.id)}
                      >
                        <Trash2 className="me-2 size-3.5" />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Expanded delivery log */}
                {expandedId === wh.id && (
                  <div
                    className={`border-t bg-muted/30 px-5 py-4 ${
                      i !== webhooks.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <h4 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {t("recentDeliveries")}
                    </h4>
                    {deliveriesLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : deliveries.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        {t("noDeliveriesYet")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {deliveries.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 text-sm"
                          >
                            {d.status === "success" ? (
                              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                            ) : (
                              <XCircle className="size-4 shrink-0 text-red-500" />
                            )}
                            <span className="flex-1 min-w-0 whitespace-normal [overflow-wrap:anywhere] font-mono text-xs">
                              <IdentifierText>{d.event}</IdentifierText>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <IdentifierText>{d.responseStatus
                                ? `HTTP ${d.responseStatus}`
                                : "-"}</IdentifierText>
                            </span>
                            <Badge
                              variant={
                                d.status === "success"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-[10px]"
                            >
                              {webhookStatusLabel(t, d.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {t("attemptCount", { count: d.attempts })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheet form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editingWebhook ? t("editWebhook") : t("newWebhook")}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5 px-4 py-4">
            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="settings-webhooks-1">{t("endpointURL")}</Label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder={t("httpsExampleComWebhooks")}
                type="url"
                className={formUrl.trim() && !/^https?:\/\/.+\..+/.test(formUrl.trim()) ? "border-destructive" : ""} aria-label={t("endpointURL")} id="settings-webhooks-1" dir="ltr"
              />
              {formUrl.trim() && !/^https?:\/\/.+\..+/.test(formUrl.trim()) && (
                <p className="text-xs text-destructive">{t("enterAValidURLStartingWithHttpOrHttps")}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="settings-webhooks-2">{t("description")}</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("optionalDescription")} aria-label={t("description")} id="settings-webhooks-2" dir="auto"
              />
            </div>

            {/* Events */}
            <div className="space-y-3">
              <Label>{t("events")}</Label>
              {Object.entries(EVENT_GROUPS).map(([key, group]) => (
                <div key={key} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.events.map((event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer hover:bg-muted transition-colors"
                      >
                        <Checkbox
                          checked={formEvents.includes(event)}
                          onCheckedChange={() => toggleEvent(event)} aria-label={event}
                        />
                        <IdentifierText>{event}</IdentifierText>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formUrl.trim() || formEvents.length === 0 || !/^https?:\/\/.+\..+/.test(formUrl.trim())} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            >
              {saving
                ? t("saving")
                : editingWebhook
                  ? t("update")
                  : t("create")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
