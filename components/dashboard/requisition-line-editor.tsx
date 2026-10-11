"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { procurementPreview, procurementMoney } from "@/lib/money/procurement-ui";
import type { DocumentEditorLine } from "@/lib/money/document-editor";

export const emptyRequisitionLine = (): DocumentEditorLine => ({ description: "", quantity: "1", unitPrice: "", accountId: "", taxRateId: "" });
export function RequisitionLineEditor({ lines, onChange, currencyCode }: {
  lines: DocumentEditorLine[]; onChange: (lines: DocumentEditorLine[]) => void; currencyCode: string;
}) {
  const preview = procurementPreview(lines, currencyCode, [], "requisition");
  const update = (index: number, field: keyof DocumentEditorLine, value: string) => onChange(lines.map((line, i) => i === index ? { ...line, [field]: value } : line));
  return <div className="space-y-3">
    <Label>Line items</Label>
    {lines.map((line, i) => <div key={i} className="rounded-lg border p-3 space-y-2">
      <Input aria-label={`Description for line ${i + 1}`} placeholder="Description" value={line.description} onChange={e => update(i, "description", e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Quantity</Label><Input aria-label={`Quantity for line ${i + 1}`} inputMode="decimal" value={line.quantity} onChange={e => update(i, "quantity", e.target.value)} /></div>
        <div><Label>Unit price ({currencyCode})</Label><Input aria-label={`Price for line ${i + 1}`} inputMode="decimal" value={line.unitPrice} onChange={e => update(i, "unitPrice", e.target.value)} /></div>
      </div>
      {lines.length > 1 && <Button type="button" variant="ghost" size="sm" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, index) => index !== i))}><Trash2 className="size-4" /></Button>}
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, emptyRequisitionLine()])}><Plus className="mr-2 size-4" />Add line</Button>
    <p className="text-xs text-muted-foreground">Requisitions calculate no tax.</p>
    {preview.error ? <p role="alert" className="text-sm text-red-600">{preview.error}</p> : <p className="text-right font-mono break-all">Preview total: {procurementMoney(preview.total, currencyCode)}</p>}
  </div>;
}
