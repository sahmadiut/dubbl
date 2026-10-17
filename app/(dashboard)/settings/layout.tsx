"use client";

import { useTranslations } from "next-intl";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings, Users, CreditCard, Key, ScrollText, Target,
  Bell, BellRing, GitBranch, Tags, Shield, ShieldCheck,
  ListFilter, Webhook, CheckCircle2, Zap, PaintbrushVertical, ArrowLeftRight,
  Trash2, Database, PackageCheck,
} from "lucide-react";
import { BlurReveal } from "@/components/ui/blur-reveal";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const st = useTranslations("SettingsNavigation");
  const GROUPS: NavGroup[] = [
    {
      label: st("organization"),
      items: [
        { href: "/settings", label: st("general"), icon: Settings, exact: true },
        { href: "/settings/members", label: st("members"), icon: Users },
        { href: "/settings/roles", label: st("roles"), icon: ShieldCheck },
        { href: "/settings/billing", label: st("billing"), icon: CreditCard },
        { href: "/settings/advisors", label: st("advisors"), icon: Shield },
        { href: "/settings/document-templates", label: st("templates"), icon: PaintbrushVertical },
        { href: "/settings/import-export", label: st("importExport"), icon: ArrowLeftRight },
        { href: "/settings/trash", label: st("trash"), icon: Trash2 },
        { href: "/settings/backups", label: st("backups"), icon: Database },
      ],
    },
    {
      label: st("automation"),
      items: [
        { href: "/settings/pipelines", label: st("pipelines"), icon: Target },
        { href: "/settings/bank-rules", label: st("bankRules"), icon: ListFilter },
        { href: "/settings/approval-workflows", label: st("approvals"), icon: CheckCircle2 },
        { href: "/settings/procurement", label: st("billMatching"), icon: PackageCheck },
        { href: "/settings/webhooks", label: st("webhooks"), icon: Webhook },
      ],
    },
    {
      label: st("integrations"),
      items: [
        { href: "/settings/integrations/stripe", label: st("stripe"), icon: Zap },
      ],
    },
    {
      label: st("preferences"),
      items: [
        { href: "/settings/notifications", label: st("notifications"), icon: BellRing },
        { href: "/settings/reminders", label: st("reminders"), icon: Bell },
        { href: "/settings/cost-centers", label: st("costCenters"), icon: GitBranch },
        { href: "/settings/tags", label: st("tags"), icon: Tags },
      ],
    },
    {
      label: st("developer"),
      items: [
        { href: "/settings/api-keys", label: st("apiKeys"), icon: Key },
        { href: "/settings/audit-log", label: st("auditLog"), icon: ScrollText },
      ],
    },
  ];

  const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

  const pathname = usePathname();

  const isDetailPage =
    !ALL_ITEMS.some((t) => (t.exact ? pathname === t.href : pathname === t.href)) &&
    ALL_ITEMS.some((t) => pathname.startsWith(t.href + "/"));

  let blurKey = pathname;
  if (isDetailPage) {
    const matched = ALL_ITEMS.find((t) => pathname.startsWith(t.href + "/"));
    if (matched) {
      const rest = pathname.slice(matched.href.length + 1);
      blurKey = `${matched.href}/${rest.split("/")[0]}`;
    }
  }

  return (
    <div className="flex gap-8">
      {!isDetailPage && (
        <nav className="hidden md:flex w-52 shrink-0 flex-col gap-6 -mt-1">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 pl-0 pr-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md pl-0 pr-2 py-1.5 text-[13px] font-medium transition-colors",
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      )}

      {/* Mobile: horizontal scrolling tabs */}
      {!isDetailPage && (
        <nav className="md:hidden fixed left-0 right-0 z-10 -mt-2 mb-6 flex items-center gap-1 overflow-x-auto border-b border-border bg-background px-4 scrollbar-none">
          {ALL_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="min-w-0 flex-1">
        <BlurReveal key={blurKey}>{children}</BlurReveal>
      </div>
    </div>
  );
}
