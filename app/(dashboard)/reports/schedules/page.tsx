"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Plus, Mail, Clock, X, CalendarClock, Loader2 } from "lucide-react";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BackToReports, ReportHelp } from "../_components";

interface SavedReport {
  id: string;
  name: string;
  description: string | null;
}

interface ReportSchedule {
  id: string;
  savedReportId: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  format: "pdf" | "csv" | "xlsx";
  recipients: string[];
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  savedReport: SavedReport | null;
}

export default function ReportSchedulesPage() {
  const t = useTranslations("ScheduledReports");
  // Plain-language labels (the person reading this isn't an accountant).
  const frequencyLabels: Record<string, string> = {
    daily: t("daily"),
    weekly: t("weekly"),
    monthly: t("monthly"),
    quarterly: t("quarterly"),
  };

  const formatLabels: Record<string, string> = {
    pdf: t("pdf"),
    csv: t("csv"),
    xlsx: t("xlsx"),
  };

  const dayOfWeekLabels = [
    t("sunday"),
    t("monday"),
    t("tuesday"),
    t("wednesday"),
    t("thursday"),
    t("friday"),
    t("saturday"),
  ];

  function describeTiming(s: ReportSchedule): string {
    if (s.frequency === "weekly" && s.dayOfWeek != null) return t("weeklyTiming", { day: dayOfWeekLabels[s.dayOfWeek], time: s.timeOfDay });
    if ((s.frequency === "monthly" || s.frequency === "quarterly") && s.dayOfMonth != null) return t("monthlyTiming", { day: String(s.dayOfMonth), time: s.timeOfDay });
    return t("at", { time: s.timeOfDay });
  }

  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create form state.
  const [savedReportId, setSavedReportId] = useState("");
  const [frequency, setFrequency] = useState<ReportSchedule["frequency"]>("monthly");
  const [format, setFormat] = useState<ReportSchedule["format"]>("pdf");
  const [recipients, setRecipients] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [timeOfDay, setTimeOfDay] = useState("08:00");

  const orgId =
    typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch("/api/v1/report-schedules?limit=100", {
        headers: { "x-organization-id": orgId },
      }).then((r) => r.json()),
      fetch("/api/v1/reports/saved", {
        headers: { "x-organization-id": orgId },
      }).then((r) => r.json()),
    ])
      .then(([schedRes, savedRes]) => {
        if (cancelled) return;
        setSchedules(schedRes.data || []);
        setSavedReports(savedRes.reports || []);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setInitialLoad(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const resetForm = useCallback(() => {
    setSavedReportId("");
    setFrequency("monthly");
    setFormat("pdf");
    setRecipients("");
    setDayOfWeek("1");
    setDayOfMonth("1");
    setTimeOfDay("08:00");
    setFormError(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!orgId) return;
    setFormError(null);

    const emails = recipients
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (!savedReportId) {
      setFormError(t("pickReport"));
      return;
    }
    if (emails.length === 0) {
      setFormError(t("addRecipient"));
      return;
    }

    const body: Record<string, unknown> = {
      savedReportId,
      frequency,
      format,
      recipients: emails,
      timeOfDay,
    };
    if (frequency === "weekly") body.dayOfWeek = Number(dayOfWeek);
    if (frequency === "monthly" || frequency === "quarterly")
      body.dayOfMonth = Number(dayOfMonth);

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/report-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setFormError(t("createError"));
        return;
      }
      setDialogOpen(false);
      resetForm();
      setRefreshKey((k) => k + 1);
    } catch {
      setFormError(t("createError"));
    } finally {
      setSubmitting(false);
    }
  }, [
    orgId,
    savedReportId,
    frequency,
    format,
    recipients,
    dayOfWeek,
    dayOfMonth,
    timeOfDay,
    resetForm,
    t,
  ]);

  if (initialLoad) return <BrandLoader />;

  const hasSavedReports = savedReports.length > 0;

  return (
    <ContentReveal className="space-y-6">
      <BackToReports />

      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={!hasSavedReports}
        >
          <Plus className="mr-2 size-4" />
          {t("create")}
        </Button>
      </PageHeader>

      <ReportHelp>
        {t("help")}
      </ReportHelp>

      {loading ? (
        <BrandLoader className="h-48" />
      ) : !hasSavedReports ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center">
          <CalendarClock className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t("noReports")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t("noReportsHelp")}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/reports/custom">{t("build")}</Link>
          </Button>
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center">
          <Mail className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t("empty")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {t("emptyHelp")}
          </p>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            size="sm"
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="mr-2 size-4" />
            {t("create")}
          </Button>
        </div>
      ) : (
        <ContentReveal>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>{t("report")}</TableHead>
                  <TableHead className="w-40">{t("frequency")}</TableHead>
                  <TableHead className="w-44">{t("when")}</TableHead>
                  <TableHead className="w-36">{t("sentAs")}</TableHead>
                  <TableHead>{t("sentTo")}</TableHead>
                  <TableHead className="w-44">{t("nextSend")}</TableHead>
                  <TableHead className="w-24">{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.savedReport?.name || t("savedReport")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {frequencyLabels[s.frequency] || s.frequency}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {describeTiming(s)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatLabels[s.format] || s.format}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.recipients.join(", ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.nextRunAt
                        ? new Date(s.nextRunAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          s.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                        }
                      >
                        {s.isActive ? t("on") : t("paused")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ContentReveal>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("whichReport")}</Label>
              <Select value={savedReportId} onValueChange={setSavedReportId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("chooseReport")} />
                </SelectTrigger>
                <SelectContent>
                  {savedReports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("frequency")}</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) =>
                    setFrequency(v as ReportSchedule["frequency"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("daily")}</SelectItem>
                    <SelectItem value="weekly">{t("weekly")}</SelectItem>
                    <SelectItem value="monthly">{t("monthly")}</SelectItem>
                    <SelectItem value="quarterly">{t("quarterly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("sendAs")}</Label>
                <Select
                  value={format}
                  onValueChange={(v) =>
                    setFormat(v as ReportSchedule["format"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">{t("pdf")}</SelectItem>
                    <SelectItem value="csv">{t("csv")}</SelectItem>
                    <SelectItem value="xlsx">{t("xlsx")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {frequency === "weekly" && (
              <div className="space-y-1.5">
                <Label>{t("weekDay")}</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOfWeekLabels.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(frequency === "monthly" || frequency === "quarterly") && (
              <div className="space-y-1.5">
                <Label>{t("monthDay")}</Label>
                <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t("day", { day: String(d) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="timeOfDay">{t("time")}</Label>
              <Input
                id="timeOfDay"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recipients">{t("recipients")}</Label>
              <Input
                id="recipients"
                placeholder="name@example.com, another@example.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("recipientHelp")}
              </p>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                <X className="mt-0.5 size-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("schedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
