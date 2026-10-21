"use client";

import { useTranslations } from "next-intl";
import {
  projectRoleKeys, projectTeamAssignmentsJson, projectOrgTeamsJson,
  projectOrgMembersJson, projectCollaborationMutationJson,
  type ProjectTeamAssignment, type ProjectOrgTeam, type ProjectOrgMember,
} from "@/i18n/project-collaboration-presentation";

import { projectCentsInput } from "@/lib/money/project-display";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Users, Loader2, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { projectMoneyDisplay } from "@/lib/money/project-display";
import { useProject } from "../project-context";

const roleColors: Record<string, string> = {
  manager: "bg-purple-50 text-purple-700 border-purple-200",
  contributor: "bg-blue-50 text-blue-700 border-blue-200",
  viewer: "bg-gray-100 text-gray-600",
};

export default function MembersPage() {
  const t = useTranslations("ProjectMembers");
  const roleLabel = (role: string) => Object.hasOwn(projectRoleKeys, role) ? t(projectRoleKeys[role as keyof typeof projectRoleKeys]) : t("unknownRole");
  const { project: proj, orgId, projectId, refresh } = useProject();
  const formatMoney = (amount: number | bigint | string) => projectMoneyDisplay(amount, proj?.currency ?? "USD");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgMembers, setOrgMembers] = useState<ProjectOrgMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("none");
  const [selectedRole, setSelectedRole] = useState("contributor");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState("");

  // Team assignments
  const [teamAssignments, setTeamAssignments] = useState<ProjectTeamAssignment[]>([]);
  const [orgTeams, setOrgTeams] = useState<ProjectOrgTeam[]>([]);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("none");
  const [selectedTeamRole, setSelectedTeamRole] = useState("contributor");
  const [savingTeam, setSavingTeam] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);

  const [readError, setReadError] = useState("");
  const [teamChoicesError, setTeamChoicesError] = useState("");
  const [memberChoicesError, setMemberChoicesError] = useState("");

  const fetchTeamAssignments = useCallback(async (active: () => boolean = () => true) => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/team-assignments`, {
        headers: { "x-organization-id": orgId },
      });
      const data = await projectTeamAssignmentsJson(res);
      if (active()) { setTeamAssignments(data.assignments); setReadError(""); }
    } catch { if (active()) setReadError("assignmentsLoadFailed"); }
  }, [orgId, projectId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) { setTeamAssignments([]); setReadError(""); void fetchTeamAssignments(() => active); }
    });
    return () => { active = false; };
  }, [fetchTeamAssignments]);

  useEffect(() => {
    if (!orgId || !addTeamOpen) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setOrgTeams([]); setTeamChoicesError("");
      return fetch("/api/v1/teams?limit=100", { headers: { "x-organization-id": orgId } })
        .then(projectOrgTeamsJson)
        .then(data => { if (active) setOrgTeams(data.data); })
        .catch(() => { if (active) setTeamChoicesError("teamsLoadFailed"); });
    });
    return () => { active = false; };
  }, [orgId, addTeamOpen]);

  async function handleAddTeam() {
    if (!orgId || selectedTeamId === "none" || savingTeam) return;
    setSavingTeam(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/team-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ teamId: selectedTeamId, defaultRole: selectedTeamRole }),
      });
      await projectCollaborationMutationJson(res, "assignment", { field: "teamId", id: selectedTeamId });
      toast.success(t("teamAssigned"));
      setAddTeamOpen(false);
      setSelectedTeamId("none");
      setSelectedTeamRole("contributor");
      fetchTeamAssignments();
    } catch { toast.error(t("assignFailed")); }
    finally { setSavingTeam(false); }
  }

  async function removeTeam(teamId: string) {
    if (!orgId || removingTeamId) return;
    setRemovingTeamId(teamId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/team-assignments?teamId=${teamId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectCollaborationMutationJson(res, "success");
      toast.success(t("teamRemoved"));
      fetchTeamAssignments();
    } catch { toast.error(t("removeTeamFailed")); }
    finally { setRemovingTeamId(null); }
  }

  useEffect(() => {
    if (!orgId || !addOpen) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setOrgMembers([]); setMemberChoicesError("");
      return fetch("/api/v1/members", { headers: { "x-organization-id": orgId } })
        .then(projectOrgMembersJson)
        .then(data => { if (active) setOrgMembers(data); })
        .catch(() => { if (active) setMemberChoicesError("membersLoadFailed"); });
    });
    return () => { active = false; };
  }, [orgId, addOpen]);

  if (!proj) return null;

  const members = proj.members;
  const existingMemberIds = new Set(members.map(m => m.member.id));
  const availableMembers = orgMembers.filter(m => !existingMemberIds.has(m.id));

  const managers = members.filter(m => m.role === "manager");
  const contributors = members.filter(m => m.role === "contributor");
  const viewers = members.filter(m => m.role === "viewer");

  async function handleAdd() {
    if (!orgId || selectedMemberId === "none" || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ memberId: selectedMemberId, role: selectedRole, hourlyRateMinor: hourlyRate ? projectCentsInput(hourlyRate) : undefined }),
      });
      await projectCollaborationMutationJson(res, "projectMember", { field: "memberId", id: selectedMemberId });
      toast.success(t("memberAdded"));
      setAddOpen(false);
      setSelectedMemberId("none"); setSelectedRole("contributor"); setHourlyRate("");
      refresh();
    } catch { toast.error(t("addFailed")); }
    finally { setSaving(false); }
  }

  async function removeMember(memberId: string) {
    if (!orgId || removingId) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members?memberId=${memberId}`, { method: "DELETE", headers: { "x-organization-id": orgId } });
      await projectCollaborationMutationJson(res, "success");
      toast.success(t("memberRemoved"));
      refresh();
    } catch { toast.error(t("removeMemberFailed")); }
    finally { setRemovingId(null); }
  }

  const assignedTeamIds = new Set(teamAssignments.map(a => a.teamId));
  const availableTeams = orgTeams.filter(t => !assignedTeamIds.has(t.id));

  return (
    <div className="space-y-8">
      {readError && <p role="alert" className="text-sm text-destructive">{t("assignmentsLoadFailed")}</p>}
      {/* Team assignments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UsersRound className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t("teams")}</h3>
            {teamAssignments.length > 0 && (
              <span className="text-[12px] text-muted-foreground">{t("assignedCount", { count: teamAssignments.length })}</span>
            )}
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setAddTeamOpen(true)}>
            <Plus className="size-3" />
            {t("assignTeam")}
          </Button>
        </div>

        {teamAssignments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <UsersRound className="mx-auto size-7 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">{t("noTeams")}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{t("noTeamsHint")}</p>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {teamAssignments.map((a) => (
              <div key={a.id} className="rounded-lg border bg-card p-4 group hover:border-blue-200 dark:hover:border-blue-800 transition-colors relative">
                <div className="flex items-start gap-3">
                  <div
                    className="size-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 text-white"
                    style={{ backgroundColor: a.team.color }}
                  >
                    {a.team.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate">{a.team.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t("memberCount", { count: a.team.members.length })}</p>
                    <Badge variant="outline" className={cn("text-[9px] h-4 mt-1.5 capitalize", roleColors[a.defaultRole])}>
                      {roleLabel(a.defaultRole)}
                    </Badge>
                  </div>
                  <button
                    aria-label={t("removeTeam")}
                    onClick={() => removeTeam(a.teamId)}
                    disabled={removingTeamId === a.teamId}
                    className={cn(
                      "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity absolute top-3 right-3",
                      removingTeamId === a.teamId && "opacity-100 pointer-events-none"
                    )}
                  >
                    {removingTeamId === a.teamId ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign team sheet */}
      <Sheet open={addTeamOpen} onOpenChange={setAddTeamOpen}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <UsersRound className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{t("assignTeam")}</SheetTitle>
                <SheetDescription>{t("assignDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("selectTeamHeading")}</p>
              <div className="space-y-2">
                {teamChoicesError && <p role="alert" className="text-sm text-destructive">{t("teamsLoadFailed")}</p>}
                <Label>{t("team")}</Label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger><SelectValue placeholder={t("selectTeam")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>{t("selectTeam")}</SelectItem>
                    {availableTeams.length === 0 && <div className="py-2 px-3 text-sm text-muted-foreground">{t("allTeamsAssigned")}</div>}
                    {availableTeams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("defaultRole")}</p>
              <div className="space-y-2">
                <Label>{t("teamRole")}</Label>
                <Select value={selectedTeamRole} onValueChange={setSelectedTeamRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">{t("manager")}</SelectItem>
                    <SelectItem value="contributor">{t("contributor")}</SelectItem>
                    <SelectItem value="viewer">{t("viewer")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{t("teamRoleHint")}</p>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            <Button type="button" variant="outline" onClick={() => setAddTeamOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleAddTeam} disabled={savingTeam || selectedTeamId === "none"} className="bg-emerald-600 hover:bg-emerald-700">
              {savingTeam ? t("assigning") : t("assignTeam")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <div className="h-px bg-border" />

      {/* Individual members */}
      <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3 text-[12px] text-muted-foreground flex-wrap">
          <span>{t("totalCount", { count: members.length })}</span>
          {managers.length > 0 && <><span className="text-border">|</span><span>{t("managerCount", { count: managers.length })}</span></>}
          {contributors.length > 0 && <><span className="text-border">|</span><span>{t("contributorCount", { count: contributors.length })}</span></>}
          {viewers.length > 0 && <><span className="text-border">|</span><span>{t("viewerCount", { count: viewers.length })}</span></>}
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" />{t("addMember")}
        </Button>
      </div>

      {/* Add Member Drawer */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Users className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{t("addMemberTitle")}</SheetTitle>
                <SheetDescription>{t("addDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("selectMemberHeading")}</p>
              <div className="space-y-2">
                {memberChoicesError && <p role="alert" className="text-sm text-destructive">{t("membersLoadFailed")}</p>}
                <Label>{t("member")}</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger><SelectValue placeholder={t("selectMember")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>{t("selectMember")}</SelectItem>
                    {availableMembers.length === 0 && <div className="py-2 px-3 text-sm text-muted-foreground">{t("allMembersAdded")}</div>}
                    {availableMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.userName || m.userEmail}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("permissions")}</p>
              <div className="space-y-2">
                <Label>{t("role")}</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">{t("manager")}</SelectItem>
                    <SelectItem value="contributor">{t("contributor")}</SelectItem>
                    <SelectItem value="viewer">{t("viewer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border divide-y text-[12px]">
                <div className="px-4 py-3">
                  <span className="font-medium">{t("manager")}</span>
                  <span className="text-muted-foreground ml-2">{t("managerHint")}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="font-medium">{t("contributor")}</span>
                  <span className="text-muted-foreground ml-2">{t("contributorHint")}</span>
                </div>
                <div className="px-4 py-3">
                  <span className="font-medium">{t("viewer")}</span>
                  <span className="text-muted-foreground ml-2">{t("viewerShortHint")}</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("compensation")}</p>
              <div className="space-y-2">
                <Label>{t("hourlyRate")}</Label>
                <CurrencyInput prefix={proj?.currency === "USD" ? "$" : proj?.currency} value={hourlyRate} onChange={setHourlyRate} />
                <p className="text-[11px] text-muted-foreground">{t("hourlyRateHint")}</p>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={saving || selectedMemberId === "none"} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? t("adding") : t("addMember")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center min-h-[30vh] flex flex-col items-center justify-center">
          <Users className="mx-auto size-8 text-muted-foreground/30" />
          <p className="mt-2 text-sm text-muted-foreground">{t("noMembers")}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <div key={m.id} className="rounded-lg border bg-card p-4 group hover:border-emerald-200 transition-colors relative">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {(m.member.user.name || m.member.user.email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{m.member.user.name || t("unnamed")}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{m.member.user.email}</p>
                  <Badge variant="outline" className={cn("text-[9px] h-4 mt-1.5 capitalize", roleColors[m.role])}>
                    {roleLabel(m.role)}
                  </Badge>
                  {m.hourlyRate && (
                    <span className="text-[10px] font-mono text-muted-foreground mt-0.5 block">{t("ratePerHour", { amount: formatMoney(m.hourlyRate) })}</span>
                  )}
                </div>
                <button aria-label={t("removeMember")} onClick={() => removeMember(m.member.id)} disabled={removingId === m.member.id} className={cn("opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity absolute top-3 right-3", removingId === m.member.id && "opacity-100 pointer-events-none")}>
                  {removingId === m.member.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {members.length > 0 && (
        <>
          <div className="h-px bg-border mt-6" />
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border grid-cols-1 sm:grid-cols-3 mt-4">
            <div className="bg-card p-4">
              <p className="text-[13px] font-medium">{t("manager")}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("managerHint")}</p>
            </div>
            <div className="bg-card p-4">
              <p className="text-[13px] font-medium">{t("contributor")}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("contributorHint")}</p>
            </div>
            <div className="bg-card p-4">
              <p className="text-[13px] font-medium">{t("viewer")}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t("viewerHint")}</p>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
