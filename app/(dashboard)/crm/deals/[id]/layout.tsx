"use client";

import { crmDealDetailJson, crmDealMutationJson, crmActivityCreatedJson, type CrmDealDetail } from "@/i18n/crm-presentation";
import { useCrmDetailPresentation } from "@/i18n/crm-detail-presentation";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Activity,
  Settings2,
  Trophy,
  XCircle,
  User,
  Target,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export type DealDetail = CrmDealDetail;

export function getHeaders() {
  const orgId = localStorage.getItem("activeOrgId") || "";
  if (!orgId) throw new Error("Organization required");
  return { "x-organization-id": orgId, "Content-Type": "application/json" };
}

export function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { value: "overview", label: "overview", icon: FileText },
  { value: "activity", label: "activity", icon: Activity },
  { value: "settings", label: "settings", icon: Settings2 },
] as const;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface DealContextValue {
  deal: DealDetail;
  setDeal: React.Dispatch<React.SetStateAction<DealDetail | null>>;
  fetchDeal: () => Promise<void>;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  confirmDialog: ReturnType<typeof useConfirm>["dialog"];
  stageChanging: boolean;
  changeStage: (stageId: string) => Promise<void>;
  markWon: () => Promise<void>;
  markLost: () => Promise<void>;
  addActivity: () => Promise<void>;
  activityType: string;
  setActivityType: (v: string) => void;
  activityContent: string;
  setActivityContent: (v: string) => void;
  submitting: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
}

const DealContext = createContext<DealContextValue | null>(null);

export function useDealContext() {
  const ctx = useContext(DealContext);
  if (!ctx) throw new Error("useDealContext must be used within DealDetailLayout");
  return ctx;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function DealDetailLayout({ children }: { children: React.ReactNode }) {
  const { t } = useCrmDetailPresentation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageChanging, setStageChanging] = useState(false);
  const [activityType, setActivityType] = useState("note");
  const [activityContent, setActivityContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestVersion = useRef(0);
  const cancelReads = useCallback(() => { requestVersion.current++; }, []);

  useEntityTitle(deal?.title ?? undefined);

  const fetchDeal = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const res = await fetch(`/api/v1/crm/deals/${id}`, { headers: getHeaders() });
      const data = await crmDealDetailJson(res, id);
      if (version === requestVersion.current) setDeal(data.deal);
    } catch {
      if (version === requestVersion.current) toast.error(t("loadFailed"));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    setDeal(null);
    setLoading(true);
    fetchDeal();
    return cancelReads;
  }, [fetchDeal, cancelReads]);

  async function changeStage(stageId: string) {
    setStageChanging(true);
    try {
      await crmDealMutationJson(await fetch(`/api/v1/crm/deals/${id}/stage`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ stageId }),
      }), id);
      toast.success(t("stageUpdated"));
      await fetchDeal();
    } catch {
      toast.error(t("stageFailed"));
    } finally {
      setStageChanging(false);
    }
  }

  async function markWon() {
    setStageChanging(true);
    try {
      await crmDealMutationJson(await fetch(`/api/v1/crm/deals/${id}/won`, { method: "POST", headers: getHeaders() }), id);
      toast.success(t("markedWon"));
      await fetchDeal();
    } catch { toast.error(t("wonFailed")); }
    finally { setStageChanging(false); }
  }

  async function markLost() {
    const confirmed = await confirm({
      title: t("lostTitle"),
      description: t("lostDescription"),
      confirmLabel: t("markLost"),
      cancelLabel: t("cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    setStageChanging(true);
    try {
      await crmDealMutationJson(await fetch(`/api/v1/crm/deals/${id}/lost`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ reason: null }),
      }), id);
      toast.success(t("markedLost"));
      await fetchDeal();
    } catch { toast.error(t("lostFailed")); }
    finally { setStageChanging(false); }
  }

  async function addActivity() {
    if (!activityContent.trim()) return;
    setSubmitting(true);
    try {
      await crmActivityCreatedJson(await fetch(`/api/v1/crm/deals/${id}/activities`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ type: activityType, content: activityContent }),
      }), id);
      setActivityContent("");
      toast.success(t("activityAdded"));
    } catch {
      toast.error(t("activityFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const activeTab = pathname.endsWith("/activity") ? "activity"
    : pathname.endsWith("/settings") ? "settings"
    : "overview";

  if (loading || (deal && deal.id !== id)) return <BrandLoader />;

  if (!deal) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/crm")}>
          {t("backToPipeline")}
        </Button>
      </div>
    );
  }

  const stages = deal.pipeline?.stages || [];
  const currentStageIdx = stages.findIndex((s) => s.id === deal.stageId);
  const isWon = !!deal.wonAt;
  const isLost = !!deal.lostAt;
  const isClosed = isWon || isLost;

  return (
    <DealContext.Provider
      value={{
        deal,
        setDeal,
        fetchDeal,
        confirm,
        confirmDialog,
        stageChanging,
        changeStage,
        markWon,
        markLost,
        addActivity,
        activityType,
        setActivityType,
        activityContent,
        setActivityContent,
        submitting,
        saving,
        setSaving,
      }}
    >
      <div>
        {/* Back button */}
        <button
          onClick={() => router.push("/crm")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToPipeline")}
        </button>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-2">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">{deal.title}</h1>
              {isWon && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 dark:bg-emerald-900/60 dark:text-emerald-400 shrink-0">
                  <Trophy className="size-3 mr-1" /> {t("won")}
                </Badge>
              )}
              {isLost && (
                <Badge className="bg-red-100 text-red-700 border-0 dark:bg-red-900/60 dark:text-red-400 shrink-0">
                  <XCircle className="size-3 mr-1" /> {t("lost")}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono font-semibold tabular-nums text-foreground text-base">
                {formatMoney(deal.valueCents, deal.currency)}
              </span>
              {deal.probability !== null && (
                <span className="flex items-center gap-1">
                  <Target className="size-3" />
                  {deal.probability}%
                </span>
              )}
              {deal.contact && (
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  {deal.contact.name}
                </span>
              )}
              {deal.pipeline && (
                <span className="flex items-center gap-1">
                  <Briefcase className="size-3" />
                  {deal.pipeline.name}
                </span>
              )}
            </div>
          </div>

          {!isClosed && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30" disabled={stageChanging} onClick={markLost}>
                <XCircle className="size-3" /> {t("markLost")}
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={stageChanging} onClick={markWon}>
                <Trophy className="size-3" /> {t("markWon")}
              </Button>
            </div>
          )}
        </div>

        {/* Stage progress bar */}
        {stages.length > 0 && (
          <div className="mb-6 mt-4">
            <div className="flex items-center gap-1.5">
              {stages.filter((s) => s.id !== "closed_lost").map((stage) => {
                const stageIdx = stages.findIndex((s) => s.id === stage.id);
                const isCurrent = stage.id === deal.stageId;
                const isPast = stageIdx < currentStageIdx;
                const isActive = isCurrent || isPast || isWon;

                return (
                  <button
                    key={stage.id}
                    disabled={isClosed || stageChanging}
                    onClick={() => !isClosed && changeStage(stage.id)}
                    className={cn(
                      "relative flex-1 rounded-full transition-all",
                      isCurrent ? "h-3.5" : "h-2",
                      !isActive && "opacity-15",
                      !isClosed && "hover:opacity-90 cursor-pointer",
                      isClosed && "cursor-default"
                    )}
                    style={{
                      backgroundColor: stage.color,
                      ...(isCurrent
                        ? { boxShadow: `0 0 0 3px var(--background), 0 0 0 5px ${stage.color}, 0 0 12px ${stage.color}60` }
                        : {}),
                    }}
                    title={stage.name}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              {stages.filter((s) => s.id !== "closed_lost").map((stage) => {
                const stageIdx = stages.findIndex((s) => s.id === stage.id);
                const isCurrent = stage.id === deal.stageId;
                const isPast = stageIdx < currentStageIdx;
                const isActive = isCurrent || isPast || isWon;
                return (
                  <div key={stage.id} className="flex-1 text-center">
                    <span
                      className={cn(
                        "text-[10px] leading-none",
                        isCurrent
                          ? "font-bold"
                          : isActive
                            ? "font-medium text-muted-foreground"
                            : "font-medium text-muted-foreground/40"
                      )}
                      style={isCurrent ? { color: stage.color } : undefined}
                    >
                      {stage.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-px bg-gradient-to-r from-emerald-500/20 via-border to-transparent mb-2" />

        {/* Tabs */}
        <nav className="-mt-0 mb-8 flex items-center gap-1 overflow-x-auto border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const tabHref = tab.value === "overview"
              ? `/crm/deals/${id}`
              : `/crm/deals/${id}/${tab.value}`;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => router.push(tabHref)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pb-2.5 pt-3 text-[13px] font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t(tab.label)}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <ContentReveal key={pathname}>
          {children}
        </ContentReveal>

        {confirmDialog}
      </div>
    </DealContext.Provider>
  );
}
