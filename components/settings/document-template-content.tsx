"use client";

import {
  Plus,
  FileText,
  Trash2,
  MoreHorizontal,
  Eye,
  Pencil,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SheetFooter } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";

export interface Template {
  id: string;
  name: string;
  type: string;
  logoUrl: string | null;
  accentColor: string | null;
  headerHtml: string | null;
  footerHtml: string | null;
  showTaxBreakdown: boolean;
  showPaymentTerms: boolean;
  notes: string | null;
  bankDetails: string | null;
  paymentInstructions: string | null;
  isDefault: boolean;
  createdAt: string;
}

export function documentTemplateTypes(st: ReturnType<typeof useTranslations<"SettingsDocumentTemplates">>) {
  return { invoice: st("invoice"), quote: st("quote"), receipt: st("receipt"), payslip: st("payslip"), purchase_order: st("purchaseOrder") };
}

export function documentTemplateTypeLabel(st: ReturnType<typeof useTranslations<"SettingsDocumentTemplates">>, type: string) {
  const labels = documentTemplateTypes(st);
  return Object.hasOwn(labels, type) ? labels[type as keyof typeof labels] : type;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 pb-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{children}</p>
    </div>
  );
}

interface FormProps {
  editing: Template | null;
  saving: boolean;
  setSheetOpen: (open: boolean) => void;
  handleSave: () => void;
  name: string;
  setName: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  logoUrl: string;
  setLogoUrl: (value: string) => void;
  accentColor: string;
  setAccentColor: (value: string) => void;
  headerHtml: string;
  setHeaderHtml: (value: string) => void;
  footerHtml: string;
  setFooterHtml: (value: string) => void;
  showTaxBreakdown: boolean;
  setShowTaxBreakdown: (value: boolean) => void;
  showPaymentTerms: boolean;
  setShowPaymentTerms: (value: boolean) => void;
  notes: string;
  setNotes: (value: string) => void;
  bankDetails: string;
  setBankDetails: (value: string) => void;
  paymentInstructions: string;
  setPaymentInstructions: (value: string) => void;
  isDefault: boolean;
  setIsDefault: (value: boolean) => void;
}

export function DocumentTemplateForm({
  editing,
  saving,
  setSheetOpen,
  handleSave,
  name,
  setName,
  type,
  setType,
  logoUrl,
  setLogoUrl,
  accentColor,
  setAccentColor,
  headerHtml,
  setHeaderHtml,
  footerHtml,
  setFooterHtml,
  showTaxBreakdown,
  setShowTaxBreakdown,
  showPaymentTerms,
  setShowPaymentTerms,
  notes,
  setNotes,
  bankDetails,
  setBankDetails,
  paymentInstructions,
  setPaymentInstructions,
  isDefault,
  setIsDefault,
}: FormProps) {
  const st = useTranslations("SettingsDocumentTemplates");
  return (<>
    <div className="flex-1 space-y-4 px-4 pb-4">
      {/* General */}
      <SectionHeading>{st("general")}</SectionHeading>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={st("namePlaceholder")} />
      </div>
      {!editing && (
        <div className="space-y-1.5">
          <Label className="text-xs">{st("type")}</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(documentTemplateTypes(st)).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs">{st("defaultTemplate")}</Label>
          <p className="text-[11px] text-muted-foreground">{st("defaultHelp")}</p>
        </div>
        <Switch checked={isDefault} onCheckedChange={setIsDefault} />
      </div>

      {/* Branding */}
      <SectionHeading>{st("branding")}</SectionHeading>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("accentColor")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("accentHelp")}</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="size-8 rounded border cursor-pointer"
          />
          <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="font-mono" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("logoUrl")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("logoHelp")}</p>
        <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder={st("logoPlaceholder")} />
      </div>

      {/* Display Options */}
      <SectionHeading>{st("displayOptions")}</SectionHeading>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs">{st("showTax")}</Label>
          <p className="text-[11px] text-muted-foreground">{st("taxHelp")}</p>
        </div>
        <Switch checked={showTaxBreakdown} onCheckedChange={setShowTaxBreakdown} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs">{st("showPaymentTerms")}</Label>
          <p className="text-[11px] text-muted-foreground">{st("paymentTermsHelp")}</p>
        </div>
        <Switch checked={showPaymentTerms} onCheckedChange={setShowPaymentTerms} />
      </div>

      {/* Payment Information */}
      <SectionHeading>{st("paymentInformation")}</SectionHeading>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("bankDetails")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("bankHelp")}</p>
        <Textarea value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder={st("bankPlaceholder", { iban: "DE89 3704 0044 0532 0130 00", swift: "COBADEFFXXX", bank: "Commerzbank" })} rows={3} className="text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("paymentInstructions")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("instructionsHelp")}</p>
        <Textarea value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder={st("instructionsPlaceholder", { invoiceNumber: "{{invoiceNumber}}" })} rows={2} className="text-xs" />
      </div>

      {/* Content */}
      <SectionHeading>{st("content")}</SectionHeading>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("notes")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("notesHelp")}</p>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={st("notesPlaceholder")} rows={3} className="text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("headerHtml")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("headerHelp")}</p>
        <Textarea value={headerHtml} onChange={(e) => setHeaderHtml(e.target.value)} placeholder={`<p style="color: #6b7280;">${st("headerSample")}</p>`} rows={3} className="font-mono text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{st("footerHtml")}</Label>
        <p className="text-[11px] text-muted-foreground">{st("footerHelp")}</p>
        <Textarea value={footerHtml} onChange={(e) => setFooterHtml(e.target.value)} placeholder={`<p style="font-size: 10px; color: #9ca3af;">${st("footerSample")}</p>`} rows={3} className="font-mono text-xs" />
      </div>

      {/* Template Variables Reference */}
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-[11px] font-semibold text-muted-foreground mb-2">{st("variables")}</p>
        <p className="text-[10px] text-muted-foreground mb-2">{st("variablesHelp")}</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "orgName", "orgAddress", "orgTaxId", "orgPhone", "orgEmail", "orgRegistrationNumber",
            "invoiceNumber", "issueDate", "dueDate", "reference",
            "contactName", "contactEmail", "contactAddress", "contactTaxNumber",
            "subtotal", "taxTotal", "total", "currency",
          ].map((v) => (
            <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{`{{${v}}}`}</code>
          ))}
        </div>
      </div>
    </div>

    <SheetFooter>
      <Button variant="outline" onClick={() => setSheetOpen(false)}>{st("cancel")}</Button>
      <Button onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? st("saving") : editing ? st("update") : st("create")}
      </Button>
    </SheetFooter>
  </>);
}

interface ListProps {
  templates: Template[];
  openCreate: () => void;
  openEdit: (template: Template) => void;
  handlePreview: (template: Template) => void;
  handleDelete: (template: Template) => void;
}

export function DocumentTemplateList({ templates, openCreate, openEdit, handlePreview, handleDelete }: ListProps) {
  const st = useTranslations("SettingsDocumentTemplates");
  return (<>
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{st("documentTemplates")}</h2>
        <p className="text-sm text-muted-foreground">
          {st("description")}
        </p>
      </div>
      <Button size="sm" className="h-7 text-xs gap-1" onClick={openCreate}>
        <Plus className="size-3" />
        {st("newTemplate")}
      </Button>
    </div>

    {templates.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <FileText className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-medium">{st("noTemplates")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {st("emptyDescription")}
        </p>
        <Button size="sm" className="mt-4" onClick={openCreate}>
          {st("createTemplate")}
        </Button>
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border bg-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium truncate">{t.name}</h3>
                  {t.isDefault && (
                    <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
                      <Star className="size-2.5 mr-0.5" /> {st("default")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {documentTemplateTypeLabel(st, t.type)}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="size-7 p-0" aria-label={st("actions")}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePreview(t)}>
                    <Eye className="size-4" /> {st("preview")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openEdit(t)}>
                    <Pencil className="size-4" /> {st("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => handleDelete(t)}>
                    <Trash2 className="size-4" /> {st("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="size-4 rounded border"
                style={{ backgroundColor: t.accentColor || "#10b981" }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                {t.accentColor || "#10b981"}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </>);
}

export function DocumentTemplatePreview({ html }: { html: string | null }) {
  const st = useTranslations("SettingsDocumentTemplates");
  return html ? <iframe srcDoc={html} className="w-full h-[600px] border rounded" title={st("previewTitle")} /> : null;
}
