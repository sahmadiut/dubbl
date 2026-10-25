"use client";

import { BidiText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback } from "react";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  UserPlus,
  Crown,
  TrendingUp,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  totalOrgs: number;
  totalMembers: number;
  recentUsers: number;
  recentOrgs: number;
  enterpriseOrgs: number;
  planBreakdown: { plan: string; count: number }[];
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-zinc-200 dark:bg-zinc-700",
  pro: "bg-blue-500",
};

export default function AdminDashboardPage() {
  const t = useTranslations("Admin");
  const PLAN_LABELS: Record<string, string> = {
    free: t("free"),
    pro: t("pro"),
  };

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!stats) return null;

  const totalPlans = stats.planBreakdown.reduce((s, r) => s + r.count, 0);

  return (
    <ContentReveal>
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold">{t("adminDashboard")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("platformOverviewAndKeyMetrics")}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label={t("totalUsers")}
            value={stats.totalUsers}
            sub={t("recentCount", { count: stats.recentUsers })}
          />
          <StatCard
            icon={Building2}
            label={t("organizations")}
            value={stats.totalOrgs}
            sub={t("recentCount", { count: stats.recentOrgs })}
          />
          <StatCard
            icon={Crown}
            label={t("enterprise")}
            value={stats.enterpriseOrgs}
            sub={t("manuallyManaged")}
          />
          <StatCard
            icon={UserPlus}
            label={t("totalMembers")}
            value={stats.totalMembers}
            sub={t("acrossAllOrgs")}
          />
        </div>

        {/* Plan distribution */}
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{t("planDistribution")}</h3>
          </div>

          {/* Bar */}
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {stats.planBreakdown
              .sort((a, b) => {
                const order = ["free", "pro"];
                return order.indexOf(a.plan) - order.indexOf(b.plan);
              })
              .map((r) => (
                <div
                  key={r.plan}
                  className={`${PLAN_COLORS[r.plan] || "bg-gray-400"} transition-all`}
                  style={{ width: `${totalPlans > 0 ? (r.count / totalPlans) * 100 : 0}%` }}
                />
              ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4">
            {stats.planBreakdown
              .sort((a, b) => {
                const order = ["free", "pro"];
                return order.indexOf(a.plan) - order.indexOf(b.plan);
              })
              .map((r) => (
                <div key={r.plan} className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full ${PLAN_COLORS[r.plan] || "bg-gray-400"}`} />
                  <span className="text-xs text-muted-foreground">
                    {Object.hasOwn(PLAN_LABELS, r.plan) ? PLAN_LABELS[r.plan] : t("unknown")} - {r.count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </ContentReveal>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border p-4 space-y-2 [overflow-wrap:anywhere]">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums"><BidiText dir="ltr">{value.toLocaleString()}</BidiText></p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
