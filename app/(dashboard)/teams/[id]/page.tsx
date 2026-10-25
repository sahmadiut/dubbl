"use client";

import { BidiText, IdentifierText } from "@/components/ui/bidi-text";

import { workspaceErrorMessage } from "@/i18n/workspace-errors";
import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  Trash2,
  ArrowLeft,
  Mail,
  UserPlus,
  Pencil,
  Loader2,
  Search,
} from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamFields } from "@/components/dashboard/team-fields";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import { cn } from "@/lib/utils";
import { useConfirm } from "@/lib/hooks/use-confirm";

interface RawTeamMember {
  id: string;
  memberId: string;
  member?: {
    id: string;
    user?: { name?: string | null; email?: string | null };
    userName?: string;
    userEmail?: string;
  };
  name?: string;
  email?: string;
}

interface TeamMember {
  id: string;
  memberId: string;
  name: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  members: TeamMember[];
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
}

function getInitials(name: string | undefined | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function normalizeMembers(raw: RawTeamMember[]): TeamMember[] {
  return raw.map((m) => ({
    id: m.id,
    memberId: m.memberId || m.member?.id || m.id,
    name: m.member?.user?.name || m.member?.userName || m.name || "",
    email: m.member?.user?.email || m.member?.userEmail || m.email || "",
  }));
}

export default function TeamDetailPage() {
  const t = useTranslations("Teams");
  const errors = useTranslations("WorkspaceErrors");

  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [editSaving, setEditSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const debouncedSearch = useDebounce(memberSearch);
  const [visibleCount, setVisibleCount] = useState(20);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const fetchTeam = useCallback(() => {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    fetch(`/api/v1/teams/${teamId}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        const t = data.team || data.data || data;
        setTeam({
          ...t,
          members: normalizeMembers(t.members || []),
        });
      })
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const membersFetchedRef = useRef(false);

  useEffect(() => {
    if (!popoverOpen || membersFetchedRef.current) return;
    membersFetchedRef.current = true;

    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setLoadingMembers(true);

    fetch("/api/v1/members?limit=500", {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        const members = data.members || data.data || [];
        setOrgMembers(
          members.map(
            (m: {
              id: string;
              userName?: string;
              userEmail?: string;
              name?: string;
              email?: string;
              user?: { name?: string; email?: string };
            }) => ({
              id: m.id,
              name: m.userName || m.user?.name || m.name || "",
              email: m.userEmail || m.user?.email || m.email || "",
            })
          )
        );
      })
      .finally(() => setLoadingMembers(false));
  }, [popoverOpen]);

  function openEdit() {
    if (!team) return;
    setEditName(team.name);
    setEditDesc(team.description || "");
    setEditColor(team.color || "#3b82f6");
    setEditOpen(true);
  }

  async function handleEdit() {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId || !editName.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/v1/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          color: editColor,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("teamUpdated"));
      setEditOpen(false);
      fetchTeam();
    } catch {
      toast.error(t("failedToUpdateTeam"));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddMember(memberId: string) {
    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setAddingMemberId(memberId);

    try {
      const res = await fetch(`/api/v1/teams/${teamId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({ memberId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(workspaceErrorMessage(errors, err.error, t("failedToAddMember"), res.status));
        return;
      }

      toast.success(t("memberAdded"));
      setPopoverOpen(false);
      membersFetchedRef.current = false;
      fetchTeam();
    } catch (e: unknown) {
      toast.error(workspaceErrorMessage(errors, e instanceof Error ? e.message : undefined, t("failedToAddMember")));
    } finally {
      setAddingMemberId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    const confirmed = await confirm({
      title: t("removeTeamMember"),
      description: t("theyWillLoseAccessToThisTeamSResources"),
      confirmLabel: t("remove"),
      destructive: true,
    });
    if (!confirmed) return;

    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;
    setRemovingMemberId(memberId);

    try {
      const res = await fetch(
        `/api/v1/teams/${teamId}/members?memberId=${memberId}`,
        {
          method: "DELETE",
          headers: { "x-organization-id": orgId },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(workspaceErrorMessage(errors, err.error, t("failedToRemoveMember"), res.status));
        return;
      }

      toast.success(t("memberRemoved"));
      membersFetchedRef.current = false;
      fetchTeam();
    } catch (e: unknown) {
      toast.error(workspaceErrorMessage(errors, e instanceof Error ? e.message : undefined, t("failedToRemoveMember")));
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleDeleteTeam() {
    const confirmed = await confirm({
      title: t("deleteThisTeam"),
      description:
        t("thisWillPermanentlyDeleteTheTeamAndRemoveAllMemberAssignments"),
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (!confirmed) return;

    const orgId = localStorage.getItem("activeOrgId");
    if (!orgId) return;

    try {
      const res = await fetch(`/api/v1/teams/${teamId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("teamDeleted"));
      router.push("/teams");
    } catch {
      toast.error(t("failedToDeleteTeam"));
    }
  }

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(20);
  }, [debouncedSearch]);

  const filteredMembers = useMemo(() => {
    if (!team) return [];
    if (!debouncedSearch.trim()) return team.members;
    const q = debouncedSearch.toLowerCase();
    return team.members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [team, debouncedSearch]);

  const visibleMembers = useMemo(
    () => filteredMembers.slice(0, visibleCount),
    [filteredMembers, visibleCount]
  );

  const hasMore = visibleCount < filteredMembers.length;

  if (loading) return <BrandLoader />;

  if (!team) {
    return (
      <ContentReveal className="space-y-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium">{t("teamNotFound")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
            onClick={() => router.push("/teams")}
          >
            <ArrowLeft className="me-2 size-3.5 rtl:rotate-180" />
            {t("backToTeams")}
          </Button>
        </div>
      </ContentReveal>
    );
  }

  const teamColor = team.color || "#6b7280";
  const teamMemberIds = new Set(team.members.map((m) => m.memberId));
  const availableMembers = orgMembers.filter(
    (m) => !teamMemberIds.has(m.id)
  );

  return (
    <ContentReveal className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 mt-0.5"
            onClick={() => router.push("/teams")}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className="size-3.5 rounded-full shrink-0 ring-2 ring-background"
                style={{ backgroundColor: teamColor }}
              />
              <h1 className="text-lg font-semibold min-w-0 whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{team.name}</BidiText></h1>
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
              >
                {t("memberCount", { count: team.members.length })}
              </Badge>
            </div>
            {team.description && (
              <p className="mt-1 text-sm text-muted-foreground ms-6">
                <BidiText className="min-w-0 max-w-full">{team.description}</BidiText>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-8 text-xs gap-1.5 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
            onClick={openEdit}
          >
            <Pencil className="size-3" />
            {t("edit")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-8 text-xs gap-1.5 text-destructive hover:text-destructive whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
            onClick={handleDeleteTeam}
          >
            <Trash2 className="size-3" />
            {t("delete")}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">
              {t("members")}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums">
            {team.members.length}
          </p>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: `${teamColor}33`,
            backgroundColor: `${teamColor}08`,
          }}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: teamColor }}
            />
            <span className="text-[11px] font-medium uppercase tracking-wide">
              {t("teamColor")}
            </span>
          </div>
          <p className="mt-2 text-sm font-mono font-medium"><IdentifierText className="min-w-0 max-w-full">{teamColor}</IdentifierText></p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">
              {t("contacts")}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums">
            <IdentifierText className="min-w-0 max-w-full">{team.members.filter((m) => m.email).length}</IdentifierText>
          </p>
        </div>
      </div>

      {/* Members section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("teamMembers")}{" "}
            {debouncedSearch && t("filteredCount", { count: filteredMembers.length, total: team.members.length })}
          </p>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                className="h-auto min-h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
              >
                <UserPlus className="size-3" />
                {t("addMember")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command shouldFilter={!loadingMembers}>
                <CommandInput placeholder={t("searchMembers")} />
                <CommandList>
                  {loadingMembers ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>
                        <div className="flex flex-col items-center gap-1.5 py-2">
                          <Users className="size-4 text-muted-foreground" />
                          <span className="text-muted-foreground text-sm">
                            {t("noAvailableMembers")}
                          </span>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {availableMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.name} ${member.email}`}
                            disabled={addingMemberId === member.id}
                            onSelect={() => handleAddMember(member.id)}
                            className="gap-2.5 py-2"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                              <BidiText className="min-w-0 max-w-full">{getInitials(member.name)}</BidiText>
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                                <BidiText className="min-w-0 max-w-full">{member.name || t("unnamed")}</BidiText>
                              </span>
                              {member.email && (
                                <span className="text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                                  <IdentifierText className="min-w-0 max-w-full">{member.email}</IdentifierText>
                                </span>
                              )}
                            </div>
                            {addingMemberId === member.id && (
                              <Loader2 className="ms-auto size-3.5 animate-spin text-muted-foreground shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {team.members.length > 5 && (
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input aria-label={t("searchMembersByNameOrEmail")} dir="auto"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={t("searchMembersByNameOrEmail")}
              className="ps-9 h-9 text-sm"
            />
          </div>
        )}

        {team.members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">{t("noMembersYet")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("addMembersToThisTeamToGetStarted")}
            </p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 text-center">
            <Search className="size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">{t("noMembersMatchYourSearch")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("tryADifferentNameOrEmailAddress")}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border overflow-hidden">
              {visibleMembers.map((member, i) => (
                <div
                  key={member.id}
                  className={cn(
                    "group flex flex-wrap items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/20",
                    i < visibleMembers.length - 1 && "border-b"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: teamColor }}
                    >
                      <BidiText className="min-w-0 max-w-full">{getInitials(member.name)}</BidiText>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                        <BidiText className="min-w-0 max-w-full">{member.name || t("unnamed")}</BidiText>
                      </p>
                      {member.email && (
                        <p className="text-xs text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                          <IdentifierText className="min-w-0 max-w-full">{member.email}</IdentifierText>
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={removingMemberId === member.memberId}
                    onClick={() => handleRemoveMember(member.memberId)}
                    aria-label={t("removeMember")}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                  onClick={() => setVisibleCount((c) => c + 20)}
                >
                  {t("showMore", { count: filteredMembers.length - visibleCount })}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("editTeam")}</SheetTitle>
          </SheetHeader>
          <TeamFields name={editName} description={editDesc} color={editColor} editing
            onNameChange={setEditName} onDescriptionChange={setEditDesc} onColorChange={setEditColor} />
          <SheetFooter className="h-auto flex-wrap">
            <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" variant="outline" onClick={() => setEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleEdit}
              disabled={editSaving || !editName.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
            >
              {editSaving ? t("saving") : t("saveChanges")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </ContentReveal>
  );
}
