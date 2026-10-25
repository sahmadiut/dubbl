"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { usePresentation } from "@/i18n/provider";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ChevronsUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reportResultJson, reportResultMoney, consolidationReportUi, consolidationReportExport, type ConsolidationReportUi } from "@/lib/money/report-result-ui";
import { cn } from "@/lib/utils";

interface UserOrg {
  id: string;
  name: string;
  slug: string;
  country: string | null;
}

interface ConsolidationGroupMember {
  id: string;
  orgId: string;
  label: string | null;
  organization: { id: string; name: string };
}

interface ConsolidationGroup {
  id: string;
  name: string;
  parentOrgId: string;
  members: ConsolidationGroupMember[];
  createdAt: string;
}

type ConsolidatedReport = ConsolidationReportUi;
type AccountRow = ConsolidatedReport["consolidatedPnL"]["accounts"][number];

function getOrgId() {
  return typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
}

function apiFetch(url: string, options: RequestInit = {}) {
  const orgId = getOrgId();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "x-organization-id": orgId } : {}),
      ...options.headers,
    },
  });
}

export default function ConsolidationPage() {
  const presentation = usePresentation();
  const t = useTranslations("ConsolidationReports");
  const now = new Date();
  const [initialLoad, setInitialLoad] = useState(true);
  const [, setLoading] = useState(true);
  const [groups, setGroups] = useState<ConsolidationGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [report, setReport] = useState<ConsolidatedReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportRequest = useRef({ id: 0 });
  const [reportLoading, setReportLoading] = useState(false);
  const [tab, setTab] = useState<"pnl" | "balance-sheet">("pnl");

  const [newGroupName, setNewGroupName] = useState("");
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([]);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));

  const activeOrgId = getOrgId();

  useEffect(() => {
    fetch("/api/v1/organization")
      .then((r) => r.json())
      .then((data) => {
        if (data.organizations) {
          setUserOrgs(data.organizations);
        }
      })
      .catch(() => {});
  }, []);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/consolidation/groups");
      const data = await res.json();
      setGroups(data.groups || []);
      setSelectedGroupId((prev) => {
        if (!prev && data.groups?.length > 0) return data.groups[0].id;
        return prev;
      });
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (!selectedGroupId) return;
    const requestId = ++reportRequest.current.id;
    setReport(null);
    setReportError(null);
    setReportLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await apiFetch(`/api/v1/consolidation/groups/${selectedGroupId}/report?${params}`);
      const data = await reportResultJson(res, consolidationReportUi);
      if (requestId === reportRequest.current.id) setReport(data);
    } catch {
      if (requestId === reportRequest.current.id) {
        setReport(null);
        setReportError(t("reportError"));
      }
    } finally {
      if (requestId === reportRequest.current.id) setReportLoading(false);
    }
  }, [selectedGroupId, startDate, endDate, t]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroupId) fetchReport();
    const requests = reportRequest.current;
    return () => { requests.id++; };
  }, [selectedGroupId, fetchReport]);

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const res = await apiFetch("/api/v1/consolidation/groups", {
      method: "POST",
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    const data = await res.json();
    if (data.group) {
      setGroups((prev) => [{ ...data.group, members: [] }, ...prev]);
      setSelectedGroupId(data.group.id);
      setNewGroupName("");
    }
  };

  const deleteGroup = async (groupId: string) => {
    await apiFetch(`/api/v1/consolidation/groups/${groupId}`, { method: "DELETE" });
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (selectedGroupId === groupId) {
      setSelectedGroupId(groups.find((g) => g.id !== groupId)?.id || null);
      setReport(null);
    }
  };

  const addMember = async (orgId: string, label: string) => {
    if (!selectedGroupId || !orgId) return;
    const res = await apiFetch(`/api/v1/consolidation/groups/${selectedGroupId}/members`, {
      method: "POST",
      body: JSON.stringify({ orgId, label: label || undefined }),
    });
    if (res.ok) {
      await fetchGroups();
      await fetchReport();
    }
  };

  const removeMember = async (orgId: string) => {
    if (!selectedGroupId) return;
    await apiFetch(`/api/v1/consolidation/groups/${selectedGroupId}/members`, {
      method: "DELETE",
      body: JSON.stringify({ orgId }),
    });
    await fetchGroups();
    await fetchReport();
  };

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const pnl = report?.consolidatedPnL;
  const bs = report?.consolidatedBalanceSheet;

  // Filter out orgs that are already members or the active (parent) org
  const availableOrgs = useMemo(() => {
    const memberOrgIds = new Set(selectedGroup?.members.map((m) => m.orgId) || []);
    return userOrgs.filter(
      (o) => o.id !== activeOrgId && !memberOrgIds.has(o.id)
    );
  }, [userOrgs, activeOrgId, selectedGroup?.members]);

  // Raw-unit CSV columns retain currency and uniquely identify each entity.
  const reportExport = useMemo(() => report ? consolidationReportExport(report, tab) : { data: [], columns: [] }, [report, tab]);

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      <Link href="/reports" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3.5 [&:dir(rtl)]:rotate-180" /> {t("back")}
      </Link>

      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        {report && reportExport.data.length > 0 && (
          <ExportButton
            data={reportExport.data}
            columns={reportExport.columns}
            filename={`consolidation-${tab}`}
          />
        )}
      </PageHeader>

      {/* Group Management */}
      <div className="rounded-xl border border-border/50 bg-card/80 p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">{t("groups")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("groupsHelp")}
          </p>
        </div>

        {/* Create group */}
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={t("newGroup")} name="newGroupName" dir="auto"
            placeholder={t("newGroup")}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createGroup()}
            className="max-w-xs"
          />
          <Button className="h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={createGroup} size="sm" disabled={!newGroupName.trim()}>
            <Plus className="size-4 me-1" />
            {t("create")}
          </Button>
        </div>

        {/* Group selector */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  selectedGroupId === g.id
                    ? "border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-border/50 hover:border-border"
                )}
              >
                <button type="button" aria-pressed={selectedGroupId === g.id} onClick={() => setSelectedGroupId(g.id)} className="flex min-w-0 flex-wrap items-center gap-2 text-start [overflow-wrap:anywhere]">
                  <Building2 className="size-4 shrink-0" />
                  <BidiText>{g.name}</BidiText>
                  <Badge variant="secondary" className="text-xs"><IdentifierText>{g.members.length}</IdentifierText></Badge>
                </button>
                <button
                  aria-label={t("deleteGroup", { name: g.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteGroup(g.id);
                  }}
                  className="ms-1 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="size-3 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("emptyGroups")}
          </p>
        )}
      </div>

      {/* Member Management */}
      {selectedGroup && (
        <div className="rounded-xl border border-border/50 bg-card/80 p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold">
            {t.rich("members", { name: selectedGroup.name, code: (chunks) => <BidiText>{chunks}</BidiText> })}
          </h2>

          {/* Add member - org picker */}
          {availableOrgs.length > 0 ? (
            <Popover open={orgPickerOpen} onOpenChange={setOrgPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere]">
                  <Plus className="size-4" />
                  {t("addBusiness")}
                  <ChevronsUpDown className="size-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("search")} />
                  <CommandList>
                    <CommandEmpty>{t("notFound")}</CommandEmpty>
                    <CommandGroup>
                      {availableOrgs.map((org) => (
                        <CommandItem
                          key={org.id}
                          value={`${org.name} ${org.slug}`}
                          onSelect={() => {
                            addMember(org.id, org.name);
                            setOrgPickerOpen(false);
                          }}
                        >
                          <Building2 className="size-4 me-2 shrink-0 text-muted-foreground" />
                          <div className="flex flex-col min-w-0">
                            <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere] text-sm"><BidiText>{org.name}</BidiText></span>
                            <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere] text-xs text-muted-foreground"><IdentifierText>
                              {org.slug}{org.country ? ` · ${org.country}` : ""}
                            </IdentifierText></span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <p className="text-xs text-muted-foreground">
              {userOrgs.length <= 1
                ? t("oneOrg")
                : t("allAdded")}
            </p>
          )}

          {/* Member list */}
          {selectedGroup.members.length > 0 ? (
            <div className="divide-y divide-border/50 rounded-lg border border-border/50">
              {selectedGroup.members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Building2 className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium"><BidiText>{m.organization.name}</BidiText></p>
                      {m.label && (
                        <p className="text-xs text-muted-foreground"><BidiText>{m.label}</BidiText></p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("removeMember", { name: m.organization.name })}
                    onClick={() => removeMember(m.orgId)}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("emptyMembers")}
            </p>
          )}
        </div>
      )}

      {/* Report Section */}
      {selectedGroup && selectedGroup.members.length > 0 && (
        <>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />

          {/* Tab Switcher */}
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
            <button
              onClick={() => setTab("pnl")}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                tab === "pnl"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("pnl")}
            </button>
            <button
              onClick={() => setTab("balance-sheet")}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                tab === "balance-sheet"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("balanceSheet")}
            </button>
          </div>

          {reportError && <p role="alert" className="text-sm text-destructive"><BidiText>{reportError}</BidiText></p>}
          {reportLoading ? (
            <BrandLoader className="h-48" />
          ) : (
            <ContentReveal>
              {/* P&L Tab */}
              {tab === "pnl" && pnl && (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title={t("totalRevenue")} value={reportResultMoney(pnl.totalRevenue, report!.presentationCurrency, presentation)} icon={TrendingUp} changeType="positive" />
                    <StatCard title={t("totalExpenses")} value={reportResultMoney(pnl.totalExpenses, report!.presentationCurrency, presentation)} icon={TrendingDown} changeType="negative" />
                    <StatCard
                      title={t("netIncome")}
                      value={reportResultMoney(pnl.netIncome, report!.presentationCurrency, presentation)}
                      icon={DollarSign}
                      changeType={pnl.netIncome >= 0 ? "positive" : "negative"}
                    />
                  </div>

                  {/* Per Entity Summary */}
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3">
                      <h3 className="text-sm font-semibold">{t("eachBusiness")}</h3>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="px-4">{t("business")}</TableHead>
                          <TableHead className="px-4 text-end">{t("revenue")}</TableHead>
                          <TableHead className="px-4 text-end">{t("expenses")}</TableHead>
                          <TableHead className="px-4 text-end">{t("netIncome")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pnl.byEntity.map((e) => (
                          <TableRow key={e.orgId} className="border-border/30">
                            <TableCell className="px-4 py-3 font-medium"><BidiText>{e.label}</BidiText></TableCell>
                            <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(e.revenue, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                            <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(e.expenses, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                            <TableCell className={cn("px-4 py-3 text-end font-mono tabular-nums", e.netIncome >= 0 ? "text-emerald-600" : "text-red-600")}><IdentifierText>
                              {reportResultMoney(e.netIncome, report!.presentationCurrency, presentation)}
                            </IdentifierText></TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="px-4 py-3">{t("total")}</TableCell>
                          <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(pnl.totalRevenue, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                          <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(pnl.totalExpenses, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                          <TableCell className={cn("px-4 py-3 text-end font-mono tabular-nums", pnl.netIncome >= 0 ? "text-emerald-600" : "text-red-600")}><IdentifierText>
                            {reportResultMoney(pnl.netIncome, report!.presentationCurrency, presentation)}
                          </IdentifierText></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Account Detail */}
                  <AccountDetailTable
                    title={t("accountBreakdown")}
                    currencyCode={report!.presentationCurrency}
                    accounts={pnl.accounts}
                    members={report!.members}
                  />
                </div>
              )}

              {/* Balance Sheet Tab */}
              {tab === "balance-sheet" && bs && (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title={t("totalAssets")} value={reportResultMoney(bs.totalAssets, report!.presentationCurrency, presentation)} icon={TrendingUp} changeType="positive" />
                    <StatCard title={t("totalLiabilities")} value={reportResultMoney(bs.totalLiabilities, report!.presentationCurrency, presentation)} icon={TrendingDown} changeType="negative" />
                    <StatCard title={t("totalEquity")} value={reportResultMoney(bs.totalEquity, report!.presentationCurrency, presentation)} icon={DollarSign} changeType="positive" />
                  </div>

                  {/* Per Entity Summary */}
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3">
                      <h3 className="text-sm font-semibold">{t("eachBusiness")}</h3>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="px-4">{t("business")}</TableHead>
                          <TableHead className="px-4 text-end">{t("assets")}</TableHead>
                          <TableHead className="px-4 text-end">{t("liabilities")}</TableHead>
                          <TableHead className="px-4 text-end">{t("equity")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bs.byEntity.map((e) => (
                          <TableRow key={e.orgId} className="border-border/30">
                            <TableCell className="px-4 py-3 font-medium"><BidiText>{e.label}</BidiText></TableCell>
                            <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(e.assets, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                            <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(e.liabilities, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                            <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(e.equity, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell className="px-4 py-3">{t("total")}</TableCell>
                          <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(bs.totalAssets, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                          <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(bs.totalLiabilities, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                          <TableCell className="px-4 py-3 text-end font-mono tabular-nums"><IdentifierText>{reportResultMoney(bs.totalEquity, report!.presentationCurrency, presentation)}</IdentifierText></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Account Detail */}
                  <AccountDetailTable
                    title={t("accountBreakdown")}
                    currencyCode={report!.presentationCurrency}
                    accounts={bs.accounts}
                    members={report!.members}
                  />
                </div>
              )}
            </ContentReveal>
          )}
        </>
      )}
    </ContentReveal>
  );
}

function AccountDetailTable({
  title,
  accounts,
  currencyCode,
  members,
}: {
  title: string;
  accounts: AccountRow[];
  currencyCode: string;
  members: { orgId: string; label: string; orgName: string }[];
}) {
  const t = useTranslations("ConsolidationReports");
  if (accounts.length === 0) return null;

  // Group by type
  const grouped = new Map<string, AccountRow[]>();
  for (const a of accounts) {
    const existing = grouped.get(a.type) || [];
    existing.push(a);
    grouped.set(a.type, existing);
  }

  const typeLabels: Record<string, string> = {
    revenue: t("revenue"),
    expense: t("expenses"),
    asset: t("assets"),
    liability: t("liabilities"),
    equity: t("equity"),
  };

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-semibold"><BidiText>{title}</BidiText></h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border/50">
            <TableHead className="px-4">{t("account")}</TableHead>
            {members.map((m) => (
              <TableHead key={m.orgId} className="px-4 text-end"><BidiText>
                {m.label}
              </BidiText></TableHead>
            ))}
            <TableHead className="px-4 text-end">{t("total")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from(grouped.entries()).map(([type, typeAccounts]) => (
            <GroupSection key={type} type={type} label={typeLabels[type] || type} accounts={typeAccounts} members={members} currencyCode={currencyCode} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupSection({
  label,
  accounts,
  currencyCode,
  members,
}: {
  type: string;
  label: string;
  accounts: AccountRow[];
  currencyCode: string;
  members: { orgId: string; label: string; orgName: string }[];
}) {
  const presentation = usePresentation();
  const t = useTranslations("ConsolidationReports");
  const groupTotal = accounts.reduce((sum, a) => sum + a.total, 0n);
  const entityTotals: Record<string, bigint> = {};
  for (const m of members) {
    entityTotals[m.orgId] = accounts.reduce((sum, a) => sum + (a.byEntity[m.orgId] ?? 0n), 0n);
  }

  return (
    <>
      <TableRow className="bg-muted/20 hover:bg-muted/20">
        <TableCell colSpan={members.length + 2} className="px-4 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground"><BidiText>
          {label}
        </BidiText></TableCell>
      </TableRow>
      {accounts.map((a) => (
        <TableRow key={`${a.type}:${a.code}`} className="border-border/20">
          <TableCell className="px-4 py-2.5">
            <span className="font-mono text-xs text-muted-foreground me-2"><IdentifierText>{a.code}</IdentifierText></span>
            <BidiText>{a.name}</BidiText>
          </TableCell>
          {members.map((m) => (
            <TableCell key={m.orgId} className="px-4 py-2.5 text-end font-mono tabular-nums"><IdentifierText>
              {reportResultMoney(a.byEntity[m.orgId] ?? 0n, currencyCode, presentation)}
            </IdentifierText></TableCell>
          ))}
          <TableCell className="px-4 py-2.5 text-end font-mono tabular-nums font-medium"><IdentifierText>
            {reportResultMoney(a.total, currencyCode, presentation)}
          </IdentifierText></TableCell>
        </TableRow>
      ))}
      <TableRow className="border-border/50 bg-muted/10 hover:bg-muted/10">
        <TableCell className="px-4 py-2 font-semibold text-sm">{t("totalLabel", { label })}</TableCell>
        {members.map((m) => (
          <TableCell key={m.orgId} className="px-4 py-2 text-end font-mono tabular-nums font-semibold"><IdentifierText>
            {reportResultMoney(entityTotals[m.orgId] ?? 0n, currencyCode, presentation)}
          </IdentifierText></TableCell>
        ))}
        <TableCell className="px-4 py-2 text-end font-mono tabular-nums font-semibold"><IdentifierText>
          {reportResultMoney(groupTotal, currencyCode, presentation)}
        </IdentifierText></TableCell>
      </TableRow>
    </>
  );
}
