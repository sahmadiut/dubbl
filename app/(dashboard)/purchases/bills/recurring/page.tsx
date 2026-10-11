"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";
import { ContactPicker } from "@/components/dashboard/contact-picker";
import { LineItemsEditor, type LineItem } from "@/components/dashboard/line-items-editor";
import { CurrencySelect } from "@/components/ui/currency-select";
import { recurringBillEditorPayload, recurringBillUiDocument } from "@/lib/money/recurring-bill-ui";
import { invoiceUiMoney } from "@/lib/money/invoice-ui";

interface RecurringTemplate {
  id: string;
  name: string;
  frequency: string;
  status: string;
  nextRunDate: string | null;
  reference: string | null;
  currencyCode: string;
  lines: { id: string; description: string; quantity: number; discountPercent: number; unitPrice: bigint; grossMinor: bigint }[];
  contact: { name: string } | null;
}

const statusColors: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  paused:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completed:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Finished",
};

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  annual: "Annual",
};

const emptyLine = (): LineItem => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  accountId: "",
  taxRateId: "",
});

export default function RecurringBillsPage() {
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") || "" : "";
  return <RecurringBillsWorkspace key={orgId} orgId={orgId} />;
}

function RecurringBillsWorkspace({ orgId }: { orgId: string }) {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle("Purchases · Recurring Bills");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxOccurrences, setMaxOccurrences] = useState("");
  const [reference, setReference] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [validLines, setValidLines] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const orgHeaders = useCallback(() => ({ "x-organization-id": orgId }), [orgId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/v1/recurring?type=bill", { headers: orgHeaders(), signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error("Unable to load recurring bills"); return r.json(); })
      .then(data => { if (!controller.signal.aborted) setTemplates((data.data || []).map(recurringBillUiDocument)); })
      .catch(() => { if (!controller.signal.aborted) { setTemplates([]); setError("Unable to load recurring bill amounts"); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgHeaders, reload]);

  const resetForm = () => {
    setName("");
    setContactId("");
    setFrequency("monthly");
    setStartDate("");
    setEndDate("");
    setMaxOccurrences("");
    setReference("");
    setLines([emptyLine()]);
    setCurrencyCode("USD");
    setValidLines(false);
    setError("");
  };

  const handleSubmit = async () => {
    if (!name || !contactId || !startDate || lines.length === 0) return;

    if (!validLines) { setError("Check the currency and line amounts"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/recurring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...orgHeaders(),
        },
        body: JSON.stringify(recurringBillEditorPayload({ name, contactId, frequency, startDate, endDate, maxOccurrences, reference, currencyCode }, lines)),
      });

      if (res.ok) {
        setDrawerOpen(false);
        resetForm();
        setReload(value => value + 1);
      } else {
        const data = await res.json();
        setError(data.error || "Unable to create recurring bill");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create recurring bill";
      setError(message.startsWith("[") ? "Check the name, supplier, dates and occurrence limit" : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Recurring Bills
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up supplier bills that get created automatically on a schedule,
            so you never have to re-key the same monthly bill.
          </p>
        </div>
        <Button
          onClick={() => setDrawerOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="mr-2 size-4" />
          New Recurring Bill
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Bill</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Gross Amount (before discount and tax)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  No recurring bills yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm font-medium">
                    {t.name}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.contact?.name || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {frequencyLabels[t.frequency] || t.frequency}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.nextRunDate || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[t.status] || ""}
                    >
                      {statusLabels[t.status] || t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.currencyCode}</TableCell>
                  <TableCell className="text-right font-mono break-words">{invoiceUiMoney(t.lines.reduce((sum, line) => sum + line.grossMinor, 0n), t.currencyCode)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) resetForm(); }}>
        <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col overflow-y-auto">
          <SheetHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b">
            <SheetTitle>New Recurring Bill</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6 pt-4 sm:px-6 space-y-4 flex-1 overflow-y-auto">
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <CurrencySelect value={currencyCode} onValueChange={(code) => { setCurrencyCode(code); setValidLines(false); }} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Monthly Software Subscription"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Supplier</label>
              <ContactPicker
                value={contactId}
                onChange={setContactId}
                type="supplier"
                placeholder="Select supplier..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reference</label>
              <Input
                placeholder="Optional bill reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Frequency</label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Occurrences</label>
              <Input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxOccurrences}
                onChange={(e) => setMaxOccurrences(e.target.value)}
              />
            </div>

            {drawerOpen && <LineItemsEditor lines={lines} onChange={(next) => { setLines(next); setValidLines(false); }}
              accountTypeFilter={["expense"]} taxContext="purchase" currencyCode={currencyCode}
              documentKind="recurringBill" priceFractionDigits={18} onValidityChange={setValidLines} />}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={submitting || !name.trim() || !contactId || !startDate || !validLines}
            >
              {submitting ? "Creating..." : "Create Recurring Bill"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
