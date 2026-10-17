"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePresentation } from "@/i18n/provider";
import { auditActionLabel, auditEntityLabel, auditRelativeTime, auditDayLabel } from "@/i18n/audit-presentation";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  FileText,
  ArrowLeftRight,
  BookOpen,
  Users,
  Settings,
  ShoppingCart,
  Receipt,
  Wallet,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Send,
  Check,
  XCircle,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userName: string;
  createdAt: string;
}

const ENTITY_ICONS: Record<string, LucideIcon> = {
  entry: ArrowLeftRight,
  account: BookOpen,
  invoice: FileText,
  bill: ShoppingCart,
  quote: Receipt,
  expense: Wallet,
  contact: Users,
  banking: Landmark,
  settings: Settings,
};

const ACTION_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  created: { icon: Plus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-100 dark:ring-emerald-900/40" },
  updated: { icon: Pencil, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40 ring-blue-100 dark:ring-blue-900/40" },
  deleted: { icon: Trash2, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40 ring-red-100 dark:ring-red-900/40" },
  sent: { icon: Send, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40 ring-violet-100 dark:ring-violet-900/40" },
  posted: { icon: Check, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-100 dark:ring-emerald-900/40" },
  voided: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40 ring-red-100 dark:ring-red-900/40" },
  approved: { icon: Check, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-100 dark:ring-emerald-900/40" },
};

const DEFAULT_ACTION = { icon: ArrowLeftRight, color: "text-muted-foreground", bg: "bg-muted ring-border" };

function getActionConfig(action: string) {
  const lower = action.toLowerCase();
  for (const [key, config] of Object.entries(ACTION_CONFIG)) {
    if (lower.includes(key)) return config;
  }
  return DEFAULT_ACTION;
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4 px-4 py-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="size-7 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const t = useTranslations("JournalActivity");
  const audit = useTranslations("SettingsAudit");
  const presentation = usePresentation();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem("activeOrgId");
    if (!id) return;

    fetch("/api/v1/audit-log?limit=5", {
      headers: { "x-organization-id": id },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          setEntries(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group entries by day
  const grouped = entries.reduce<{ label: string; items: AuditEntry[] }[]>((groups, entry) => {
    const label = auditDayLabel(audit, presentation, entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(entry);
    } else {
      groups.push({ label, items: [entry] });
    }
    return groups;
  }, []);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-[13px] font-semibold">{t("title")}</h3>
      </div>

      {loading ? (
        <ActivitySkeleton />
      ) : entries.length === 0 ? (
        <div className="py-12 text-center px-4">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
            <ArrowLeftRight className="size-5 text-muted-foreground" />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t("empty")}
          </p>
        </div>
      ) : (
        <>
          <div className="py-1">
            {grouped.map((group, gi) => (
              <div key={group.label}>
                {/* Day label */}
                <div className="px-4 pt-3 pb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                </div>

                {/* Timeline entries */}
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[29px] top-0 bottom-0 w-px bg-border" />

                  {group.items.map((entry, i) => {
                    const EntityIcon = ENTITY_ICONS[entry.entityType] || ArrowLeftRight;
                    const actionConfig = getActionConfig(entry.action);
                    const ActionIcon = actionConfig.icon;
                    const isLast = i === group.items.length - 1 && gi === grouped.length - 1;

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "relative flex items-start gap-3 px-4 py-2 transition-colors hover:bg-muted/30",
                          isLast && "pb-3"
                        )}
                      >
                        {/* Timeline dot */}
                        <div className={cn(
                          "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-md ring-1",
                          actionConfig.bg, actionConfig.color
                        )}>
                          <ActionIcon className="size-3" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[12px] leading-snug">
                            <span className="font-medium">{entry.userName}</span>{" "}
                            <span className="text-muted-foreground">{auditActionLabel(audit, entry.action)}</span>{" "}
                            <span className="inline-flex items-center gap-1">
                              <EntityIcon className="inline size-3 text-muted-foreground/60" />
                              <span className="text-muted-foreground">{auditEntityLabel(audit, entry.entityType)}</span>
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">
                            {auditRelativeTime(audit, presentation, entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* View all footer */}
          <Link
            href="/settings/audit-log"
            className="flex items-center justify-center gap-1.5 border-t px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/30"
          >
            {t("viewAll")}
            <ChevronRight className="size-3" />
          </Link>
        </>
      )}
    </div>
  );
}
