"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShieldCheck,
  User,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Building2,
  ArrowUpDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface PlatformUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isSiteAdmin: boolean;
  createdAt: string;
  orgCount: number;
}

type SortKey = "name" | "email" | "created" | "orgs";

export default function AdminUsersPage() {
  const t = useTranslations("Admin");

  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);
  const debouncedSearch = useDebounce(search, 200);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/users");
      const data = await res.json();
      setPlatformUsers(data.users || []);
    } catch {
      toast.error(t("failedToLoadUsers"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleAdmin = async (userId: string, current: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSiteAdmin: !current }),
      });
      if (!res.ok) throw new Error();
      setPlatformUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isSiteAdmin: !current } : u))
      );
      toast.success(!current ? t("grantedAdminAccess") : t("revokedAdminAccess"));
    } catch {
      toast.error(t("failedToUpdateUser"));
    }
  };

  const hasFilters = roleFilter !== "all" || debouncedSearch !== "";

  const filtered = useMemo(() => {
    let result = platformUsers;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    if (roleFilter === "admin") {
      result = result.filter((u) => u.isSiteAdmin);
    } else if (roleFilter === "user") {
      result = result.filter((u) => !u.isSiteAdmin);
    } else if (roleFilter === "no-org") {
      result = result.filter((u) => u.orgCount === 0);
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = (a.name || a.email).localeCompare(b.name || b.email);
      else if (sortBy === "email") cmp = a.email.localeCompare(b.email);
      else if (sortBy === "orgs") cmp = a.orgCount - b.orgCount;
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [platformUsers, debouncedSearch, roleFilter, sortBy, sortAsc]);

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setSortBy("created");
    setSortAsc(false);
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t("users")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("allRegisteredUsersAcrossThePlatform")}
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("searchNameOrEmail")}
            className="w-56"
          />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder={t("role")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allUsers")}</SelectItem>
              <SelectItem value="admin">{t("adminsOnly")}</SelectItem>
              <SelectItem value="user">{t("regularUsers")}</SelectItem>
              <SelectItem value="no-org">{t("noOrganization")}</SelectItem>
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
              <SelectItem value="email-asc">{t("emailAZ")}</SelectItem>
              <SelectItem value="orgs-desc">{t("mostOrgs")}</SelectItem>
              <SelectItem value="orgs-asc">{t("fewestOrgs")}</SelectItem>
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
              {t("filteredCount", { count: filtered.length, total: platformUsers.length })}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {(u.name || u.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.name || u.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="size-3" />
                  {u.orgCount}
                </div>
                <p className="hidden md:block text-xs text-muted-foreground tabular-nums">
                  {new Date(u.createdAt).toLocaleDateString()}
                </p>
                {u.isSiteAdmin ? (
                  <Badge
                    variant="outline"
                    className="gap-1 text-[11px] text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50"
                  >
                    <ShieldCheck className="size-3" />
                    {t("admin")}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 text-[11px] text-zinc-600 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800/50"
                  >
                    <User className="size-3" />
                    {t("user")}
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleAdmin(u.id, u.isSiteAdmin)}>
                      {u.isSiteAdmin ? (
                        <>
                          <ShieldOff className="size-3.5 mr-2" />
                          {t("revokeAdmin")}
                        </>
                      ) : (
                        <>
                          <Shield className="size-3.5 mr-2" />
                          {t("grantAdmin")}
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("noUsersFound")}
              </div>
            )}
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
