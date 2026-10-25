"use client";

import { clientPdf, downloadBlob } from "@/lib/api/client-response";

import { useState, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentTemplateForm, DocumentTemplateList, DocumentTemplatePreview, type Template } from "@/components/settings/document-template-content";
import { requireTemplateResponse, templateFailureMessage } from "@/components/settings/document-template-request";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { useConfirm } from "@/lib/hooks/use-confirm";
import { useTranslations } from "next-intl";

export default function DocumentTemplatesPage() {
  const st = useTranslations("SettingsDocumentTemplates");
  const errors = useTranslations("SettingsErrors");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("invoice");
  const [logoUrl, setLogoUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#10b981");
  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(true);
  const [showPaymentTerms, setShowPaymentTerms] = useState(true);
  const [notes, setNotes] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  function getHeaders() {
    const orgId = localStorage.getItem("activeOrgId") || "";
    return { "x-organization-id": orgId, "Content-Type": "application/json" };
  }

  const fetchTemplates = useCallback(() => {
    fetch("/api/v1/document-templates", { headers: getHeaders() })
      .then((r) => requireTemplateResponse(r, errors, st("loadFailed")))
      .then((r) => r.json())
      .then((data) => { if (data.templates) setTemplates(data.templates); })
      .catch((error: unknown) => toast.error(templateFailureMessage(error, st("loadFailed"))))
      .finally(() => setLoading(false));
  }, [errors, st]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function openCreate() {
    setEditing(null);
    setName("");
    setType("invoice");
    setLogoUrl("");
    setAccentColor("#10b981");
    setHeaderHtml("");
    setFooterHtml("");
    setShowTaxBreakdown(true);
    setShowPaymentTerms(true);
    setNotes("");
    setBankDetails("");
    setPaymentInstructions("");
    setIsDefault(false);
    setSheetOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setName(t.name);
    setType(t.type);
    setLogoUrl(t.logoUrl || "");
    setAccentColor(t.accentColor || "#10b981");
    setHeaderHtml(t.headerHtml || "");
    setFooterHtml(t.footerHtml || "");
    setShowTaxBreakdown(t.showTaxBreakdown);
    setShowPaymentTerms(t.showPaymentTerms);
    setNotes(t.notes || "");
    setBankDetails(t.bankDetails || "");
    setPaymentInstructions(t.paymentInstructions || "");
    setIsDefault(t.isDefault);
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name,
      type,
      logoUrl: logoUrl || null,
      accentColor,
      headerHtml: headerHtml || null,
      footerHtml: footerHtml || null,
      showTaxBreakdown,
      showPaymentTerms,
      notes: notes || null,
      bankDetails: bankDetails || null,
      paymentInstructions: paymentInstructions || null,
      isDefault,
    };

    try {
      if (editing) {
        await requireTemplateResponse(await fetch(`/api/v1/document-templates/${editing.id}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        }), errors, st("saveFailed"));
        toast.success(st("updated"));
      } else {
        await requireTemplateResponse(await fetch("/api/v1/document-templates", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        }), errors, st("saveFailed"));
        toast.success(st("created"));
      }

      setSheetOpen(false);
      fetchTemplates();
    } catch (error) {
      toast.error(templateFailureMessage(error, st("saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: Template) {
    await confirm({
      title: st("deleteTitle", { name: t.name }),
      description: st("deleteDescription"),
      confirmLabel: st("delete"),
      cancelLabel: st("cancel"),
      destructive: true,
      onConfirm: async () => {
        try {
          await requireTemplateResponse(await fetch(`/api/v1/document-templates/${t.id}`, {
            method: "DELETE",
            headers: getHeaders(),
          }), errors, st("deleteFailed"));
          toast.success(st("deleted"));
          fetchTemplates();
        } catch (error) {
          toast.error(templateFailureMessage(error, st("deleteFailed")));
          throw new Error(st("deleteFailed")); // Keep the confirmation open for retry.
        }
      },
    });
  }

  async function handlePreview(t: Template) {
    setPreviewHtml(null); setPreviewTemplateId(null);
    try {
      const res = await requireTemplateResponse(await fetch(`/api/v1/document-templates/${t.id}/preview`, {
        method: "POST", headers: getHeaders(),
      }), errors, st("previewFailed"));
      if (!res.headers.get("content-type")?.startsWith("text/html")) throw new Error(st("invalidPreview"));
      setPreviewHtml(await res.text()); setPreviewTemplateId(t.id);
    } catch (error) { toast.error(templateFailureMessage(error, st("previewFailed"))); }
  }

  async function handleDownloadSamplePdf() {
    if (!previewTemplateId) return;
    try {
      const blob = await clientPdf(await requireTemplateResponse(await fetch(`/api/v1/document-templates/${previewTemplateId}/preview?format=pdf`, {
        method: "POST", headers: getHeaders(),
      }), errors, st("downloadFailed")));
      downloadBlob(blob, "sample-invoice.pdf");
    } catch (error) { toast.error(templateFailureMessage(error, st("downloadFailed"))); }
  }

  if (loading) return <BrandLoader />;

  return (
    <ContentReveal>
      <div className="space-y-6">
        <DocumentTemplateList templates={templates} openCreate={openCreate} openEdit={openEdit} handlePreview={handlePreview} handleDelete={handleDelete} />

        {/* Create/Edit Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="end" className="sm:max-w-lg w-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? st("editTemplate") : st("newTemplate")}</SheetTitle>
            </SheetHeader>

            <DocumentTemplateForm
              editing={editing}
              saving={saving}
              setSheetOpen={setSheetOpen}
              handleSave={handleSave}
              name={name}
              setName={setName}
              type={type}
              setType={setType}
              logoUrl={logoUrl}
              setLogoUrl={setLogoUrl}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              headerHtml={headerHtml}
              setHeaderHtml={setHeaderHtml}
              footerHtml={footerHtml}
              setFooterHtml={setFooterHtml}
              showTaxBreakdown={showTaxBreakdown}
              setShowTaxBreakdown={setShowTaxBreakdown}
              showPaymentTerms={showPaymentTerms}
              setShowPaymentTerms={setShowPaymentTerms}
              notes={notes}
              setNotes={setNotes}
              bankDetails={bankDetails}
              setBankDetails={setBankDetails}
              paymentInstructions={paymentInstructions}
              setPaymentInstructions={setPaymentInstructions}
              isDefault={isDefault}
              setIsDefault={setIsDefault}
            />
          </SheetContent>
        </Sheet>

        {/* Preview Dialog */}
        <Dialog open={!!previewHtml} onOpenChange={() => { setPreviewHtml(null); setPreviewTemplateId(null); }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DialogTitle>{st("previewTitle")}</DialogTitle>
                <Button variant="outline" size="sm" onClick={handleDownloadSamplePdf} className="gap-1.5 h-auto min-h-8 max-w-full whitespace-normal [overflow-wrap:anywhere] py-1.5">
                  <Download className="size-3.5" />
                  {st("downloadSample")}
                </Button>
              </div>
            </DialogHeader>
            <DocumentTemplatePreview html={previewHtml} />
          </DialogContent>
        </Dialog>

        {confirmDialog}
      </div>
    </ContentReveal>
  );
}
