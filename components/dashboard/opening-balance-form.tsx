"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { journalDecimal } from "@/lib/money/journal-display";
import { openingBalancePreview, type OpeningBalanceRow, type OpeningBalanceWrite } from "@/lib/money/opening-balance-ui";

type Props = {
  accounts: { id: string; code: string; name: string }[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: { date: string; balances: OpeningBalanceWrite[] }) => void | Promise<void>;
  initialRows?: OpeningBalanceRow[];
};

export function OpeningBalanceForm({ accounts, saving, onCancel, onSubmit, initialRows }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<OpeningBalanceRow[]>(initialRows ?? [
    { accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" },
  ]);
  const preview = openingBalancePreview(rows);
  function updateRow(index: number, field: keyof OpeningBalanceRow, value: string) {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  function addRow() { setRows(prev => [...prev, { accountId: "", debit: "", credit: "" }]); }
  function removeRow(index: number) { if (rows.length > 2) setRows(prev => prev.filter((_, i) => i !== index)); }
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (preview.isBalanced && date && !saving) void onSubmit({ date, balances: preview.balances });
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-6 px-4 py-4 sm:px-6 sm:py-5">
        <div className="space-y-2">
          <Label>As of date</Label>
          <DatePicker value={date} onChange={setDate} placeholder="Opening date" />
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Account balances (USD)</Label>
            <p className="text-xs text-muted-foreground">
              Each line is money in (debit) or money out (credit). The Debit and
              Credit columns must add up to the same total.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <div className="grid min-w-[600px] grid-cols-[1fr_120px_120px_40px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Account</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span />
            </div>
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid min-w-[600px] grid-cols-[1fr_120px_120px_40px] gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <Select value={row.accountId} onValueChange={(v) => updateRow(i, "accountId", v)}>
                  <SelectTrigger aria-label={`Account for line ${i + 1}`} className="h-8 text-sm">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CurrencyInput aria-label={`Debit for line ${i + 1}`} aria-invalid={!!preview.error} size="sm" value={row.debit} onChange={(v) => updateRow(i, "debit", v)} />
                <CurrencyInput aria-label={`Credit for line ${i + 1}`} aria-invalid={!!preview.error} size="sm" value={row.credit} onChange={(v) => updateRow(i, "credit", v)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 2}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <div className="grid min-w-[600px] grid-cols-[1fr_120px_120px_40px] gap-2 border-t bg-muted/30 px-3 py-2">
              <Button type="button" variant="ghost" size="sm" onClick={addRow} className="w-fit text-xs">
                <Plus className="mr-1 size-3" />
                Add line
              </Button>
              <span className="text-right text-sm font-mono font-semibold tabular-nums">{journalDecimal(preview.totalDebit)}</span>
              <span className="text-right text-sm font-mono font-semibold tabular-nums">{journalDecimal(preview.totalCredit)}</span>
              <span />
            </div>
          </div>
          {preview.error && <p role="alert" className="text-xs font-medium text-red-600">{preview.error}</p>}
          {!preview.isBalanced && preview.totalDebit + preview.totalCredit > 0n && (
            <p className="text-xs font-medium text-red-600">
              Debits ({journalDecimal(preview.totalDebit)}) must equal credits ({journalDecimal(preview.totalCredit)})
            </p>
          )}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/80 px-4 py-3 sm:px-6 sm:py-4 backdrop-blur-sm">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || !date || !preview.isBalanced} className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? "Saving..." : "Set opening balances"}
        </Button>
      </div>
    </form>
  );
}
