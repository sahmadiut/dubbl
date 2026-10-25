"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { projectInvoiceJson } from "@/i18n/project-presentation";
import { useProjectPresentation } from "@/i18n/project-overview-presentation";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleDot,
  CheckCircle2,
  Clock,
  Flag,
  StickyNote,
  Users,
  Settings2,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlurReveal } from "@/components/ui/blur-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { cn } from "@/lib/utils";
import {
  ProjectProvider,
  useProject,
  daysUntil,
} from "./project-context";
import { projectMoneyDisplay } from "@/lib/money/project-display";

function ProjectLayoutInner({ children }: { children: React.ReactNode }) {
  const unitPresentation = useUnitPresentation();
  const { t, statusConfig, priorityConfig, formatHours } = useProjectPresentation();
  const { project: proj, loading, loadError, orgId, projectId } = useProject();
  const formatMoney = (amount: number | bigint | string) => projectMoneyDisplay(amount, proj?.currency ?? "USD", unitPresentation);
  const pathname = usePathname();
  const router = useRouter();

  if (loading) return <BrandLoader />;
  if (!proj) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p role={loadError ? "alert" : undefined} className="text-sm text-muted-foreground">{t(loadError || "notFound")}</p>
        <Button variant="ghost" size="sm" asChild className="mt-2 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]">
          <Link href="/projects">{t("backToProjects")}</Link>
        </Button>
      </div>
    );
  }

  const base = `/projects/${projectId}`;
  const sc = statusConfig[proj.status] || statusConfig.active;
  const daysLeft = daysUntil(proj.endDate);
  const doneTasks = proj.tasks.filter(t => t.status === "done").length;
  const totalTasks = proj.tasks.length;
  const tabs = [
    { href: base, label: t("overview"), icon: CircleDot, exact: true },
    ...(proj.enableTasks ? [{ href: `${base}/tasks`, label: t("tasks"), icon: CheckCircle2, count: proj.tasks.filter(t => t.status !== "done" && t.status !== "cancelled").length }] : []),
    ...(proj.enableTimeTracking ? [{ href: `${base}/time`, label: t("time"), icon: Clock }] : []),
    ...(proj.enableMilestones ? [{ href: `${base}/milestones`, label: t("milestones"), icon: Flag }] : []),
    ...(proj.enableNotes ? [{ href: `${base}/notes`, label: t("notes"), icon: StickyNote, count: proj.notes.length }] : []),
    { href: `${base}/members`, label: t("team"), icon: Users, count: proj.members.length },
    { href: `${base}/settings`, label: t("settings"), icon: Settings2 },
  ];

  async function handleGenerateInvoice() {
    if (!orgId) { toast.error(t("organizationRequired")); return; }
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({}),
      });
      const data = await projectInvoiceJson(res);
      toast.success(t("invoiceGenerated"));
      router.push(`/sales/${data.invoice.id}`);
    } catch {
      toast.error(t("invoiceFailed"));
    }
  }

  return (
    <div>
      {/* ── Header: full-width spread ── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 size-7 -ms-1">
          <Link href="/projects" aria-label={t("backToProjects")}><ArrowLeft className="size-3.5 rtl:rotate-180" /></Link>
        </Button>
        <div className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: proj.color }} />
        <h1 className="text-base font-semibold tracking-tight min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{proj.name}</BidiText></h1>
        <Badge variant="outline" className={(cn("text-[10px] min-h-5 h-auto shrink-0", sc.color)) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>
          <span className={cn("size-1.5 rounded-full me-1", sc.dot)} />{sc.label}
        </Badge>
        <Badge variant="outline" className={(cn("text-[10px] min-h-5 h-auto shrink-0", priorityConfig[proj.priority]?.color)) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>
          {priorityConfig[proj.priority]?.label}
        </Badge>

        {/* Spacer pushes end-side stats and actions */}
        <div className="flex-1" />

        {/* Inline stats on the right */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
          {proj.enableTimeTracking && (
            <span className="flex items-center gap-1 font-mono tabular-nums">
              <Clock className="size-3" /><IdentifierText className="min-w-0 max-w-full">{formatHours(proj.totalHours)}</IdentifierText>
              {proj.estimatedHours > 0 && <span className="text-muted-foreground/50">/<IdentifierText className="min-w-0 max-w-full">{formatHours(proj.estimatedHours)}</IdentifierText></span>}
            </span>
          )}
          {proj.enableTasks && totalTasks > 0 && (
            <span className="flex items-center gap-1 font-mono tabular-nums">
              <CheckCircle2 className="size-3" /><IdentifierText className="min-w-0 max-w-full">{doneTasks}/{totalTasks}</IdentifierText>
            </span>
          )}
          {proj.enableBilling && proj.budget > 0 && (
            <span className="font-mono tabular-nums"><IdentifierText className="min-w-0 max-w-full">{formatMoney(proj.totalBilled)}/{formatMoney(proj.budget)}</IdentifierText></span>
          )}
          {proj.members.length > 0 && (
            <span className="flex items-center gap-1"><Users className="size-3" />{proj.members.length}</span>
          )}
          {daysLeft !== null && (
            <span className={cn("font-medium", daysLeft < 0 ? "text-red-600" : daysLeft <= 7 ? "text-amber-600" : "")}>
              {daysLeft > 0 ? t("daysLeft", { days: daysLeft }) : daysLeft === 0 ? t("today") : t("daysLate", { days: Math.abs(daysLeft) })}
            </span>
          )}
        </div>

        {proj.contact && (
          <span className="text-[11px] text-muted-foreground shrink-0 hidden lg:block border-s ps-3 ms-1"><BidiText className="min-w-0 max-w-full">{proj.contact.name}</BidiText></span>
        )}

        {proj.enableBilling && proj.contactId && (
          <Button size="sm" variant="outline" className="h-auto text-xs shrink-0 min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={handleGenerateInvoice}>
            <Receipt className="me-1 size-3" />{t("invoice")}
          </Button>
        )}
      </div>

      {/* ── Gradient divider ── */}
      <div className="h-px mb-3" style={{ background: `linear-gradient(to right, ${proj.color}30, transparent)` }} />

      {/* ── Tabs ── */}
      <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium transition-colors whitespace-normal shrink-0",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              {"count" in tab && (tab.count as number) > 0 && (
                <span className="size-4 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center ms-0.5">{tab.count as number}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <BlurReveal key={pathname}>
        {children}
      </BlurReveal>
    </div>
  );
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <ProjectLayoutInner>{children}</ProjectLayoutInner>
    </ProjectProvider>
  );
}
