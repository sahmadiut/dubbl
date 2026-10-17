"use client";
import { useTranslations } from "next-intl";

import {
  Bell,
  FileText,
  DollarSign,
  Package,
  Landmark,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  Mail,
  Save,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";

const NOTIFICATION_TYPES = [
  { type: "invoice_overdue", label: "invoiceOverdue", description: "whenAnInvoicePassesItsDueDate", icon: FileText, color: "text-red-500 bg-red-500/10" },
  { type: "payment_received", label: "paymentReceived", description: "whenAPaymentIsRecorded", icon: DollarSign, color: "text-emerald-500 bg-emerald-500/10" },
  { type: "inventory_low", label: "lowInventory", description: "whenStockFallsBelowMinimumThreshold", icon: Package, color: "text-amber-500 bg-amber-500/10" },
  { type: "payroll_due", label: "payrollDue", description: "whenAPayrollRunIsApproaching", icon: Landmark, color: "text-blue-500 bg-blue-500/10" },
  { type: "approval_needed", label: "approvalNeeded", description: "whenSomethingRequiresYourApproval", icon: ShieldCheck, color: "text-purple-500 bg-purple-500/10" },
  { type: "system_alert", label: "systemAlert", description: "importantSystemNotifications", icon: AlertTriangle, color: "text-orange-500 bg-orange-500/10" },
  { type: "task_assigned", label: "taskAssigned", description: "whenATaskIsAssignedToYou", icon: ClipboardList, color: "text-indigo-500 bg-indigo-500/10" },
] as const;

const DEBOUNCE_MINUTES = 120; // 2 hours

export interface Preference {
  type: string;
  channel: string;
  enabled: boolean;
  digestIntervalMinutes: number;
}

export type PrefState = Record<string, { inApp: boolean; email: boolean }>;

export function buildDefaultState(): PrefState {
  const state: PrefState = {};
  for (const item of NOTIFICATION_TYPES) {
    state[item.type] = { inApp: true, email: false };
  }
  return state;
}

export function mergePrefs(prefs: Preference[]): PrefState {
  const state = buildDefaultState();
  for (const p of prefs) {
    if (!state[p.type]) continue;
    if (p.channel === "in_app") {
      state[p.type].inApp = p.enabled;
    } else if (p.channel === "email") {
      state[p.type].email = p.enabled;
    }
  }
  return state;
}

export function preferencePayload(prefs: PrefState): Preference[] {
  return Object.entries(prefs).flatMap(([type, val]) => [
    { type, channel: "in_app", enabled: val.inApp, digestIntervalMinutes: 0 },
    { type, channel: "email", enabled: val.email, digestIntervalMinutes: DEBOUNCE_MINUTES },
  ]);
}

export function NotificationPreferencesForm({ prefs, saving, onSave, onToggleInApp, onToggleEmail }: {
  prefs: PrefState; saving: boolean; onSave: () => void; onToggleInApp: (type: string) => void; onToggleEmail: (type: string) => void;
}) {
  const t = useTranslations("SettingsNotifications");
  const anyEmailEnabled = Object.values(prefs).some((v) => v.email);
  return (
    <ContentReveal>
      <div className="space-y-6 px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{t("notificationPreferences")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("chooseHowYouWantToBeNotified")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onSave} disabled={saving}>
              <Save className="size-3" />
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </div>
        </div>

        {/* Channel legend */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Bell className="size-3.5" />
            <span>{t("inApp")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="size-3.5" />
            <span>{t("email")}</span>
          </div>
        </div>

        {/* Notification type list */}
        <div className="rounded-lg border divide-y">
          {NOTIFICATION_TYPES.map((item) => {
            const Icon = item.icon;
            const val = prefs[item.type];

            return (
              <div key={item.type} className="flex items-center gap-4 px-4 py-3.5">
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", item.color)}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{t(item.label)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t(item.description)}</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {/* In-app toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${item.type}-inapp`} className="text-[11px] text-muted-foreground">
                      <Bell className="size-3" />
                    </Label>
                    <Switch
                      id={`${item.type}-inapp`}
                      aria-label={t("inAppFor", { type: t(item.label) })}
                      checked={val.inApp}
                      onCheckedChange={() => onToggleInApp(item.type)}
                      className="scale-90"
                    />
                  </div>
                  {/* Email toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`${item.type}-email`} className="text-[11px] text-muted-foreground">
                      <Mail className="size-3" />
                    </Label>
                    <Switch
                      id={`${item.type}-email`}
                      aria-label={t("emailFor", { type: t(item.label) })}
                      checked={val.email}
                      onCheckedChange={() => onToggleEmail(item.type)}
                      className="scale-90"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Email debounce info */}
        {anyEmailEnabled && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed px-4 py-3">
            <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium">{t("emailDebounce")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("debounceHelp")}
              </p>
            </div>
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
