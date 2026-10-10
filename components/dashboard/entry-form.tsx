"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { journalEditorPreview, journalDecimal } from "@/lib/money/journal-display";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Line {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

interface EntryFormProps {
  accounts: Account[];
  onSubmit: (data: {
    date: string;
    description: string;
    reference: string;
    lines: ReturnType<typeof journalEditorPreview>["lines"];
  }) => void;
  loading?: boolean;
  initial?: {
    date: string;
    description: string;
    reference: string;
    lines: Line[];
  };
  onCancel?: () => void;
  submitLabel?: string;
}

export function EntryForm({ accounts, onSubmit, loading, initial, onCancel, submitLabel }: EntryFormProps) {
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState(initial?.description || "");
  const [reference, setReference] = useState(initial?.reference || "");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines || [
      { accountId: "", description: "", debit: "", credit: "" },
      { accountId: "", description: "", debit: "", credit: "" },
    ]
  );

  const preview = journalEditorPreview(lines);
  const { totalDebit, totalCredit, isBalanced } = preview;

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { accountId: "", description: "", debit: "", credit: "" },
    ]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBalanced) return;
    onSubmit({
      date,
      description,
      reference,
      lines: preview.lines,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Office rent payment"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reference">Reference (optional)</Label>
        <Input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. INV-001"
        />
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Entry lines</Label>
          <p className="text-xs text-muted-foreground">
            Each line is money in (debit) or money out (credit). The Debit and
            Credit columns must add up to the same total.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <div className="grid min-w-[600px] grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Account</span>
            <span>Description</span>
            <span className="text-right" title="The left side of an entry">
              Debit
            </span>
            <span className="text-right" title="The right side of an entry">
              Credit
            </span>
            <span />
          </div>
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid min-w-[600px] grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-b px-3 py-2 last:border-b-0"
            >
              <Select
                value={line.accountId}
                onValueChange={(v) => updateLine(i, "accountId", v)}
              >
                <SelectTrigger className="h-8 text-sm">
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
              <Input
                className="h-8 text-sm"
                value={line.description}
                onChange={(e) => updateLine(i, "description", e.target.value)}
                placeholder="Line memo"
              />
              <CurrencyInput
                size="sm"
                aria-label={`Debit for line ${i + 1}`}
                value={line.debit}
                onChange={(v) => updateLine(i, "debit", v)}
              />
              <CurrencyInput
                size="sm"
                aria-label={`Credit for line ${i + 1}`}
                value={line.credit}
                onChange={(v) => updateLine(i, "credit", v)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <div className="grid min-w-[600px] grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-t bg-muted/30 px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLine}
              className="w-fit text-xs"
            >
              <Plus className="mr-1 size-3" />
              Add line
            </Button>
            <span />
            <span className="text-right text-sm font-mono font-semibold tabular-nums">
              {journalDecimal(totalDebit)}
            </span>
            <span className="text-right text-sm font-mono font-semibold tabular-nums">
              {journalDecimal(totalCredit)}
            </span>
            <span />
          </div>
        </div>
        {preview.error && <p role="alert" className="text-xs text-red-600">{preview.error}</p>}
        {!preview.error && !isBalanced && totalDebit + totalCredit > 0n && (
          <p className={cn("text-xs font-medium text-red-600")}>
            Debits ({journalDecimal(totalDebit)}) must equal credits (
            {journalDecimal(totalCredit)})
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        ) : (
          <Button type="button" variant="outline" asChild>
            <Link href="/transactions">Cancel</Link>
          </Button>
        )}
        <Button
          type="submit"
          disabled={!isBalanced || loading}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? "Saving..." : (submitLabel || "Save Entry")}
        </Button>
      </div>
    </form>
  );
}
