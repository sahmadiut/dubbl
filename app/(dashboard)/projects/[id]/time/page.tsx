"use client";

import { IdentifierText, BidiText } from "@/components/ui/bidi-text";
import { usePresentation as useUnitPresentation } from "@/i18n/provider";

import { projectTimerJson, projectTimeEntryJson, projectTimeDeleteJson } from "@/i18n/project-time-presentation";
import { useTranslations } from "next-intl";
import { useProjectPresentation } from "@/i18n/project-overview-presentation";
import { formatDateOnly, formatInstant } from "@/i18n/dates";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Play,
  Square,
  Clock,
  Pause,
  RotateCcw,
  CalendarDays,
  Zap,
  DollarSign,
  CircleDot,
  Filter,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { cn } from "@/lib/utils";
import { projectMoneyDisplay, projectTimeCents, projectHoursInput, projectWholeMinutes } from "@/lib/money/project-display";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useProject, type TimeEntryData, type RunningTimerData } from "../project-context";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

export default function TimePage() {
  const unitPresentation = useUnitPresentation();
  const t = useTranslations("ProjectTime");
  const { formatHours, formatDateShort, presentation } = useProjectPresentation();
  const { project: proj, orgId, projectId, refresh } = useProject();
  const formatMoney = (amount: number | bigint | string) => projectMoneyDisplay(amount, proj?.currency ?? "USD", unitPresentation);

  // Drawer state: "add" for new, entry object for edit
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntryData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [entryDesc, setEntryDesc] = useState("");
  const [entryMinutes, setEntryMinutes] = useState("");
  const [entryHours, setEntryHours] = useState("");
  const [entryBillable, setEntryBillable] = useState("true");
  const [entryTaskId, setEntryTaskId] = useState("none");

  // Filters
  const [filterMember, setFilterMember] = useState("all");
  const [filterBillable, setFilterBillable] = useState("all");
  const [filterTask, setFilterTask] = useState("all");

  // Timer state - synced with DB
  const [timerData, setTimerData] = useState<RunningTimerData | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDesc, setTimerDesc] = useState("");
  const [timerTaskId, setTimerTaskId] = useState("none");
  const [timerBillable, setTimerBillable] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const descSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDescRef = useRef("");
  const lastSavedTaskRef = useRef("none");
  const lastSavedBillableRef = useRef(true);
  const stoppingRef = useRef(false);
  useDocumentTitle(t("documentTitle"));

  // Initialize timer from server data
  useEffect(() => {
    if (!proj) return;
    const myTimer = proj.runningTimers?.[0] || null;
    if (myTimer && !timerData && !stoppingRef.current) {
      setTimerData(myTimer);
      setTimerDesc(myTimer.description || "");
      setTimerTaskId(myTimer.taskId || "none");
      setTimerBillable(myTimer.isBillable);
      lastSavedDescRef.current = myTimer.description || "";
      lastSavedTaskRef.current = myTimer.taskId || "none";
      lastSavedBillableRef.current = myTimer.isBillable;

      // Calculate elapsed seconds
      if (myTimer.pausedAt) {
        setTimerSeconds(myTimer.accumulatedSeconds);
      } else {
        // Running: accumulated + time since last resume (startedAt is updated on resume)
        const sinceLast = Math.floor((Date.now() - new Date(myTimer.startedAt).getTime()) / 1000);
        setTimerSeconds(Math.max(0, myTimer.accumulatedSeconds + sinceLast));
      }
    }
  }, [proj, timerData]);

  // Tick the timer
  useEffect(() => {
    if (timerData && !timerData.pausedAt) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerData, timerData?.pausedAt]);

  // Auto-save description/task/billable every 2s when changed
  const saveTimerFields = useCallback(async () => {
    if (!orgId || !timerData) return;
    const updates: Record<string, unknown> = {};
    let hasChanges = false;

    if (timerDesc !== lastSavedDescRef.current) {
      updates.description = timerDesc || null;
      hasChanges = true;
    }
    if (timerTaskId !== lastSavedTaskRef.current) {
      updates.taskId = timerTaskId === "none" ? null : timerTaskId;
      hasChanges = true;
    }
    if (timerBillable !== lastSavedBillableRef.current) {
      updates.isBillable = timerBillable;
      hasChanges = true;
    }

    if (!hasChanges) return;

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/timer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify(updates),
      });
      await projectTimerJson(res, projectId);
      lastSavedDescRef.current = timerDesc;
      lastSavedTaskRef.current = timerTaskId;
      lastSavedBillableRef.current = timerBillable;
    } catch { /* silent */ }
  }, [orgId, projectId, timerData, timerDesc, timerTaskId, timerBillable]);

  useEffect(() => {
    if (!timerData) return;
    if (descSaveRef.current) clearTimeout(descSaveRef.current);
    descSaveRef.current = setTimeout(saveTimerFields, 2000);
    return () => { if (descSaveRef.current) clearTimeout(descSaveRef.current); };
  }, [timerDesc, timerTaskId, timerBillable, saveTimerFields, timerData]);

  async function startTimer() {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({ isBillable: true }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await projectTimerJson(res, projectId);
      setTimerData(data.timer);
      setTimerSeconds(0);
      setTimerDesc("");
      setTimerTaskId("none");
      setTimerBillable(true);
      lastSavedDescRef.current = "";
      lastSavedTaskRef.current = "none";
      lastSavedBillableRef.current = true;
    } catch { toast.error(t("startFailed")); }
  }

  async function pauseTimer() {
    if (!orgId || !timerData) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/timer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          pausedAt: new Date().toISOString(),
          accumulatedSeconds: timerSeconds,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await projectTimerJson(res, projectId);
      setTimerData(data.timer);
    } catch { toast.error(t("pauseFailed")); }
  }

  async function resumeTimer() {
    if (!orgId || !timerData) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/timer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          pausedAt: null,
          accumulatedSeconds: timerSeconds,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await projectTimerJson(res, projectId);
      setTimerData(data.timer);
    } catch { toast.error(t("resumeFailed")); }
  }

  async function resetTimer() {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/timer`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectTimeDeleteJson(res);
    } catch { toast.error(t("resetFailed")); return; }
    setTimerData(null);
    setTimerSeconds(0);
    setTimerDesc("");
    setTimerTaskId("none");
    setTimerBillable(true);
  }

  async function stopTimer() {
    if (!orgId || !timerData || stoppingRef.current) return;
    stoppingRef.current = true;
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    try {
      // Save the time entry
      const res = await fetch(`/api/v1/projects/${projectId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          description: timerDesc || null,
          minutes,
          isBillable: timerBillable,
          taskId: timerTaskId === "none" ? null : timerTaskId,
        }),
      });
      await projectTimeEntryJson(res, projectId);

      // Delete the running timer
      const discarded = await fetch(`/api/v1/projects/${projectId}/timer`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectTimeDeleteJson(discarded);

      toast.success(t("logged", { duration: formatHours(minutes) }));
      setTimerData(null);
      setTimerSeconds(0);
      setTimerDesc("");
      setTimerTaskId("none");
      setTimerBillable(true);
      refresh();
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      stoppingRef.current = false;
    }
  }

  function formatTimerDisplay(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const digits = new Intl.NumberFormat(presentation.locale, { numberingSystem: presentation.numerals, minimumIntegerDigits: 2, useGrouping: false });
    return { h: digits.format(h), m: digits.format(m), s: digits.format(s) };
  }

  // Open drawer for adding
  function openAdd() {
    setDrawerMode("add");
    setEditingEntry(null);
    setEntryDate(new Date().toISOString().split("T")[0]);
    setEntryDesc("");
    setEntryMinutes("");
    setEntryHours("");
    setEntryBillable("true");
    setEntryTaskId("none");
  }

  // Open drawer for editing
  function openEdit(entry: TimeEntryData) {
    setDrawerMode("edit");
    setEditingEntry(entry);
    setEntryDate(entry.date);
    setEntryDesc(entry.description || "");
    const h = entry.minutes / 60;
    if (h === Math.floor(h)) {
      setEntryHours(String(h));
      setEntryMinutes("");
    } else {
      setEntryMinutes(String(entry.minutes));
      setEntryHours("");
    }
    setEntryBillable(entry.isBillable ? "true" : "false");
    setEntryTaskId(entry.taskId || "none");
  }

  function closeDrawer() {
    setDrawerMode(null);
    setEditingEntry(null);
  }

  if (!proj) return null;

  const entries = proj.timeEntries;
  const tasks = proj.tasks || [];
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const totalAmount = entries.reduce((sum, e) => sum + projectTimeCents(e.minutes, e.hourlyRate), 0n);
  const billableMinutes = entries.filter(e => e.isBillable).reduce((sum, e) => sum + e.minutes, 0);
  const billablePct = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0;
  const unbilledMinutes = entries.filter(e => e.isBillable && !e.invoiceId).reduce((sum, e) => sum + e.minutes, 0);
  const unbilledAmount = entries.filter(e => e.isBillable && !e.invoiceId).reduce((sum, e) => sum + projectTimeCents(e.minutes, e.hourlyRate), 0n);

  // Unique members for filter
  const uniqueMembers = Array.from(
    new Map(entries.filter(e => e.user?.name).map(e => [e.user!.name, e.user!.name])).values()
  );

  // Unique tasks for filter
  const uniqueTasks = Array.from(
    new Map(entries.filter(e => e.task).map(e => [e.task!.id, e.task!])).values()
  );

  // Apply filters
  const filteredEntries = entries.filter(e => {
    if (filterMember !== "all" && e.user?.name !== filterMember) return false;
    if (filterBillable === "billable" && !e.isBillable) return false;
    if (filterBillable === "non-billable" && e.isBillable) return false;
    if (filterBillable === "invoiced" && !e.invoiceId) return false;
    if (filterTask !== "all") {
      if (filterTask === "none" && e.taskId) return false;
      if (filterTask !== "none" && e.task?.id !== filterTask) return false;
    }
    return true;
  });

  const hasActiveFilters = filterMember !== "all" || filterBillable !== "all" || filterTask !== "all";

  function clearFilters() {
    setFilterMember("all");
    setFilterBillable("all");
    setFilterTask("all");
  }

  // Today's entries
  const today = new Date().toISOString().split("T")[0];
  const todayMinutes = entries.filter(e => e.date === today).reduce((sum, e) => sum + e.minutes, 0);
  const todayEntries = entries.filter(e => e.date === today).length;

  // This week's data for chart
  const weekDays = getWeekDays();
  const weekData = weekDays.map(d => {
    const dayEntries = entries.filter(e => e.date === d.date);
    const mins = dayEntries.reduce((sum, e) => sum + e.minutes, 0);
    const billableMins = dayEntries.filter(e => e.isBillable).reduce((sum, e) => sum + e.minutes, 0);
    return {
      day: formatDateOnly(d.date, presentation, { weekday: "short" }),
      date: d.date,
      hours: Math.round((mins / 60) * 100) / 100,
      billable: Math.round((billableMins / 60) * 100) / 100,
      isToday: d.date === today,
    };
  });
  const weekTotalMinutes = weekData.reduce((sum, d) => sum + d.hours * 60, 0);

  const columns: Column<TimeEntryData>[] = [
    { key: "date", header: t("date"), className: "w-24", render: r => <span className="text-[13px] tabular-nums"><IdentifierText className="min-w-0 max-w-full">{formatDateShort(r.date)}</IdentifierText></span> },
    { key: "user", header: t("user"), className: "w-28", render: r => <span className="text-xs text-muted-foreground"><BidiText className="min-w-0 max-w-full">{r.user?.name || "-"}</BidiText></span> },
    { key: "description", header: t("description"), render: r => (
      <div>
        <span className="text-[13px]"><BidiText className="min-w-0 max-w-full">{r.description || "-"}</BidiText></span>
        {r.task && <Badge variant="outline" className="text-[9px] min-h-4 h-auto ms-1.5 align-middle min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"><BidiText className="min-w-0 max-w-full">{r.task.title}</BidiText></Badge>}
      </div>
    )},
    { key: "duration", header: t("duration"), className: "w-20 text-end", render: r => <span className="text-[13px] font-mono tabular-nums font-medium"><IdentifierText className="min-w-0 max-w-full">{formatHours(r.minutes)}</IdentifierText></span> },
    { key: "amount", header: t("amount"), className: "w-24 text-end", render: r => <span className="text-[13px] font-mono tabular-nums"><IdentifierText className="min-w-0 max-w-full">{formatMoney(projectTimeCents(r.minutes, r.hourlyRate))}</IdentifierText></span> },
    { key: "status", header: "", className: "w-20", render: r => {
      if (r.invoiceId) return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] min-h-4 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">{t("invoiced")}</Badge>;
      return <Badge variant="outline" className={(cn("text-[9px] min-h-4 h-auto", r.isBillable ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-600")) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}>{r.isBillable ? t("billable") : t("nonBillableShort")}</Badge>;
    }},
  ];

  async function handleAdd() {
    if (!orgId) return;
    let mins: number;
    try { mins = entryHours ? projectHoursInput(entryHours) : projectWholeMinutes(entryMinutes); }
    catch { toast.error(t("invalidDuration")); return; }
    if (!mins || mins <= 0) { toast.error(t("invalidDuration")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          date: entryDate,
          description: entryDesc || null,
          minutes: mins,
          isBillable: entryBillable === "true",
          taskId: entryTaskId === "none" ? null : entryTaskId,
        }),
      });
      await projectTimeEntryJson(res, projectId);
      toast.success(t("entryAdded"));
      closeDrawer();
      refresh();
    } catch { toast.error(t("addFailed")); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!orgId || !editingEntry) return;
    let mins: number;
    try { mins = entryHours ? projectHoursInput(entryHours) : projectWholeMinutes(entryMinutes); }
    catch { toast.error(t("invalidDuration")); return; }
    if (!mins || mins <= 0) { toast.error(t("invalidDuration")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/time-entries/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-organization-id": orgId },
        body: JSON.stringify({
          date: entryDate,
          description: entryDesc || null,
          minutes: mins,
          isBillable: entryBillable === "true",
          taskId: entryTaskId === "none" ? null : entryTaskId,
        }),
      });
      await projectTimeEntryJson(res, projectId, editingEntry.id);
      toast.success(t("entryUpdated"));
      closeDrawer();
      refresh();
    } catch { toast.error(t("updateFailed")); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!orgId || !editingEntry) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/time-entries/${editingEntry.id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      await projectTimeDeleteJson(res);
      toast.success(t("entryDeleted"));
      closeDrawer();
      refresh();
    } catch { toast.error(t("deleteFailed")); }
    finally { setDeleting(false); }
  }

  const timerTime = formatTimerDisplay(timerSeconds);
  const timerIsRunning = !!timerData;
  const timerIsPaused = !!timerData?.pausedAt;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top: Timer + Weekly Chart side by side */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-[1fr_1.5fr]">
        {/* Timer Card */}
        <div className={cn(
          "rounded-xl border bg-card p-4 sm:p-5 flex flex-col",
          timerIsRunning && !timerIsPaused && "border-emerald-300 bg-gradient-to-b from-emerald-50/40 to-card dark:from-emerald-950/20",
          timerIsPaused && "border-amber-300 bg-gradient-to-b from-amber-50/30 to-card dark:from-amber-950/20",
        )}>
          <div className="flex flex-wrap items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "size-2 rounded-full",
                timerIsRunning && !timerIsPaused && "bg-emerald-500 animate-pulse",
                timerIsPaused && "bg-amber-500",
                !timerIsRunning && "bg-muted-foreground/20",
              )} />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {timerIsRunning ? (timerIsPaused ? t("paused") : t("recording")) : t("timer")}
              </span>
            </div>
            {timerData && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {t.rich("started", { time: formatInstant(new Date(timerData.startedAt), presentation, { hour: "2-digit", minute: "2-digit" }) , code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}
              </span>
            )}
          </div>

          {/* Timer Display */}
          <div className="flex items-center justify-center py-3 sm:py-4">
            <div dir="ltr" className="flex items-baseline gap-1 select-none [unicode-bidi:isolate]">
              <span className={cn(
                "text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight transition-colors",
                timerIsRunning && !timerIsPaused && "text-emerald-700 dark:text-emerald-400",
                timerIsPaused && "text-amber-700 dark:text-amber-400",
                !timerIsRunning && "text-muted-foreground/30",
              )}>
                {timerTime.h}
              </span>
              <span className={cn(
                "text-xl sm:text-2xl font-light transition-colors",
                timerIsRunning && !timerIsPaused ? "text-emerald-400 animate-pulse" : "text-muted-foreground/20",
              )}>:</span>
              <span className={cn(
                "text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight transition-colors",
                timerIsRunning && !timerIsPaused && "text-emerald-700 dark:text-emerald-400",
                timerIsPaused && "text-amber-700 dark:text-amber-400",
                !timerIsRunning && "text-muted-foreground/30",
              )}>
                {timerTime.m}
              </span>
              <span className={cn(
                "text-xl sm:text-2xl font-light transition-colors",
                timerIsRunning && !timerIsPaused ? "text-emerald-400 animate-pulse" : "text-muted-foreground/20",
              )}>:</span>
              <span className={cn(
                "text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight transition-colors",
                timerIsRunning && !timerIsPaused && "text-emerald-600 dark:text-emerald-500",
                timerIsPaused && "text-amber-600 dark:text-amber-500",
                !timerIsRunning && "text-muted-foreground/20",
              )}>
                {timerTime.s}
              </span>
            </div>
          </div>

          {/* Timer Description + Task */}
          {timerIsRunning && (
            <div className="space-y-2 mb-3">
              <Input aria-label={t("workingPlaceholder")} dir="auto"
                value={timerDesc}
                onChange={e => setTimerDesc(e.target.value)}
                placeholder={t("workingPlaceholder")}
                className="h-8 text-xs bg-background/50"
              />
              {tasks.length > 0 && (
                <Select value={timerTaskId} onValueChange={setTimerTaskId}>
                  <SelectTrigger aria-label={t("linkTaskPlaceholder")} className="h-auto min-h-8 text-xs whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
                    <SelectValue placeholder={t("linkTaskPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("noTask")}</SelectItem>
                    {tasks.map(t => (
                      <SelectItem key={t.id} value={t.id}><BidiText className="min-w-0 max-w-full">{t.title}</BidiText></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <button
                onClick={() => setTimerBillable(!timerBillable)}
                className={(cn(
                  "flex items-center gap-1.5 text-[11px] rounded-md px-2 py-1 transition-colors w-fit",
                  timerBillable
                    ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40"
                    : "text-muted-foreground bg-muted hover:bg-muted/80",
                )) + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}
              >
                <DollarSign className="size-3" />
                {timerBillable ? t("billable") : t("nonBillable")}
              </button>
            </div>
          )}

          {/* Timer Controls */}
          <div className="flex items-center gap-2 mt-auto">
            {!timerIsRunning ? (
              <Button
                size="sm"
                className="flex-1 h-auto min-h-9 bg-emerald-600 hover:bg-emerald-700 gap-2 text-sm font-medium whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                onClick={startTimer}
              >
                <Play className="size-3.5 fill-current" />
                {t("startTimer")}
              </Button>
            ) : (
              <>
                {timerIsPaused ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-auto min-h-9 gap-2 text-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                    onClick={resumeTimer}
                  >
                    <Play className="size-3.5 fill-current" />
                    {t("resume")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-auto min-h-9 gap-2 text-sm border-amber-200 text-amber-700 hover:bg-amber-50 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                    onClick={pauseTimer}
                  >
                    <Pause className="size-3.5" />
                    {t("pause")}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 h-auto min-h-9 gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                  onClick={stopTimer}
                >
                  <Square className="size-3 fill-current" />
                  {t("save")}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 text-muted-foreground hover:text-red-600"
                  onClick={resetTimer}
                  aria-label={t("resetTimer")}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="rounded-xl border bg-card p-4 sm:p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between mb-3 sm:mb-4 gap-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-muted-foreground/60" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("thisWeek")}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">{t.rich("weekTotal", { duration: formatHours(Math.round(weekTotalMinutes)) , code: chunks => <IdentifierText className="min-w-0 max-w-full">{chunks}</IdentifierText> })}</span>
          </div>

          <div dir="ltr" className="flex-1 min-h-[140px] [unicode-bidi:isolate]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} barSize={28} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => t("chartHours", { hours: Number(v) })}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                  }}
                  formatter={(value: number | undefined, name: string | undefined) => [
                    t("chartHours", { hours: value ?? 0 }),
                    name === "billable" ? t("billable") : t("total"),
                  ]}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <Bar dataKey="hours" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="total" />
                <Bar dataKey="billable" fill="#10b981" radius={[4, 4, 0, 0]} name="billable" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard
          label={t("today")}
          value={formatHours(todayMinutes)}
          sub={t("entryCount", { count: todayEntries })}
          icon={<Zap className="size-3.5" />}
          accent={todayMinutes > 0 ? "emerald" : undefined}
        />
        <StatCard
          label={t("totalTime")}
          value={formatHours(totalMinutes)}
          sub={t("entryCount", { count: entries.length })}
          icon={<Clock className="size-3.5" />}
        />
        <StatCard
          label={t("earned")}
          value={formatMoney(totalAmount)}
          sub={t("billablePercent", { percent: billablePct / 100 })}
          icon={<DollarSign className="size-3.5" />}
          accent="emerald"
        />
        <StatCard
          label={t("unbilled")}
          value={unbilledAmount > 0 ? formatMoney(unbilledAmount) : formatHours(unbilledMinutes)}
          sub={unbilledMinutes > 0 ? formatHours(unbilledMinutes) : t("allInvoiced")}
          icon={<CircleDot className="size-3.5" />}
          accent={unbilledMinutes > 0 ? "amber" : undefined}
        />
      </div>

      {/* Action bar + Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("allEntries")}
            {hasActiveFilters && (
              <span className="ms-1.5 text-muted-foreground/60">
                {t("filteredCount", { count: filteredEntries.length, total: entries.length })}
              </span>
            )}
          </p>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={openAdd}>
            <Plus className="size-3.5" />{t("logTime")}
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="size-3.5 text-muted-foreground/50 shrink-0" />

          {uniqueMembers.length > 0 && (
            <Select value={filterMember} onValueChange={setFilterMember}>
              <SelectTrigger aria-label={t("member")} className={((cn("h-auto min-h-7 h-auto text-xs w-auto min-w-[120px]", filterMember !== "all" && "border-blue-300 bg-blue-50/50")) + " h-auto min-h-8 h-auto whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal") + " min-w-0 max-w-full"}>
                <SelectValue placeholder={t("member")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allMembers")}</SelectItem>
                {uniqueMembers.map(name => (
                  <SelectItem key={name} value={name!}><BidiText className="min-w-0 max-w-full">{name}</BidiText></SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filterBillable} onValueChange={setFilterBillable}>
            <SelectTrigger aria-label={t("status")} className={((cn("h-auto min-h-7 h-auto text-xs w-auto min-w-[120px]", filterBillable !== "all" && "border-blue-300 bg-blue-50/50")) + " h-auto min-h-8 h-auto whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal") + " min-w-0 max-w-full"}>
              <SelectValue placeholder={t("status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="billable">{t("billable")}</SelectItem>
              <SelectItem value="non-billable">{t("nonBillable")}</SelectItem>
              <SelectItem value="invoiced">{t("invoiced")}</SelectItem>
            </SelectContent>
          </Select>

          {uniqueTasks.length > 0 && (
            <Select value={filterTask} onValueChange={setFilterTask}>
              <SelectTrigger aria-label={t("task")} className={((cn("h-auto min-h-7 h-auto text-xs w-auto min-w-[120px]", filterTask !== "all" && "border-blue-300 bg-blue-50/50")) + " h-auto min-h-8 h-auto whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal") + " min-w-0 max-w-full"}>
                <SelectValue placeholder={t("task")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTasks")}</SelectItem>
                <SelectItem value="none">{t("noTask")}</SelectItem>
                {uniqueTasks.map(t => (
                  <SelectItem key={t.id} value={t.id}><BidiText className="min-w-0 max-w-full">{t.title}</BidiText></SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-auto text-xs text-muted-foreground px-2 min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" onClick={clearFilters}>
              <X className="size-3 me-1" />{t("clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Entry Drawer (Add / Edit) */}
      <Sheet open={drawerMode !== null} onOpenChange={open => { if (!open) closeDrawer(); }}>
        <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                drawerMode === "edit"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
              )}>
                {drawerMode === "edit" ? <Pencil className="size-5" /> : <Clock className="size-5" />}
              </div>
              <div>
                <SheetTitle className="text-lg">{drawerMode === "edit" ? t("editTitle") : t("addTitle")}</SheetTitle>
                <SheetDescription>{drawerMode === "edit" ? t("editDescription") : t("addDescription")}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-6 px-6 py-5">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("when")}</p>
              <div className="space-y-2">
                <Label>{t("date")}</Label>
                <div role="group" aria-label={t("date")}><DatePicker className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere]" value={entryDate} onChange={setEntryDate} placeholder={t("selectDate")} /></div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("details")}</p>
              <div className="space-y-2">
                <Label htmlFor="rtl018-projects--id--time-page-tsx-6">{t("description")}</Label>
                <Textarea aria-label={t("description")} id="rtl018-projects--id--time-page-tsx-6" dir="auto" value={entryDesc} onChange={e => setEntryDesc(e.target.value)} placeholder={t("descriptionPlaceholder")} rows={3} />
              </div>
              {tasks.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--time-page-tsx-7">{t("relatedTask")}</Label>
                  <Select value={entryTaskId} onValueChange={setEntryTaskId}>
                    <SelectTrigger aria-label={t("relatedTask")} id="rtl018-projects--id--time-page-tsx-7" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue placeholder={t("noTask")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noTask")}</SelectItem>
                      {tasks.map(t => (
                        <SelectItem key={t.id} value={t.id}><BidiText className="min-w-0 max-w-full">{t.title}</BidiText></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("duration")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--time-page-tsx-8">{t("hours")}</Label>
                  <Input aria-label={t("hours")} id="rtl018-projects--id--time-page-tsx-8" dir="ltr" type="number" step="0.25" min={0} value={entryHours} onChange={e => { setEntryHours(e.target.value); setEntryMinutes(""); }} placeholder={t("hoursExample")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rtl018-projects--id--time-page-tsx-9">{t("orMinutes")}</Label>
                  <Input aria-label={t("orMinutes")} id="rtl018-projects--id--time-page-tsx-9" dir="ltr" type="number" min={1} value={entryMinutes} onChange={e => { setEntryMinutes(e.target.value); setEntryHours(""); }} placeholder={t("minutesExample")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rtl018-projects--id--time-page-tsx-10">{t("billable")}</Label>
                <Select value={entryBillable} onValueChange={setEntryBillable}>
                  <SelectTrigger aria-label={t("billable")} id="rtl018-projects--id--time-page-tsx-10" className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t("yesBillable")}</SelectItem>
                    <SelectItem value="false">{t("noNonBillable")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t bg-background/80 px-6 py-4 backdrop-blur-sm">
            {drawerMode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 me-auto min-h-9 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="size-3.5 me-1.5" />
                {deleting ? t("deleting") : t("delete")}
              </Button>
            )}
            <div className={cn("flex items-center gap-3", drawerMode !== "edit" && "ms-auto")}>
              <Button className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full" type="button" variant="outline" onClick={closeDrawer}>{t("cancel")}</Button>
              <Button
                onClick={drawerMode === "edit" ? handleUpdate : handleAdd}
                disabled={saving}
                className={(drawerMode === "edit" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700") + " h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"}
              >
                {saving ? t("saving") : drawerMode === "edit" ? t("updateEntry") : t("addEntry")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DataTable
        columns={columns}
        data={filteredEntries}
        onRowClick={openEdit}
        emptyMessage={hasActiveFilters ? t("filteredEmpty") : t("empty")}
      />
    </div>
  );
}

// --- Helper Components ---

function StatCard({ label, value, sub, icon, accent }: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: "emerald" | "amber" | "blue";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn(
          "text-muted-foreground/50",
          accent === "emerald" && "text-emerald-500/60",
          accent === "amber" && "text-amber-500/60",
          accent === "blue" && "text-blue-500/60",
        )}>
          {icon}
        </span>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"><BidiText className="min-w-0 max-w-full">{label}</BidiText></p>
      </div>
      <p className={cn(
        "text-lg font-bold font-mono tabular-nums mt-0.5",
        accent === "emerald" && "text-emerald-600",
        accent === "amber" && "text-amber-600",
        accent === "blue" && "text-blue-600",
      )}><IdentifierText className="min-w-0 max-w-full">{value}</IdentifierText></p>
      <p className="text-[10px] text-muted-foreground"><BidiText className="min-w-0 max-w-full">{sub}</BidiText></p>
    </div>
  );
}

function getWeekDays() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const days: { date: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: d.toISOString().split("T")[0],
    });
  }
  return days;
}
