"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import {
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  ClipboardList,
  Activity,
  DollarSign,
  Target,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { cn } from "@/lib/utils";
import { useDealContext } from "./layout";
import { useCrmDetailPresentation } from "@/i18n/crm-detail-presentation";

const ACTIVITY_ICONS: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Calendar,
  task: ClipboardList,
};

const ACTIVITY_COLORS: Record<string, string> = {
  note: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  email: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  call: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  meeting: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  task: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
};

export default function DealOverviewPage() {
  const unitPresentation = useUnitPresentation();
  const { t, sourceLabel, activityLabel, formatDate, formatTime, timeAgo } = useCrmDetailPresentation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { deal, stageChanging, changeStage } = useDealContext();

  const stages = deal.pipeline?.stages || [];
  const currentStageIdx = stages.findIndex((s) => s.id === deal.stageId);
  const isWon = !!deal.wonAt;
  const isLost = !!deal.lostAt;
  const isClosed = isWon || isLost;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Main content */}
      <div className="space-y-4">
        {/* Deal info card */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">{t("dealInformation")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("contact")}</p>
                {deal.contact ? (
                  <div>
                    <p className="text-sm font-medium"><BidiText className="min-w-0 max-w-full">{deal.contact.name}</BidiText></p>
                    {deal.contact.email && (
                      <p className="text-xs text-muted-foreground"><IdentifierText className="min-w-0 max-w-full">{deal.contact.email}</IdentifierText></p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">-</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("assignedTo")}</p>
                <p className="text-sm"><BidiText className="min-w-0 max-w-full">{deal.assignedUser?.name || "-"}</BidiText></p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("source")}</p>
                <p className="text-sm">{sourceLabel(deal.source)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{t("expectedClose")}</p>
                <p className="text-sm">
                  <IdentifierText className="min-w-0 max-w-full">{deal.expectedCloseDate
                    ? formatDate(deal.expectedCloseDate)
                    : "-"}</IdentifierText>
                </p>
              </div>
            </div>
          </div>
          {deal.notes && (
            <>
              <div className="h-px bg-border" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t("notes")}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap"><BidiText className="min-w-0 max-w-full">{deal.notes}</BidiText></p>
              </div>
            </>
          )}
          {deal.lostReason && (
            <>
              <div className="h-px bg-border" />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t("lostReason")}</p>
                <p className="text-sm text-red-600 dark:text-red-400"><BidiText className="min-w-0 max-w-full">{deal.lostReason}</BidiText></p>
              </div>
            </>
          )}
        </div>

        {/* Recent activity preview */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between">
            <h3 className="text-sm font-semibold">{t("recentActivity")}</h3>
            {deal.activities.length > 0 && (
              <button
                onClick={() => router.push(`/crm/deals/${id}/activity`)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
              >
                {t("viewAll", { count: deal.activities.length })}
              </button>
            )}
          </div>
          {deal.activities.length === 0 ? (
            <div className="py-4 text-center">
              <Activity className="size-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("noActivity")}</p>
              <button
                onClick={() => router.push(`/crm/deals/${id}/activity`)}
                className="text-xs text-emerald-600 hover:underline mt-1 font-medium h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
              >
                {t("logFirst")}
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {deal.activities.slice(0, 3).map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.type] || MessageSquare;
                return (
                  <div key={activity.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.note)}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium"><BidiText className="min-w-0 max-w-full">{activity.user?.name || t("system")}</BidiText></span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize min-h-3 h-auto.5 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">{activityLabel(activity.type)}</Badge>
                        <span className="text-[10px] text-muted-foreground ms-auto shrink-0">{timeAgo(activity.createdAt)}</span>
                      </div>
                      {activity.content && (
                        <p className="text-xs text-muted-foreground mt-0.5 [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{activity.content}</BidiText></p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Key metrics */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("keyMetrics")}</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold font-mono tabular-nums"><IdentifierText className="min-w-0 max-w-full">{formatMoney(deal.valueCents, deal.currency, unitPresentation)}</IdentifierText></p>
                <p className="text-[10px] text-muted-foreground">{t("dealValue")}</p>
              </div>
            </div>
            {deal.probability !== null && (
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                  <Target className="size-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between">
                    <p className="text-sm font-bold tabular-nums"><IdentifierText>{deal.probability}%</IdentifierText></p>
                    <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      <IdentifierText className="min-w-0 max-w-full">{formatMoney(((BigInt(deal.valueCents) * BigInt(deal.probability) * 2n + 100n) / 200n), deal.currency, unitPresentation)}</IdentifierText>
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${deal.probability}%`,
                        backgroundColor: deal.probability >= 70 ? "#10b981" : deal.probability >= 40 ? "#f59e0b" : "#94a3b8",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t("weightedValue")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline stages */}
        {stages.length > 0 && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pipelineStage")}</h3>
            <div className="space-y-1">
              {stages.map((stage, idx) => {
                const isCurrent = stage.id === deal.stageId;
                const isPast = idx < currentStageIdx;
                return (
                  <button
                    key={stage.id}
                    disabled={isClosed || stageChanging}
                    onClick={() => !isClosed && changeStage(stage.id)}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-start transition-colors",
                      isCurrent && "bg-muted",
                      !isClosed && !isCurrent && "hover:bg-muted/50 cursor-pointer",
                      isClosed && "cursor-default"
                    )}
                  >
                    <div className="relative flex items-center justify-center size-4 shrink-0">
                      {isPast || (isWon && stage.id !== "closed_lost") ? (
                        <div className="size-4 rounded-full flex items-center justify-center" style={{ backgroundColor: stage.color }}>
                          <Check className="size-2.5 text-white" />
                        </div>
                      ) : (
                        <div
                          className={cn("size-3 rounded-full border-2", isCurrent ? "border-0" : "")}
                          style={{
                            backgroundColor: isCurrent ? stage.color : "transparent",
                            borderColor: isCurrent ? stage.color : "#d1d5db",
                          }}
                        />
                      )}
                    </div>
                    <span className={cn("text-xs", isCurrent ? "font-medium" : "text-muted-foreground")}>
                      <BidiText className="min-w-0 max-w-full">{stage.name}</BidiText>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Created date */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-[11px] text-muted-foreground">
            {t.rich("createdOn", { date: formatTime(deal.createdAt) , code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}
          </p>
          {deal.wonAt && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
              {t.rich("wonOn", { date: formatTime(deal.wonAt) , code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}
            </p>
          )}
          {deal.lostAt && (
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
              {t.rich("lostOn", { date: formatTime(deal.lostAt) , code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
