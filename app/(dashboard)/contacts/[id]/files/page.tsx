"use client";

import { IdentifierText } from "@/components/ui/bidi-text";

import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Paperclip,
  Lock,
  Trash2,
  Upload,
  Download,
  Loader2,
} from "lucide-react";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useContactContext, getOrgId } from "../layout";
import type { ContactFile } from "../layout";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContactFilesPage() {
  const t = useTranslations("ContactFiles");
  const { id } = useParams<{ id: string }>();
  const { confirm } = useContactContext();

  const [files, setFiles] = useState<ContactFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileVisibility, setFileVisibility] = useState<"organization" | "private">("organization");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) return;
    setFilesLoading(true);
    try {
      const res = await fetch(`/api/v1/contacts/${id}/files`, {
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!Array.isArray(data.data)) throw new Error();
      setFiles(data.data);
    } catch {
      toast.error(t("readFailed"));
    } finally {
      setFilesLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  async function handleFileUpload(file: File) {
    const orgId = getOrgId();
    if (!orgId) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/v1/contacts/${id}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          visibility: fileVisibility,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data.uploadUrl !== "string" || !data.uploadUrl) throw new Error();
      const upload = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upload.ok) throw new Error();
      toast.success(t("uploadSuccess"));
      fetchFiles();
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteFile(docId: string) {
    const orgId = getOrgId();
    if (!orgId) return;
    const ok = await confirm({ title: t("deleteTitle"), description: t("deleteDescription") });
    if (!ok) return;
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, {
        method: "DELETE",
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error();
      toast.success(t("deleteSuccess"));
      fetchFiles();
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  async function handleDownloadFile(docId: string) {
    const orgId = getOrgId();
    if (!orgId) return;
    try {
      const res = await fetch(`/api/v1/documents/${docId}/download`, {
        headers: { "x-organization-id": orgId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (typeof data.downloadUrl !== "string" || !data.downloadUrl) throw new Error();
      window.open(data.downloadUrl, "_blank");
    } catch {
      toast.error(t("downloadFailed"));
    }
  }

  return (
    <ContentReveal key="files">
      <div className="space-y-6">
        <Section title={t("title")} description={t("description")}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Select value={fileVisibility} onValueChange={(v: "organization" | "private") => setFileVisibility(v)}>
                  <SelectTrigger aria-label={t("visibility")} className="h-auto min-h-8 w-[130px] text-xs whitespace-normal [overflow-wrap:anywhere] data-[size=default]:h-auto data-[size=sm]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal min-w-0 max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organization">{t("shared")}</SelectItem>
                    <SelectItem value="private">{t("private")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="me-2 size-3.5 animate-spin" />
                  ) : (
                    <Upload className="me-2 size-3.5" />
                  )}
                  {uploading ? t("uploading") : t("upload")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>
              {files.length > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  {t("count", { count: files.length })}
                </p>
              )}
            </div>

            {filesLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!filesLoading && files.length === 0 && (
              <ContentReveal key="files-empty">
                <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed">
                  <Paperclip className="mb-2 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    {t("empty")}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {t("emptyHint")}
                  </p>
                </div>
              </ContentReveal>
            )}

            {!filesLoading && files.length > 0 && (
              <ContentReveal key="files-list">
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t("name")}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t("size")}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t("visibility")}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t("uploaded")}</th>
                        <th className="px-3 py-2 text-end text-xs font-medium text-muted-foreground" />
                      </tr>
                    </thead>
                    <tbody>
                      {files.map((file) => (
                        <tr key={file.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleDownloadFile(file.id)}
                              className="text-sm font-medium text-foreground hover:underline text-start h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] min-w-0 max-w-full"
                            >
                              <IdentifierText className="min-w-0 max-w-full">{file.fileName}</IdentifierText>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <IdentifierText className="min-w-0 max-w-full">{formatFileSize(file.fileSize)}</IdentifierText>
                          </td>
                          <td className="px-3 py-2">
                            {file.visibility === "private" ? (
                              <Badge variant="outline" className="text-[11px] gap-1 h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">
                                <Lock className="size-3" />
                                {t("private")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[11px] h-auto min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">
                                {t("shared")}
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <IdentifierText className="min-w-0 max-w-full">{new Date(file.createdAt).toLocaleDateString()}</IdentifierText>
                          </td>
                          <td className="px-3 py-2 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                aria-label={t("download")}
                                onClick={() => handleDownloadFile(file.id)}
                              >
                                <Download className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                aria-label={t("deleteTitle")}
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ContentReveal>
            )}
          </div>
        </Section>
      </div>
    </ContentReveal>
  );
}
