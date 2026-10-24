"use client";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { useTranslations } from "next-intl";
import { projectListJson, projectStatusKeys, projectPriorityKeys, type ProjectListRow as Project } from "@/i18n/project-presentation";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, Clock, DollarSign, Target, Users } from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectMoneyDisplay as formatMoney } from "@/lib/money/project-display";
import { devDelay } from "@/lib/dev-delay";
import { useCreateDrawer } from "@/components/dashboard/create-drawer";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-blue-200 bg-blue-50 text-blue-700",
  on_hold: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  archived: "border-gray-200 bg-gray-50 text-gray-700",
};

const priorityColors: Record<string, string> = {
  low: "border-gray-200 bg-gray-50 text-gray-600",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

type ProjectTranslator = ReturnType<typeof useTranslations<"Projects">>;

function formatHours(t: ProjectTranslator, minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? t("hoursMinutes", { hours: hrs, minutes: mins }) : t("hours", { hours: hrs });
}

function projectColumns(t: ProjectTranslator, unitPresentation: import("@/i18n/numbers").NumberPresentation): Column<Project>[] { return [
  {
    key: "name",
    header: t("project"),
    render: (r) => (
      <div className="flex items-center gap-2.5">
        <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
        <div className="min-w-0">
          <span className="text-sm font-medium block truncate">{r.name}</span>
          {r.contact && <span className="text-[11px] text-muted-foreground">{r.contact.name}</span>}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: t("status"),
    className: "w-28",
    render: (r) => (
      <Badge variant="outline" className={cn("text-[10px]", statusColors[r.status])}>
        {t(projectStatusKeys[r.status as keyof typeof projectStatusKeys] ?? "unknownStatus")}
      </Badge>
    ),
  },
  {
    key: "priority",
    header: t("priority"),
    className: "w-24",
    render: (r) => (
      <Badge variant="outline" className={cn("text-[10px]", priorityColors[r.priority])}>
        {t(projectPriorityKeys[r.priority as keyof typeof projectPriorityKeys] ?? "unknownPriority")}
      </Badge>
    ),
  },
  {
    key: "progress",
    header: t("time"),
    className: "w-32",
    render: (r) => {
      const pct = r.estimatedHours > 0 ? Math.round((r.totalHours / r.estimatedHours) * 100) : 0;
      return (
        <div className="space-y-1">
          <span className="text-xs font-mono tabular-nums">{formatHours(t, r.totalHours)}</span>
          {r.estimatedHours > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-16 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", pct > 100 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{pct}%</span>
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: "budget",
    header: t("budget"),
    className: "w-28 text-right",
    render: (r) => (
      <span className="font-mono text-xs tabular-nums">
        {r.budget > 0 ? formatMoney(r.budget, r.currency, unitPresentation) : "-"}
      </span>
    ),
  },
  {
    key: "billed",
    header: t("billed"),
    className: "w-28 text-right",
    render: (r) => (
      <span className="font-mono text-xs tabular-nums">{formatMoney(r.totalBilled, r.currency, unitPresentation)}</span>
    ),
  },
  {
    key: "team",
    header: t("team"),
    className: "w-24",
    render: (r) => {
      if (r.members.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <div className="flex -space-x-1.5">
          {r.members.slice(0, 3).map((m) => (
            <div key={m.id} className="size-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-medium ring-2 ring-white" title={m.member.user.name || m.member.user.email}>
              {(m.member.user.name || m.member.user.email)[0].toUpperCase()}
            </div>
          ))}
          {r.members.length > 3 && (
            <div className="size-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[9px] font-medium ring-2 ring-white">
              +{r.members.length - 3}
            </div>
          )}
        </div>
      );
    },
  },
]; }

export default function ProjectsPage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("Projects");
  const columns = projectColumns(t, unitPresentation);
  const router = useRouter();
  const { open: openDrawer } = useCreateDrawer();
  const [loadError, setLoadError] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  useDocumentTitle(t("documentTitle"));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const orgId = localStorage.getItem("activeOrgId");
        if (!orgId) {
          if (!cancelled) { setProjects([]); setLoadError("organizationRequired"); }
          return;
        }
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        const data = await projectListJson(await fetch(`/api/v1/projects?${params}`, {
          headers: { "x-organization-id": orgId },
        }));
        await devDelay();
        if (!cancelled) { setProjects(data.data); setLoadError(""); }
      } catch {
        if (!cancelled) { setProjects([]); setLoadError("loadFailed"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [statusFilter]);

  const activeProjects = projects.filter((p) => p.status === "active");
  const currencies = new Set(projects.map(p => p.currency));
  const totalCurrency = projects[0]?.currency || "USD";
  const totalBudget = projects.reduce((sum, p) => sum + BigInt(p.budget), 0n);
  const totalBilled = projects.reduce((sum, p) => sum + BigInt(p.totalBilled), 0n);
  const totalHours = projects.reduce((sum, p) => sum + p.totalHours, 0);
  const totalMembers = new Set(projects.flatMap(p => p.members.map(m => m.member.id))).size;

  if (loading) return <BrandLoader />;
  if (loadError) return <p role="alert" className="text-sm text-destructive">{t(loadError === "organizationRequired" ? "organizationRequired" : "loadFailed")}</p>;

  if (!loading && projects.length === 0 && statusFilter === "all") {
    return (
      <ContentReveal className="space-y-10">
        <Section title={t("projects")} description={t("firstProject")}>
          <EmptyState
            icon={FolderKanban}
            title={t("noProjects")}
            description={t("firstProject")}
          >
            <Button
              onClick={() => openDrawer("project")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 size-4" />
              {t("newProject")}
            </Button>
          </EmptyState>
        </Section>
      </ContentReveal>
    );
  }

  return (
    <ContentReveal>
    <div className="space-y-6 sm:space-y-8">
      <Section title={t("overview")} description={t("overviewDescription")}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title={t("active")} value={activeProjects.length.toString()} icon={FolderKanban} />
            <StatCard title={t("totalBudget")} value={currencies.size > 1 ? t("multipleCurrencies") : formatMoney(totalBudget, totalCurrency, unitPresentation)} icon={DollarSign} />
            <StatCard title={t("totalBilled")} value={currencies.size > 1 ? t("multipleCurrencies") : formatMoney(totalBilled, totalCurrency, unitPresentation)} icon={Target}
              change={currencies.size <= 1 && totalBudget > 0 ? t("budgetPercent", { percent: Number((totalBilled * 200n + totalBudget) / (totalBudget * 2n)) }) : undefined}
            />
            <StatCard title={t("hoursLogged")} value={formatHours(t, totalHours)} icon={Clock} />
            <StatCard title={t("teamMembers")} value={totalMembers.toString()} icon={Users} />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => openDrawer("project")}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="mr-2 size-4" />
              {t("newProject")}
            </Button>
          </div>
        </div>
      </Section>

      <div className="h-px bg-border" />

      <Section title={t("projects")} description={t("manageDescription")}>
        <div className="space-y-4">
          <div className="overflow-x-auto -mx-1 px-1">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">{t("all")}</TabsTrigger>
                <TabsTrigger value="active">{t("active")}</TabsTrigger>
                <TabsTrigger value="completed">{t("completed")}</TabsTrigger>
                <TabsTrigger value="on_hold">{t("onHold")}</TabsTrigger>
                <TabsTrigger value="archived">{t("archived")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <DataTable
              columns={columns}
              data={projects}
              loading={loading}
              emptyMessage={t("noResults")}
              onRowClick={(r) => router.push(`/projects/${r.id}`)}
            />
        </div>
      </Section>
    </div>
    </ContentReveal>
  );
}
