"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Plus, HardDriveDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContentReveal } from "@/components/ui/content-reveal";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { useTranslations } from "next-intl";
import { BackupList, BackupRestoreDescription, BackupDeleteDescription, type Backup } from "@/components/settings/data-management-content";
import { toast } from "sonner";

function getOrgId(): string | null {
  return localStorage.getItem("activeOrgId");
}

export default function BackupsPage() {
  const t = useTranslations("SettingsBackups");
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreBackup, setRestoreBackup] = useState<Backup | null>(null);
  const [deleteBackup, setDeleteBackup] = useState<Backup | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  function fetchBackups(p = page) {
    const orgId = getOrgId();
    if (!orgId) return;

    fetch(`/api/v1/backups?page=${p}&limit=${limit}`, {
      headers: { "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((data) => {
        setBackups(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        toast.error(t("failedToLoadBackups"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function confirmCreate() {
    const orgId = getOrgId();
    if (!orgId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/backups", {
        method: "POST",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) {
        throw new Error();
      }
      toast.success(t("backupCreated"));
      setCreateOpen(false);
      fetchBackups();
    } catch {
      toast.error(t("failedToCreateBackup"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDownloadSnapshot() {
    const orgId = getOrgId();
    if (!orgId) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/v1/backups/download-snapshot", {
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) {
        throw new Error();
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dubbl-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("snapshotDownloaded"));
    } catch {
      toast.error(t("failedToDownloadSnapshot"));
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload(file: File) {
    const orgId = getOrgId();
    if (!orgId) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/v1/backups/upload", {
        method: "POST",
        headers: { "x-organization-id": orgId },
        body: form,
      });
      if (!res.ok) throw new Error();
      toast.success(t("backupUploaded"));
      fetchBackups();
    } catch {
      toast.error(t("failedToUploadBackup"));
    }
  }

  async function handleDownload(backup: Backup) {
    const orgId = getOrgId();
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/backups/${backup.id}/download`, {
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date(backup.createdAt).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("failedToDownloadBackup"));
    }
  }

  async function confirmRestore() {
    if (!restoreBackup) return;
    const orgId = getOrgId();
    if (!orgId) return;
    setRestoringId(restoreBackup.id);
    try {
      const res = await fetch(`/api/v1/backups/${restoreBackup.id}/restore`, {
        method: "POST",
        headers: {
          "x-organization-id": orgId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("backupRestoredASnapshotOfYourPreviousDataWasSavedAutomatically"));
      setRestoreBackup(null);
      fetchBackups();
    } catch {
      toast.error(t("failedToRestoreBackup"));
    } finally {
      setRestoringId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteBackup) return;
    const orgId = getOrgId();
    if (!orgId) return;
    setDeletingId(deleteBackup.id);
    try {
      const res = await fetch(`/api/v1/backups/${deleteBackup.id}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error();
      toast.success(t("backupDeleted"));
      setDeleteBackup(null);
      fetchBackups();
    } catch {
      toast.error(t("failedToDeleteBackup"));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading && backups.length === 0) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("backups")}</h2>
          <p className="text-sm text-muted-foreground">{t("automatedDailySnapshotsOfYourOrganizationData")}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            disabled={downloading}
            onClick={handleDownloadSnapshot}
          >
            <HardDriveDownload className="me-1.5 size-3.5" />
            {downloading ? t("downloading") : t("downloadSnapshot")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="me-1.5 size-3.5" />
            {t("uploadBackup")}
          </Button>
          <Button
            size="sm"
            className="text-xs h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5"
            disabled={creating}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="me-1.5 size-3.5" />
            {t("createBackup")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <BackupList {...{ backups, page, totalPages, restoringId, deletingId, handleDownload, setRestoreBackup, setDeleteBackup, setPage }} />

      {/* Create backup confirmation */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createBackupQuestion")}</DialogTitle>
            <DialogDescription>{t("thisWillCreateAFullSnapshotOfAllYourOrganizationDataTheBackupCanBeUsedToRestoreYourDataLater")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">{t("cancel")}</Button>
            <Button onClick={confirmCreate} disabled={creating} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
              {creating ? t("creating") : t("createBackupAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore backup confirmation */}
      <Dialog open={!!restoreBackup} onOpenChange={(o) => !o && setRestoreBackup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("restoreFromBackupQuestion")}</DialogTitle>
            <DialogDescription>
              <BackupRestoreDescription date={restoreBackup ? new Date(restoreBackup.createdAt).toLocaleString() : ""} />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreBackup(null)} disabled={!!restoringId} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">{t("cancel")}</Button>
            <Button variant="destructive" onClick={confirmRestore} disabled={!!restoringId} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
              {restoringId ? t("restoring") : t("restoreBackupAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete backup confirmation */}
      <Dialog open={!!deleteBackup} onOpenChange={(o) => !o && setDeleteBackup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteBackupQuestion")}</DialogTitle>
            <DialogDescription>
              <BackupDeleteDescription date={deleteBackup ? new Date(deleteBackup.createdAt).toLocaleString() : ""} />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBackup(null)} disabled={!!deletingId} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">{t("cancel")}</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!!deletingId} className="h-auto min-h-9 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
              {deletingId ? t("deleting") : t("deleteBackupAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentReveal>
  );
}
