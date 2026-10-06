"use client";

import { payrollCentsInput } from "@/lib/money/payroll-input";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Landmark,
  Receipt,
  Wallet,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
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
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { BrandLoader } from "@/components/dashboard/brand-loader";
import { ContentReveal } from "@/components/ui/content-reveal";
import { payrollMoneyDisplay as formatMoney } from "@/lib/money/payroll-display";
import { bankMoneyDisplay } from "@/lib/money/bank-display";
import { useDocumentTitle } from "@/lib/hooks/use-document-title";

// ─── What payroll taxes look like by who you pay ────────────────────────────
// The remittance API (POST /api/v1/payroll/tax-payments) clears one of three
// liability buckets per allocation: income tax (→ GL 2220), payroll taxes such
// as Social Security / Medicare / unemployment (→ 2235), and pension & benefit
// withholdings (→ 2245). We surface those same buckets here as the "agencies"
// you owe, in plain language.
interface AgencyBucket {
  bucket: string; // value sent to the API as allocation.bucket
  agency: string; // who you pay
  what: string; // plain description of what it covers
  taxKind: string; // default taxKind stamped on the remittance
}

const AGENCY_BUCKETS: AgencyBucket[] = [
  {
    bucket: "income_tax",
    agency: "Tax authority — income tax",
    what: "Income tax withheld from employee pay",
    taxKind: "income_tax",
  },
  {
    bucket: "fica",
    agency: "Tax authority — payroll taxes",
    what: "Social Security, Medicare & unemployment",
    taxKind: "941",
  },
  {
    bucket: "pension",
    agency: "Pension & benefits provider",
    what: "Retirement & benefit amounts withheld",
    taxKind: "benefits",
  },
];

interface TaxPayment {
  id: string;
  periodStart: string;
  periodEnd: string;
  jurisdictionLevel: string;
  jurisdiction: string | null;
  taxKind: string | null;
  amount: number;
  currency: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

const jurisdictionLabels: Record<string, string> = {
  federal: "Federal",
  state: "State",
  local: "Local",
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Start of the current month, used as a sensible default coverage period.
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function TaxLiabilitiesPage() {
  useDocumentTitle("Payroll · Tax Liabilities");

  const orgId =
    typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;

  const [initialLoad, setInitialLoad] = useState(true);
  const [accruedTax, setAccruedTax] = useState(0);
  const [reportCurrency, setReportCurrency] = useState("USD");
  const [reportError, setReportError] = useState<string | null>(null);
  const [payments, setPayments] = useState<TaxPayment[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Record-payment sheet state ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const remittanceKey = useRef<string | null>(null);
  const remittanceInput = useRef<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formBucket, setFormBucket] = useState<string>(AGENCY_BUCKETS[0].bucket);
  const [formAmount, setFormAmount] = useState(""); // decimal string
  const [formPeriodStart, setFormPeriodStart] = useState(monthStartISO());
  const [formPeriodEnd, setFormPeriodEnd] = useState(todayISO());
  const [formJurisdiction, setFormJurisdiction] = useState<
    "federal" | "state" | "local"
  >("federal");
  const [formPaymentDate, setFormPaymentDate] = useState(todayISO());
  const [formReference, setFormReference] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // ── Load accrued tax + recorded payments ──
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    const headers = { "x-organization-id": orgId };

    Promise.all([
      fetch(`/api/v1/payroll/reports/tax-liability`, { headers })
        .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Unable to load tax liability"); return body; }),
      fetch(`/api/v1/payroll/tax-payments`, { headers })
        .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Unable to load tax payments"); return body; }),
    ]).then(([liability, paymentsRes]) => {
      if (cancelled) return;
      setReportError(null);
      setReportCurrency(liability.currency);
      setAccruedTax(liability.totalTax);
      setPayments(paymentsRes?.payments || []);
      setInitialLoad(false);
    }).catch(error => { if (!cancelled) { setReportError(error.message); setInitialLoad(false); } });

    return () => {
      cancelled = true;
    };
  }, [orgId, refreshKey]);

  const paidPayments = payments.filter(p => p.status === "paid");
  const compatibleCurrency = paidPayments.every(p => p.currency === reportCurrency);
  const totalPaid = paidPayments.reduce((s, p) => s + BigInt(p.amount), 0n);
  const difference = BigInt(accruedTax) - totalPaid;
  const outstanding = difference > 0n ? difference : 0n;
  const totalsError = reportError || (!compatibleCurrency ? "Tax totals contain multiple currencies." : null);

  const openRecordPayment = useCallback((bucket?: string) => {
    if (bucket) setFormBucket(bucket);
    setFormAmount("");
    setFormReference("");
    setFormNotes("");
    setFormPeriodStart(monthStartISO());
    setFormPeriodEnd(todayISO());
    setFormPaymentDate(todayISO());
    setFormJurisdiction("federal");
    setSheetOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!orgId) return;
    let cents: string;
    try { cents = payrollCentsInput(formAmount || "0"); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid amount"); return;
    }
    if (cents === "0") {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (!formPeriodStart || !formPeriodEnd) {
      toast.error("Choose the period this payment covers");
      return;
    }

    const selected = AGENCY_BUCKETS.find((b) => b.bucket === formBucket);

    const inputKey = JSON.stringify([formPeriodStart, formPeriodEnd, formJurisdiction, formBucket, cents, formPaymentDate, formReference, formNotes]);
    if (remittanceInput.current !== inputKey) { remittanceKey.current = null; remittanceInput.current = inputKey; }
    remittanceKey.current ??= crypto.randomUUID();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/payroll/tax-payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": orgId,
        },
        body: JSON.stringify({
          idempotencyKey: remittanceKey.current,
          periodStart: formPeriodStart,
          periodEnd: formPeriodEnd,
          jurisdictionLevel: formJurisdiction,
          taxKind: selected?.taxKind ?? null,
          allocations: [{ bucket: formBucket, amountMinor: cents }],
          paymentDate: formPaymentDate || undefined,
          reference: formReference || undefined,
          notes: formNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not record payment");
      }
      remittanceKey.current = null;
      toast.success("Payment recorded");
      setSheetOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  }, [
    orgId,
    formAmount,
    formBucket,
    formPeriodStart,
    formPeriodEnd,
    formJurisdiction,
    formPaymentDate,
    formReference,
    formNotes,
  ]);

  // Per-agency paid totals so each row shows how much has been remitted to it.
  const paidByBucket = useMemo(() => {
    const map: Record<string, bigint> = {};
    // taxKind is the only signal we stamp; map it back to a bucket for display.
    for (const p of payments.filter(p => p.status === "paid")) {
      const matched = AGENCY_BUCKETS.find(
        (b) => b.taxKind === p.taxKind,
      );
      const key = matched?.bucket ?? "income_tax";
      map[key] = (map[key] || 0n) + BigInt(p.amount);
    }
    return map;
  }, [payments]);

  const paymentColumns = useMemo<Column<TaxPayment>[]>(
    () => [
      {
        key: "period",
        header: "Period covered",
        render: (r) => (
          <span className="text-sm">
            {r.periodStart} → {r.periodEnd}
          </span>
        ),
      },
      {
        key: "kind",
        header: "Covers",
        render: (r) => {
          const matched = AGENCY_BUCKETS.find((b) => b.taxKind === r.taxKind);
          return (
            <span className="text-sm">
              {matched?.agency ?? r.taxKind ?? "Payroll tax"}
            </span>
          );
        },
      },
      {
        key: "jurisdiction",
        header: "Level",
        className: "w-24",
        render: (r) => (
          <Badge variant="outline">
            {jurisdictionLabels[r.jurisdictionLevel] || r.jurisdictionLevel}
            {r.jurisdiction ? ` · ${r.jurisdiction}` : ""}
          </Badge>
        ),
      },
      {
        key: "reference",
        header: "Reference",
        className: "w-40",
        render: (r) => (
          <span className="font-mono text-xs text-muted-foreground">
            {r.reference || "-"}
          </span>
        ),
      },
      {
        key: "paid",
        header: "Paid on",
        className: "w-28",
        render: (r) => (
          <span className="text-sm">
            {r.paidAt ? r.paidAt.split("T")[0] : "-"}
          </span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        className: "w-28 text-right",
        render: (r) => (
          <span className="font-mono text-sm tabular-nums">
            {bankMoneyDisplay(r.amount, r.currency || "USD")}
          </span>
        ),
      },
    ],
    [],
  );

  if (initialLoad) return <BrandLoader />;

  return (
    <ContentReveal className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Payroll tax liabilities
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            What payroll taxes you owe from completed pay runs, who to pay, and a
            record of payments you&apos;ve made.
          </p>
        </div>
        <Button
          onClick={() => openRecordPayment()}
          className="bg-emerald-600 shrink-0 hover:bg-emerald-700"
        >
          <Plus className="mr-2 size-4" />
          Record payment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          title="Owed from pay runs"
          value={totalsError ? "Unavailable" : formatMoney(accruedTax, reportCurrency)}
          icon={Receipt}
        />
        <StatCard
          title="Paid so far"
          value={totalsError ? "Unavailable" : formatMoney(totalPaid, reportCurrency)}
          icon={CheckCircle2}
        />
        <StatCard
          title="Still outstanding"
          value={totalsError ? "Unavailable" : formatMoney(outstanding, reportCurrency)}
          icon={Wallet}
        />
      </div>

      <div className="h-px bg-border" />

      {totalsError && <p role="alert" className="text-sm text-destructive">{totalsError}</p>}

      {/* Who you owe — by agency / type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Who you pay</h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {AGENCY_BUCKETS.map((b) => {
            const paid = paidByBucket[b.bucket] || 0n;
            return (
              <div
                key={b.bucket}
                className="flex flex-col justify-between rounded-xl border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-medium">{b.agency}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.what}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Paid to date
                    <span className="ml-1.5 font-mono tabular-nums text-foreground">
                      {totalsError ? "Unavailable" : formatMoney(paid, reportCurrency)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRecordPayment(b.bucket)}
                  >
                    Record payment
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {!totalsError && outstanding > 0n && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {formatMoney(outstanding, reportCurrency)} of withheld payroll tax has not been
              remitted yet. Record a payment when you pay it so your books match
              what&apos;s actually left to pay.
            </span>
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Payment history */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Payments recorded</h3>
        <DataTable
          columns={paymentColumns}
          data={payments}
          loading={false}
          emptyMessage="No payroll tax payments recorded yet."
        />
      </div>

      {/* Record-payment sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Record a payroll tax payment</SheetTitle>
            <SheetDescription>
              Logs the payment and clears the matching liability against your bank
              in the books.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label>Who you&apos;re paying</Label>
              <Select value={formBucket} onValueChange={setFormBucket}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_BUCKETS.map((b) => (
                    <SelectItem key={b.bucket} value={b.bucket}>
                      {b.agency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Amount paid</Label>
              <CurrencyInput
                value={formAmount}
                onChange={setFormAmount}
                prefix="$"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Period from</Label>
                <DatePicker
                  value={formPeriodStart}
                  onChange={setFormPeriodStart}
                  placeholder="Start"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Period to</Label>
                <DatePicker
                  value={formPeriodEnd}
                  onChange={setFormPeriodEnd}
                  placeholder="End"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select
                  value={formJurisdiction}
                  onValueChange={(v) =>
                    setFormJurisdiction(v as "federal" | "state" | "local")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="federal">Federal</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Paid on</Label>
                <DatePicker
                  value={formPaymentDate}
                  onChange={setFormPaymentDate}
                  placeholder="Payment date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                placeholder="Confirmation / EFTPS number"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional note about this payment"
                rows={3}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? "Recording..." : "Record payment"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentReveal>
  );
}
