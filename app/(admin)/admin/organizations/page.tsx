"use client";

import { adminPlanLabel } from "@/i18n/admin-labels";
import { currencyLabel } from "@/i18n/currency-labels";
import { usePresentation } from "@/i18n/provider";
import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Users, ChevronRight, ArrowUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface Org {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  country: string | null;
  businessType: string | null;
  defaultCurrency: string;
  createdAt: string;
  deletedAt: string | null;
  memberCount: number;
  plan: string;
  subscriptionStatus: string | null;
  customPlanName: string | null;
  managedBy: string | null;
  seatCount: number | null;
}

const PLAN_BADGE: Record<string, string> = {
  free: "text-zinc-600 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800/50",
  pro: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/50",
};

type SortKey = "name" | "created" | "members";

export default function AdminOrganizationsPage() {
  const presentation = usePresentation();
  const t = useTranslations("Admin");

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [managedFilter, setManagedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);
  const debouncedSearch = useDebounce(search, 200);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/organizations");
      const data = await res.json();
      setOrgs(data.organizations || []);
    } catch {
      toast.error(t("failedToLoadOrganizations"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const hasFilters = planFilter !== "all" || statusFilter !== "all" || managedFilter !== "all" || debouncedSearch !== "";

  const filtered = useMemo(() => {
    let result = orgs;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
      );
    }

    if (planFilter !== "all") {
      result = result.filter((o) => o.plan === planFilter);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "deleted") {
        result = result.filter((o) => o.deletedAt);
      } else {
        result = result.filter((o) => !o.deletedAt && (o.subscriptionStatus || "active") === statusFilter);
      }
    }

    if (managedFilter !== "all") {
      result = result.filter((o) => (o.managedBy || "stripe") === managedFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "members") cmp = a.memberCount - b.memberCount;
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [orgs, debouncedSearch, planFilter, statusFilter, managedFilter, sortBy, sortAsc]);

  const clearFilters = () => {
    setSearch("");
    setPlanFilter("all");
    setStatusFilter("all");
    setManagedFilter("all");
    setSortBy("created");
    setSortAsc(false);
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t("organizations")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("allOrganizationsOnThePlatform")}
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("searchNameOrSlug")}
            className="w-56"
          />
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue placeholder={t("plan")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allPlans")}</SelectItem>
              <SelectItem value="free">{t("free")}</SelectItem>
              <SelectItem value="pro">{t("pro")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder={t("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatus")}</SelectItem>
              <SelectItem value="active">{t("active")}</SelectItem>
              <SelectItem value="trialing">{t("trialing")}</SelectItem>
              <SelectItem value="past_due">{t("pastDue")}</SelectItem>
              <SelectItem value="canceled">{t("canceled")}</SelectItem>
              <SelectItem value="deleted">{t("deleted")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={managedFilter} onValueChange={setManagedFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder={t("billing")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allBilling")}</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="manual">{t("manual")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortBy}-${sortAsc ? "asc" : "desc"}`} onValueChange={(v) => {
            const [key, dir] = v.split("-") as [SortKey, string];
            setSortBy(key);
            setSortAsc(dir === "asc");
          }}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <ArrowUpDown className="size-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created-desc">{t("newestFirst")}</SelectItem>
              <SelectItem value="created-asc">{t("oldestFirst")}</SelectItem>
              <SelectItem value="name-asc">{t("nameAZ")}</SelectItem>
              <SelectItem value="name-desc">{t("nameZA")}</SelectItem>
              <SelectItem value="members-desc">{t("mostMembers")}</SelectItem>
              <SelectItem value="members-asc">{t("fewestMembers")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
              <X className="size-3" />
              {t("clear")}
            </Button>
          )}
          {!loading && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {t("filteredCount", { count: filtered.length, total: orgs.length })}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {filtered.map((o) => {
              const displayPlan = o.customPlanName || adminPlanLabel(t, o.plan);
              const isEnterprise = o.managedBy === "manual";
              return (
                <Link
                  key={o.id}
                  href={`/admin/organizations/${o.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                    {o.logo ? (
                      <Image src={o.logo} alt="" width={36} height={36} className="size-9 rounded-lg object-cover" />
                    ) : (
                      <Building2 className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{o.name}</p>
                      {o.deletedAt && (
                        <Badge variant="outline" className="text-[10px] text-red-500">{t("deleted")}</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.slug} · <bdi>{currencyLabel(o.defaultCurrency, presentation.locale)}</bdi>
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {o.memberCount}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[11px] capitalize ${isEnterprise ? "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/50" : PLAN_BADGE[o.plan] || ""}`}
                  >
                    {isEnterprise ? displayPlan : adminPlanLabel(t, o.plan)}
                  </Badge>
                  <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
                </Link>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("noOrganizationsFound")}
              </div>
            )}
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
