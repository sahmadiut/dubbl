"use client";

import { BidiText } from "@/components/ui/bidi-text";

import { adminTemplateLabel } from "@/i18n/admin-labels";
import { useTranslations } from "next-intl";

import { useState, useEffect, useCallback } from "react";
import { ContentReveal } from "@/components/ui/content-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Eye, Monitor } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  name: string;
}

export default function AdminEmailPreviewPage() {
  const t = useTranslations("Admin");

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [emailHtml, setEmailHtml] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/email-preview");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      toast.error(t("failedToLoadEmailTemplates"));
    } finally {
      setLoadingTemplates(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const loadPreview = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `/api/v1/admin/email-preview?template=${templateId}`
      );
      const data = await res.json();
      setEmailHtml(data.html || "");
    } catch {
      toast.error(t("failedToLoadPreview"));
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <ContentReveal>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">{t("emailPreview")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("previewEmailTemplatesWithSampleData")}
          </p>
        </div>

        {loadingTemplates ? (
          <Skeleton className="h-10 w-full rounded-lg" />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedTemplate} onValueChange={loadPreview}>
              <SelectTrigger aria-label={t("selectATemplate")} className="w-full sm:w-64 data-[size=default]:h-auto data-[size=sm]:h-auto min-h-8 whitespace-normal *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal">
                <SelectValue placeholder={t("selectATemplate")} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <BidiText>{adminTemplateLabel(t, template.id, template.name)}</BidiText>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <Button
                variant="outline"
                size="sm"
                className="h-auto min-h-8 whitespace-normal [overflow-wrap:anywhere] gap-1.5 shrink-0"
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (win) {
                    win.document.write(emailHtml);
                    win.document.close();
                  }
                }}
                disabled={!emailHtml}
              >
                <Monitor className="size-3.5" />
                {t("fullView")}
              </Button>
            )}
          </div>
        )}

        {!selectedTemplate && !loadingTemplates && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20">
            <Eye className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              {t("selectATemplateToPreview")}
            </p>
          </div>
        )}

        {loadingPreview && (
          <Skeleton className="h-[600px] w-full rounded-lg" />
        )}

        {emailHtml && !loadingPreview && (
          <div className="rounded-lg border overflow-hidden bg-white">
            <iframe
              srcDoc={emailHtml}
              className="w-full h-[600px] border-0"
              title={t("emailPreviewFrame")}
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </ContentReveal>
  );
}
