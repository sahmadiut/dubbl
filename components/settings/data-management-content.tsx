"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Download, RotateCcw, Trash2, X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatBackupSize, formatEntitySummary, backupTypeLabel, importEntityLabel, importStatusLabel, trashEntityLabel, trashRelativeTime } from "@/i18n/data-presentation";

export interface Backup {
  id: string;
  type: "scheduled" | "manual" | "uploaded";
  status: "pending" | "completed" | "failed";
  sizeBytes: number | null;
  entityCounts: Record<string, number> | null;
  createdAt: string;
  expiresAt: string | null;
}
export interface TrashItem { id: string; name: string | null; entityType: string; label: string; deletedAt: string }
export interface ImportJob { id: string; type: string; fileName: string; status: string; totalRows: number; processedRows: number; errorRows: number; createdAt: string }

export function BackupRestoreDescription({ date }: { date: string }) {
  const t = useTranslations("SettingsBackups");
  return <>{t("restoreDescription", { date })}</>;
}

export function BackupDeleteDescription({ date }: { date: string }) {
  const t = useTranslations("SettingsBackups");
  return <>{t("deleteDescription", { date })}</>;
}

export function TrashDeleteDescription({ item }: { item: TrashItem | null }) {
  const t = useTranslations("SettingsTrash");
  return <>{t("deleteDescription", { name: item?.name || (item ? trashEntityLabel(t, item.entityType) : "") })}</>;
}

export function TrashEmptyDescription() {
  const t = useTranslations("SettingsTrash");
  return <>{t("emptyDescription")}</>;
}

export function BackupList({ backups, page, totalPages, restoringId, deletingId, handleDownload, setRestoreBackup, setDeleteBackup, setPage }: {
  backups: Backup[]; page: number; totalPages: number; restoringId: string | null; deletingId: string | null;
  handleDownload: (backup: Backup) => void; setRestoreBackup: (backup: Backup) => void; setDeleteBackup: (backup: Backup) => void;
  setPage: (update: (page: number) => number) => void;
}) {
  const t = useTranslations("SettingsBackups");
  const entities = useTranslations("SettingsDataEntities");
  return <>
      {backups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-3">
            <Database className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">{t("noBackupsYet")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("createABackupOrEnableScheduledBackupsToGetStarted")}</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_80px_1.5fr_1fr_auto] gap-3 px-4 py-2.5 border-b bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground">{t("type")}</span>
              <span className="text-xs font-medium text-muted-foreground">{t("date")}</span>
              <span className="text-xs font-medium text-muted-foreground">{t("size")}</span>
              <span className="text-xs font-medium text-muted-foreground">{t("entities")}</span>
              <span className="text-xs font-medium text-muted-foreground">{t("expires")}</span>
              <span className="text-xs font-medium text-muted-foreground">{t("actions")}</span>
            </div>

            {/* Table rows */}
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="grid grid-cols-[1fr_1fr_80px_1.5fr_1fr_auto] gap-3 px-4 py-2.5 border-b last:border-b-0 items-center hover:bg-muted/30 transition-colors"
              >
                <div>
                  <Badge
                    variant="outline"
                    className={
                      backup.type === "manual"
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        : backup.type === "uploaded"
                          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
                          : ""
                    }
                  >
                    {backupTypeLabel(t, backup.type)}
                  </Badge>
                </div>

                <span className="text-sm tabular-nums">
                  {new Date(backup.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>

                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatBackupSize(backup.sizeBytes)}
                </span>

                <span className="text-xs text-muted-foreground truncate">
                  {formatEntitySummary(entities, backup.entityCounts)}
                </span>

                <span className="text-xs text-muted-foreground tabular-nums">
                  {backup.expiresAt
                    ? new Date(backup.expiresAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "-"}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(backup)}
                    title={t("download")}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={restoringId === backup.id}
                    onClick={() => setRestoreBackup(backup)}
                    title={t("restore")}
                  >
                    <RotateCcw className={`size-3.5 ${restoringId === backup.id ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    disabled={deletingId === backup.id}
                    onClick={() => setDeleteBackup(backup)}
                    title={t("delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {t("pageOf", { page, total: totalPages })}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
  </>;
}

export function TrashList({ items, handleRestore, setDeleteItem }: {
  items: TrashItem[]; handleRestore: (item: TrashItem) => void; setDeleteItem: (item: TrashItem) => void;
}) {
  const t = useTranslations("SettingsTrash");
  return <>
      {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Trash2 className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t("trashIsEmpty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("deletedItemsWillAppearHere")}</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("deleted")}</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.entityType}-${item.id}`}>
                    <TableCell className="font-medium text-sm">
                      {item.name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {trashEntityLabel(t, item.entityType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {trashRelativeTime(t, item.deletedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title={t("restore")}
                          onClick={() => handleRestore(item)}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-600"
                          title={t("deletePermanently")}
                          onClick={() => setDeleteItem(item)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
  </>;
}

export function ImportJobHistory({ jobs }: { jobs: ImportJob[] }) {
  const t = useTranslations("SettingsImportExport");
  return <>
      {jobs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">{t("recentImports")}</h4>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("file")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="text-right">{t("rows")}</TableHead>
                      <TableHead className="text-right">{t("errors")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map(job => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {importEntityLabel(t, job.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {job.fileName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {job.status === "completed" ? (
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                            ) : job.status === "failed" ? (
                              <XCircle className="size-3.5 text-destructive" />
                            ) : (
                              <Clock className="size-3.5 text-muted-foreground" />
                            )}
                            <span className="text-xs capitalize">{importStatusLabel(t, job.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {job.processedRows}/{job.totalRows}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {job.errorRows || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(job.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
  </>;
}
