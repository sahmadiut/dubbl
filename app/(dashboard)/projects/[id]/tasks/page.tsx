"use client";

import { IdentifierText, BidiText } from "@/components/ui/bidi-text";

import { useProjectTaskPresentation, projectTaskMutationJson } from "@/i18n/project-task-presentation";

import { projectWholeMinutes } from "@/lib/money/project-display";

import { useState } from "react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  User2,
  CalendarDays,
  Users,
  MessageSquare,
  ListChecks,
  Send,
  LayoutList,
  Columns3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CircleDashed } from "lucide-react";
import {
  useProject,
  type TaskData,
} from "../project-context";

type ViewMode = "list" | "board";

export default function TasksPage() {
  const { t, priorityConfig, taskStatusConfig } = useProjectTaskPresentation();
  const { project: proj, orgId, projectId, refresh } = useProject();
  const [addOpen, setAddOpen] = useState(false);
  const [viewTask, setViewTask] = useState<TaskData | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Create form state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("medium");
  const [taskStatus, setTaskStatus] = useState("todo");
  const [assigneeId, setAssigneeId] = useState("none");
  const [teamId, setTeamId] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // View drawer edit state
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("none");
  const [editTeamId, setEditTeamId] = useState("none");

  // Checklist + Comments
  const [newCheckItem, setNewCheckItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  // Loading states for inline actions
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkItemSaving, setCheckItemSaving] = useState(false);
  const [deletingCheckId, setDeletingCheckId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  useDocumentTitle(t("documentTitle"));

  if (!proj) return null;

  const tasks = proj.tasks;
  const members = proj.members;
  const teams = proj.teams || [];
  const labels = proj.labels || [];
  const filtered = statusFilter === "all" ? tasks : tasks.filter(t => t.status === statusFilter);

  const tasksByStatus = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done" && t.status !== "cancelled");

  function openViewDrawer(task: TaskData) {
    setViewTask(task);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditAssigneeId(task.assigneeId || "none");
    setEditTeamId(task.teamId || "none");
    setNewCheckItem("");
    setNewComment("");
  }

  async function handleAdd() {
    if (!orgId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          title: title.trim(),
          description: desc || null,
          priority,
          status: taskStatus,
          assigneeId: assigneeId === "none" ? null : assigneeId,
          teamId: teamId === "none" ? null : teamId,
          startDate: startDate || null,
          dueDate: dueDate || null,
          estimatedMinutes: estimatedMinutes ? projectWholeMinutes(estimatedMinutes) : null,
          labels: selectedLabels,
        }),
      });
      await projectTaskMutationJson(res, "task");
      toast.success(t("created"));
      setAddOpen(false);
      setTitle(""); setDesc(""); setPriority("medium"); setTaskStatus("todo");
      setAssigneeId("none"); setTeamId("none"); setDueDate(""); setStartDate("");
      setEstimatedMinutes(""); setSelectedLabels([]);
      refresh();
    } catch { toast.error(t("createFailed")); }
    finally { setSaving(false); }
  }

  async function handleUpdate(taskId: string, updates: Record<string, unknown>) {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(updates),
      });
      await projectTaskMutationJson(res, "task", taskId);
      refresh();
    } catch { toast.error(t("updateFailed")); }
  }

  async function toggleStatus(taskId: string, current: string) {
    if (togglingId) return;
    setTogglingId(taskId);
    try {
      const newStatus = current === "done" ? "todo" : "done";
      await handleUpdate(taskId, { status: newStatus });
    } finally { setTogglingId(null); }
  }

  async function deleteTask(taskId: string) {
    if (!orgId || deletingId) return;
    setDeletingId(taskId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectTaskMutationJson(res, "success");
      setViewTask(null);
      refresh();
    } catch { toast.error(t("deleteFailed")); }
    finally { setDeletingId(null); }
  }

  async function addChecklistItem(taskId: string) {
    if (!orgId || !newCheckItem.trim() || checkItemSaving) return;
    setCheckItemSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ title: newCheckItem.trim() }),
      });
      await projectTaskMutationJson(res, "item");
      setNewCheckItem("");
      refresh();
    } catch { toast.error(t("addItemFailed")); }
    finally { setCheckItemSaving(false); }
  }

  async function toggleChecklistItem(taskId: string, itemId: string, isCompleted: boolean) {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ items: [{ id: itemId, isCompleted }] }),
      });
      await projectTaskMutationJson(res, "success");
      refresh();
    } catch { toast.error(t("updateItemFailed")); }
  }

  async function deleteChecklistItem(taskId: string, itemId: string) {
    if (!orgId || deletingCheckId) return;
    setDeletingCheckId(itemId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/checklist?itemId=${itemId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectTaskMutationJson(res, "success");
      refresh();
    } catch { toast.error(t("deleteItemFailed")); }
    finally { setDeletingCheckId(null); }
  }

  async function addComment(taskId: string) {
    if (!orgId || !newComment.trim()) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      await projectTaskMutationJson(res, "comment");
      setNewComment("");
      refresh();
    } catch { toast.error(t("commentFailed")); }
    finally { setCommentSaving(false); }
  }

  async function deleteComment(taskId: string, commentId: string) {
    if (!orgId || deletingCommentId) return;
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/comments?commentId=${commentId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectTaskMutationJson(res, "success");
      refresh();
    } catch { toast.error(t("deleteCommentFailed")); }
    finally { setDeletingCommentId(null); }
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {(["todo", "in_progress", "in_review", "done"] as const).map(s => {
          const tsc = taskStatusConfig[s];
          const count = tasksByStatus[s] || 0;
          return (
            <div key={s} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn("size-2 rounded-full", tsc.bar)} />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{tsc.label}</span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums">{count}</p>
            </div>
          );
        })}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="size-2.5 text-red-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("overdue")}</span>
          </div>
          <p className={cn("text-lg font-bold font-mono tabular-nums", overdueTasks.length > 0 && "text-red-600")}>{overdueTasks.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-8 h-auto flex-wrap">
              <TabsTrigger value="all" className="text-xs h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]">{t("allTasks", { count: tasks.length })}</TabsTrigger>
              <TabsTrigger value="todo" className="text-xs">{taskStatusConfig.todo.label}</TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs">{taskStatusConfig.in_progress.label}</TabsTrigger>
              <TabsTrigger value="in_review" className="text-xs">{taskStatusConfig.in_review.label}</TabsTrigger>
              <TabsTrigger value="done" className="text-xs">{taskStatusConfig.done.label}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-card">
            <button
              className={cn("p-1.5 rounded-s-md transition-colors", viewMode === "list" ? "bg-muted" : "hover:bg-muted/50")}
              aria-label={t("listView")}
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="size-3.5" />
            </button>
            <button
              className={cn("p-1.5 rounded-e-md transition-colors", viewMode === "board" ? "bg-muted" : "hover:bg-muted/50")}
              aria-label={t("boardView")}
              onClick={() => setViewMode("board")}
            >
              <Columns3 className="size-3.5" />
            </button>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />{t("task")}
          </Button>
        </div>
      </div>

      {/* Create Task Drawer */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Plus className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-lg">{t("newTask")}</SheetTitle>
                <SheetDescription>{t("newTaskDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("details")}</p>
              <div className="space-y-2">
                <Label htmlFor="rtl018-projects--id--tasks-page-tsx-1">{t("titleRequired")}</Label>
                <Input aria-label={t("titleRequired")} id="rtl018-projects--id--tasks-page-tsx-1" dir="auto" value={title} onChange={e => setTitle(e.target.value)} placeholder={t("taskTitle")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rtl018-projects--id--tasks-page-tsx-2">{t("description")}</Label>
                <Textarea aria-label={t("description")} id="rtl018-projects--id--tasks-page-tsx-2" dir="auto" value={desc} onChange={e => setDesc(e.target.value)} placeholder={t("descriptionPlaceholder")} rows={4} />
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("classification")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--tasks-page-tsx-3">{t("priority")}</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger aria-label={t("priority")} id="rtl018-projects--id--tasks-page-tsx-3" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{priorityConfig.low.label}</SelectItem>
                      <SelectItem value="medium">{priorityConfig.medium.label}</SelectItem>
                      <SelectItem value="high">{priorityConfig.high.label}</SelectItem>
                      <SelectItem value="urgent">{priorityConfig.urgent.label}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--tasks-page-tsx-4">{t("status")}</Label>
                  <Select value={taskStatus} onValueChange={setTaskStatus}>
                    <SelectTrigger aria-label={t("status")} id="rtl018-projects--id--tasks-page-tsx-4" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">{taskStatusConfig.backlog.label}</SelectItem>
                      <SelectItem value="todo">{taskStatusConfig.todo.label}</SelectItem>
                      <SelectItem value="in_progress">{taskStatusConfig.in_progress.label}</SelectItem>
                      <SelectItem value="in_review">{taskStatusConfig.in_review.label}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("assignment")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--tasks-page-tsx-5">{t("assignee")}</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger aria-label={t("assignee")} id="rtl018-projects--id--tasks-page-tsx-5" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue placeholder={t("unassigned")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("unassigned")}</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.member.id} value={m.member.id}>
                          <BidiText className="min-w-0 max-w-full">{m.member.user.name || m.member.user.email}</BidiText>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--tasks-page-tsx-6">{t("team")}</Label>
                  <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger aria-label={t("team")} id="rtl018-projects--id--tasks-page-tsx-6" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue placeholder={t("noTeam")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noTeam")}</SelectItem>
                      {teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                            <BidiText className="min-w-0 max-w-full">{t.name}</BidiText>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("schedule")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("startDate")}</Label>
                  <div role="group" aria-label={t("startDate")}><DatePicker className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" value={startDate} onChange={setStartDate} placeholder={t("selectStartDate")} /></div>
                </div>
                <div className="space-y-2">
                  <Label>{t("dueDate")}</Label>
                  <div role="group" aria-label={t("dueDate")}><DatePicker className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" value={dueDate} onChange={setDueDate} placeholder={t("selectDueDate")} /></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rtl018-projects--id--tasks-page-tsx-7">{t("estimatedTime")}</Label>
                <Input aria-label={t("estimatedTime")} id="rtl018-projects--id--tasks-page-tsx-7" dir="ltr" type="number" min={1} value={estimatedMinutes} onChange={e => setEstimatedMinutes(e.target.value)} placeholder={t("estimatePlaceholder")} />
              </div>
            </div>

            {labels.length > 0 && (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("labels")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSelectedLabels(prev =>
                          prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id]
                        )}
                        className={(cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                          selectedLabels.includes(l.id)
                            ? "border-foreground/30 bg-foreground/5 font-medium"
                            : "border-border hover:bg-muted"
                        )) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}
                      >
                        <span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />
                        <BidiText className="min-w-0 max-w-full">{l.name}</BidiText>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" type="button" variant="outline" onClick={() => setAddOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleAdd} disabled={saving || !title.trim()} className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full">
              {saving ? t("creating") : t("createTask")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* View/Edit Task Drawer */}
      <Sheet open={!!viewTask} onOpenChange={(open) => { if (!open) setViewTask(null); }}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          {viewTask && <TaskDetailDrawer
            task={viewTask}
            editStatus={editStatus}
            setEditStatus={setEditStatus}
            editPriority={editPriority}
            setEditPriority={setEditPriority}
            editAssigneeId={editAssigneeId}
            setEditAssigneeId={setEditAssigneeId}
            editTeamId={editTeamId}
            setEditTeamId={setEditTeamId}
            members={members}
            teams={teams}
            labels={labels}
            newCheckItem={newCheckItem}
            setNewCheckItem={setNewCheckItem}
            newComment={newComment}
            setNewComment={setNewComment}
            commentSaving={commentSaving}
            onUpdate={handleUpdate}
            onToggleStatus={toggleStatus}
            onDelete={deleteTask}
            onAddCheckItem={addChecklistItem}
            onToggleCheckItem={toggleChecklistItem}
            onDeleteCheckItem={deleteChecklistItem}
            onAddComment={addComment}
            onDeleteComment={deleteComment}
            onClose={() => setViewTask(null)}
            togglingId={togglingId}
            deletingId={deletingId}
            checkItemSaving={checkItemSaving}
            deletingCheckId={deletingCheckId}
            deletingCommentId={deletingCommentId}
          />}
        </SheetContent>
      </Sheet>

      {/* Content: List or Board */}
      {viewMode === "list" ? (
        <TaskListView
          tasks={filtered}
          proj={proj}
          labels={labels}
          onToggle={toggleStatus}
          onDelete={deleteTask}
          onView={openViewDrawer}
          togglingId={togglingId}
          deletingId={deletingId}
        />
      ) : (
        <TaskBoardView
          tasks={tasks}
          proj={proj}
          labels={labels}
          onUpdate={handleUpdate}
          onView={openViewDrawer}
        />
      )}
    </div>
  );
}

// ── Task List View ──
function TaskListView({ tasks, proj, labels, onToggle, onDelete, onView, togglingId, deletingId }: {
  tasks: TaskData[];
  proj: { color: string };
  labels: { id: string; name: string; color: string }[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onView: (task: TaskData) => void;
  togglingId: string | null;
  deletingId: string | null;
}) {
  const { t, priorityConfig, taskStatusConfig, formatHours, formatDateShort } = useProjectTaskPresentation();
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center min-h-[30vh] flex flex-col items-center justify-center">
        <CheckCircle2 className="mx-auto size-8 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground">{t("noTasks")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden divide-y">
      {tasks.map((task) => {
        const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
        const tsc = taskStatusConfig[task.status];
        const assignee = task.assignee;
        const team = task.team;
        const taskLabels = (task.labels || []).map(lid => labels.find(l => l.id === lid)).filter(Boolean);
        const checkDone = task.checklist?.filter(c => c.isCompleted).length || 0;
        const checkTotal = task.checklist?.length || 0;
        const commentCount = task.comments?.length || 0;

        return (
          <div
            key={task.id}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors group cursor-pointer"
            onClick={() => onView(task)}
          >
            <button aria-label={task.status === "done" ? t("reopenTask") : t("markDone")} onClick={(e) => { e.stopPropagation(); onToggle(task.id, task.status); }} disabled={togglingId === task.id} className="shrink-0">
              {togglingId === task.id ? (
                <Loader2 className="size-4 text-muted-foreground/40 animate-spin" />
              ) : task.status === "done" ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <CircleDashed className="size-4 text-muted-foreground/40 hover:text-emerald-400 transition-colors" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[13px] min-w-0 whitespace-normal [overflow-wrap:anywhere]", task.status === "done" && "line-through text-muted-foreground")}>
                  <BidiText className="min-w-0 max-w-full">{task.title}</BidiText>
                </span>
                {taskLabels.map(l => l && (
                  <span key={l.id} className="size-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} title={l.name} />
                ))}
              </div>
              {task.description && <p className="text-[11px] text-muted-foreground min-w-0 whitespace-normal [overflow-wrap:anywhere] mt-0.5"><BidiText className="min-w-0 max-w-full">{task.description}</BidiText></p>}
            </div>

            {checkTotal > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0 font-mono tabular-nums flex items-center gap-0.5">
                <ListChecks className="size-2.5" /><IdentifierText className="min-w-0 max-w-full">{checkDone}/{checkTotal}</IdentifierText>
              </span>
            )}

            {commentCount > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                <MessageSquare className="size-2.5" />{commentCount}
              </span>
            )}

            {team && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: team.color }} />
                <BidiText className="min-w-0 max-w-full">{team.name}</BidiText>
              </span>
            )}

            {assignee && (
              <div className="size-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0" style={{ backgroundColor: proj.color }} title={assignee.user.name || assignee.user.email}>
                <BidiText className="min-w-0 max-w-full">{(assignee.user.name || assignee.user.email)[0].toUpperCase()}</BidiText>
              </div>
            )}

            {task.estimatedMinutes && (
              <span className="text-[10px] text-muted-foreground shrink-0 font-mono tabular-nums hidden sm:flex items-center gap-0.5">
                <Clock className="size-2.5" /><IdentifierText className="min-w-0 max-w-full">{formatHours(task.estimatedMinutes)}</IdentifierText>
              </span>
            )}

            <Badge variant="outline" className={(cn("text-[9px] min-h-4 h-auto shrink-0", priorityConfig[task.priority]?.color)) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>
              {priorityConfig[task.priority]?.label}
            </Badge>
            <Badge variant="outline" className={(cn("text-[9px] min-h-4 h-auto shrink-0", tsc?.bg, tsc?.text)) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>
              {tsc?.label}
            </Badge>
            {task.dueDate && (
              <span className={cn("text-[10px] shrink-0 tabular-nums", overdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                {overdue && <AlertCircle className="size-2.5 inline me-0.5" />}
                <IdentifierText className="min-w-0 max-w-full">{formatDateShort(task.dueDate)}</IdentifierText>
              </span>
            )}
            <button
              aria-label={t("deleteTask")}
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              disabled={deletingId === task.id}
              className={cn("opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600", deletingId === task.id && "opacity-100 pointer-events-none")}
            >
              {deletingId === task.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Board / Kanban View ──
function TaskBoardView({ tasks, proj, labels, onUpdate, onView }: {
  tasks: TaskData[];
  proj: { color: string };
  labels: { id: string; name: string; color: string }[];
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onView: (task: TaskData) => void;
}) {
  const { priorityConfig, taskStatusConfig, formatDateShort } = useProjectTaskPresentation();
  const columns = ["backlog", "todo", "in_progress", "in_review", "done"] as const;

  return (
    <div className="flex gap-3 min-h-[40vh] overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-x-visible sm:pb-0">
      {columns.map(col => {
        const tsc = taskStatusConfig[col];
        const colTasks = tasks.filter(t => t.status === col);
        return (
          <div
            key={col}
            className="rounded-lg border bg-muted/20 flex flex-col min-w-[200px] sm:min-w-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData("taskId");
              if (taskId) onUpdate(taskId, { status: col });
            }}
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-card rounded-t-lg">
              <span className={cn("size-2 rounded-full", tsc.bar)} />
              <span className="text-[11px] font-semibold">{tsc.label}</span>
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground ms-auto">{colTasks.length}</span>
            </div>
            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
              {colTasks.map(task => {
                const assignee = task.assignee;
                const taskLabels = (task.labels || []).map(lid => labels.find(l => l.id === lid)).filter(Boolean);
                const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("taskId", task.id)}
                    className="rounded-md border bg-card p-2.5 cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={() => onView(task)}
                  >
                    <p className="text-[12px] font-medium leading-snug mb-1"><BidiText className="min-w-0 max-w-full">{task.title}</BidiText></p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {taskLabels.map(l => l && (
                        <span key={l.id} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: l.color + "20", color: l.color }}>
                          <BidiText className="min-w-0 max-w-full">{l.name}</BidiText>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge variant="outline" className={(cn("text-[8px] min-h-3 h-auto.5 px-1", priorityConfig[task.priority]?.color)) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>
                        {priorityConfig[task.priority]?.label}
                      </Badge>
                      {task.dueDate && (
                        <span className={cn("text-[9px] tabular-nums", overdue ? "text-red-600" : "text-muted-foreground")}>
                          <IdentifierText className="min-w-0 max-w-full">{formatDateShort(task.dueDate)}</IdentifierText>
                        </span>
                      )}
                      <span className="flex-1" />
                      {assignee && (
                        <div className="size-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white" style={{ backgroundColor: proj.color }} title={assignee.user.name || assignee.user.email}>
                          <BidiText className="min-w-0 max-w-full">{(assignee.user.name || assignee.user.email)[0].toUpperCase()}</BidiText>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Task Detail Drawer ──
function TaskDetailDrawer({
  task, editStatus, setEditStatus, editPriority, setEditPriority,
  editAssigneeId, setEditAssigneeId, editTeamId, setEditTeamId,
  members, teams, labels, newCheckItem, setNewCheckItem, newComment, setNewComment,
  commentSaving, onUpdate, onToggleStatus, onDelete, onAddCheckItem,
  onToggleCheckItem, onDeleteCheckItem, onAddComment, onDeleteComment, onClose,
  togglingId, deletingId, checkItemSaving, deletingCheckId, deletingCommentId,
}: {
  task: TaskData;
  editStatus: string; setEditStatus: (v: string) => void;
  editPriority: string; setEditPriority: (v: string) => void;
  editAssigneeId: string; setEditAssigneeId: (v: string) => void;
  editTeamId: string; setEditTeamId: (v: string) => void;
  members: { id: string; role: string; member: { id: string; role: string; user: { id: string; name: string | null; email: string; image: string | null } } }[];
  teams: { id: string; name: string; color: string }[];
  labels: { id: string; name: string; color: string }[];
  newCheckItem: string; setNewCheckItem: (v: string) => void;
  newComment: string; setNewComment: (v: string) => void;
  commentSaving: boolean;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onToggleStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onAddCheckItem: (taskId: string) => void;
  onToggleCheckItem: (taskId: string, itemId: string, completed: boolean) => void;
  onDeleteCheckItem: (taskId: string, itemId: string) => void;
  onAddComment: (taskId: string) => void;
  onDeleteComment: (taskId: string, commentId: string) => void;
  onClose: () => void;
  togglingId: string | null;
  deletingId: string | null;
  checkItemSaving: boolean;
  deletingCheckId: string | null;
  deletingCommentId: string | null;
}) {
  const { t, priorityConfig, taskStatusConfig, formatHours, formatDate, formatCreated } = useProjectTaskPresentation();
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" && task.status !== "cancelled";
  const creator = task.createdBy;
  const checklist = task.checklist || [];
  const comments = task.comments || [];
  const taskLabels = (task.labels || []).map(lid => labels.find(l => l.id === lid)).filter(Boolean);
  const checkDone = checklist.filter(c => c.isCompleted).length;

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
        <div className="flex items-start gap-3">
          <button aria-label={task.status === "done" ? t("reopenTask") : t("markDone")} onClick={() => onToggleStatus(task.id, task.status)} disabled={togglingId === task.id} className="mt-0.5 shrink-0">
            {togglingId === task.id ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : task.status === "done" ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="size-5" />
              </div>
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <CircleDashed className="size-5" />
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <SheetTitle className={cn("text-lg leading-snug", task.status === "done" && "line-through text-muted-foreground")}>
              <BidiText className="min-w-0 max-w-full">{task.title}</BidiText>
            </SheetTitle>
            <SheetDescription className="mt-0.5">
              <BidiText className="min-w-0 max-w-full">{creator ? t.rich("createdBy", { name: creator.name || creator.email , em: chunks => <BidiText className="min-w-0 max-w-full">{chunks}</BidiText> }) : t("taskDetails")}</BidiText>
              {" · "}
              <IdentifierText className="min-w-0 max-w-full">{formatCreated(task.createdAt)}</IdentifierText>
            </SheetDescription>
            {taskLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {taskLabels.map(l => l && (
                  <span key={l.id} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: l.color + "40", backgroundColor: l.color + "10", color: l.color }}>
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <BidiText className="min-w-0 max-w-full">{l.name}</BidiText>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
        {/* Classification */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("classification")}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rtl018-projects--id--tasks-page-tsx-8">{t("status")}</Label>
              <Select value={editStatus} onValueChange={(v) => { setEditStatus(v); onUpdate(task.id, { status: v }); }}>
                <SelectTrigger aria-label={t("status")} id="rtl018-projects--id--tasks-page-tsx-8" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(taskStatusConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", cfg.bar)} />{cfg.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rtl018-projects--id--tasks-page-tsx-9">{t("priority")}</Label>
              <Select value={editPriority} onValueChange={(v) => { setEditPriority(v); onUpdate(task.id, { priority: v }); }}>
                <SelectTrigger aria-label={t("priority")} id="rtl018-projects--id--tasks-page-tsx-9" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <>
            <div className="h-px bg-border" />
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("description")}</p>
              <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-lg bg-muted/30 p-4"><BidiText className="min-w-0 max-w-full">{task.description}</BidiText></p>
            </div>
          </>
        )}

        <div className="h-px bg-border" />

        {/* Assignment */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("assignment")}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><User2 className="size-3" /> {t("assignee")}</Label>
              <Select value={editAssigneeId} onValueChange={(v) => { setEditAssigneeId(v); onUpdate(task.id, { assigneeId: v === "none" ? null : v }); }}>
                <SelectTrigger aria-label={t("unassigned")} className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue placeholder={t("unassigned")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("unassigned")}</SelectItem>
                  {members.map(m => <SelectItem key={m.member.id} value={m.member.id}><BidiText className="min-w-0 max-w-full">{m.member.user.name || m.member.user.email}</BidiText></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Users className="size-3" /> {t("team")}</Label>
              <Select value={editTeamId} onValueChange={(v) => { setEditTeamId(v); onUpdate(task.id, { teamId: v === "none" ? null : v }); }}>
                <SelectTrigger aria-label={t("noTeam")} className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue placeholder={t("noTeam")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noTeam")}</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: t.color }} /><BidiText className="min-w-0 max-w-full">{t.name}</BidiText></span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Schedule */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("schedule")}</p>
          <div className="rounded-lg border divide-y">
            <div className="flex flex-wrap items-center justify-between px-4 py-3">
              <span className="text-[13px] text-muted-foreground flex items-center gap-2"><CalendarDays className="size-3.5" /> {t("dueDate")}</span>
              {task.dueDate ? (
                <span className={cn("text-[13px] font-mono tabular-nums font-medium", overdue ? "text-red-600" : "")}>
                  <IdentifierText className="min-w-0 max-w-full">{formatDate(task.dueDate)}</IdentifierText>
                  {overdue && <AlertCircle className="size-3.5 inline ms-1.5 text-red-500" />}
                </span>
              ) : <span className="text-[13px] text-muted-foreground/40">{t("notSet")}</span>}
            </div>
            {task.startDate && (
              <div className="flex flex-wrap items-center justify-between px-4 py-3">
                <span className="text-[13px] text-muted-foreground flex items-center gap-2"><CalendarDays className="size-3.5" /> {t("startDate")}</span>
                <span className="text-[13px] font-mono tabular-nums"><IdentifierText className="min-w-0 max-w-full">{formatDate(task.startDate)}</IdentifierText></span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between px-4 py-3">
              <span className="text-[13px] text-muted-foreground flex items-center gap-2"><Clock className="size-3.5" /> {t("estimate")}</span>
              <span className="text-[13px] font-mono tabular-nums">{task.estimatedMinutes ? formatHours(task.estimatedMinutes) : <span className="text-muted-foreground/40">{t("notSet")}</span>}</span>
            </div>
            {task.completedAt && (
              <div className="flex flex-wrap items-center justify-between px-4 py-3">
                <span className="text-[13px] text-muted-foreground flex items-center gap-2"><CheckCircle2 className="size-3.5" /> {t("completed")}</span>
                <span className="text-[13px] font-mono tabular-nums"><IdentifierText className="min-w-0 max-w-full">{formatCreated(task.completedAt)}</IdentifierText></span>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Checklist */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="size-3.5" /> {t("checklist")}
              {checklist.length > 0 && <span className="text-muted-foreground/60 font-mono">(<IdentifierText className="min-w-0 max-w-full">{checkDone}/{checklist.length}</IdentifierText>)</span>}
            </p>
          </div>
          {checklist.length > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${checklist.length > 0 ? (checkDone / checklist.length) * 100 : 0}%` }} />
            </div>
          )}
          <div className="space-y-1">
            {checklist.map(item => (
              <div key={item.id} className="flex items-center gap-2.5 py-1 group">
                <Checkbox
                  checked={item.isCompleted}
                  onCheckedChange={(checked) => onToggleCheckItem(task.id, item.id, !!checked)}
                />
                <span className={cn("text-[13px] flex-1", item.isCompleted && "line-through text-muted-foreground")}><BidiText className="min-w-0 max-w-full">{item.title}</BidiText></span>
                <button
                  aria-label={t("deleteItem")}
                  onClick={() => onDeleteCheckItem(task.id, item.id)}
                  disabled={deletingCheckId === item.id}
                  className={cn("opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity", deletingCheckId === item.id && "opacity-100 pointer-events-none")}
                >
                  {deletingCheckId === item.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input aria-label={t("checklistPlaceholder")} dir="auto"
              value={newCheckItem}
              onChange={e => setNewCheckItem(e.target.value)}
              placeholder={t("checklistPlaceholder")}
              className="text-sm"
              onKeyDown={e => { if (e.key === "Enter") onAddCheckItem(task.id); }}
            />
            <Button aria-label={t("addItem")} size="sm" variant="outline" className="shrink-0" onClick={() => onAddCheckItem(task.id)} disabled={!newCheckItem.trim() || checkItemSaving}>
              {checkItemSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            </Button>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Comments */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="size-3.5" /> {t("comments", { count: comments.length })}
          </p>
          <div className="space-y-2">
            <Textarea aria-label={t("commentPlaceholder")} dir="auto"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder={t("commentPlaceholder")}
              className="text-sm min-h-[80px]"
              rows={3}
            />
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
              onClick={() => onAddComment(task.id)}
              disabled={commentSaving || !newComment.trim()}
            >
              <Send className="size-3.5" />{commentSaving ? t("posting") : t("postComment")}
            </Button>
          </div>
          {comments.length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              {comments.map(c => (
                <div key={c.id} className="rounded-lg bg-muted/30 p-3.5 group">
                  <div className="flex flex-wrap items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium"><BidiText className="min-w-0 max-w-full">{c.author.name || c.author.email}</BidiText></span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground"><IdentifierText className="min-w-0 max-w-full">{formatCreated(c.createdAt, true)}</IdentifierText></span>
                      <button
                        aria-label={t("deleteComment")}
                        onClick={() => onDeleteComment(task.id, c.id)}
                        disabled={deletingCommentId === c.id}
                        className={cn("opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-opacity", deletingCommentId === c.id && "opacity-100 pointer-events-none")}
                      >
                        {deletingCommentId === c.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed"><BidiText className="min-w-0 max-w-full">{c.content}</BidiText></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={() => onDelete(task.id)} disabled={deletingId === task.id}>
          {deletingId === task.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}{deletingId === task.id ? t("deleting") : t("delete")}
        </Button>
        <div className="flex items-center gap-2">
          <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" variant="outline" onClick={onClose}>{t("close")}</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={() => { onToggleStatus(task.id, task.status); onClose(); }} disabled={togglingId === task.id}>
            {togglingId === task.id ? t("saving") : task.status === "done" ? t("reopenTask") : t("markDone")}
          </Button>
        </div>
      </div>
    </>
  );
}
