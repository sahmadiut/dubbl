"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send, Check, X, FileText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { quoteUiDocument } from "@/lib/money/quote-ui";
import { QuoteMoneyDetails } from "@/components/dashboard/quote-money-details";
import { useEntityTitle } from "@/lib/hooks/use-entity-title";
import { SendDocumentDialog } from "@/components/dashboard/send-document-dialog";
import { EmailHistory } from "@/components/dashboard/email-history";
import Link from "next/link";

interface QuoteDetail {
  id: string; quoteNumber: string; issueDate: string; expiryDate: string; status: string;
  currencyCode: string; subtotal: bigint; taxTotal: bigint; total: bigint; billedTotal: bigint; notes: string | null;
  contact: { name: string; email: string | null } | null;
  lines: { id: string; description: string; quantity: number; unitPrice: bigint; amount: bigint; taxAmount: bigint; account: { code: string; name: string } | null }[];
}

interface QuoteWire extends Omit<QuoteDetail, "subtotal" | "taxTotal" | "total" | "billedTotal" | "lines"> {
  subtotal: number; taxTotal: number; total: number; billedTotal: number;
  lines: (Omit<QuoteDetail["lines"][number], "unitPrice" | "amount" | "taxAmount"> & {
    unitPrice: number; amount: number; taxAmount: number; [key: string]: unknown;
  })[];
  [key: string]: unknown;
}

const statusColors: Record<string, string> = {
  draft: "", sent: "border-blue-200 bg-blue-50 text-blue-700", accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  declined: "border-red-200 bg-red-50 text-red-700", expired: "border-gray-200 bg-gray-50 text-gray-700", converted: "border-purple-200 bg-purple-50 text-purple-700",
};

// Plain-language status labels (end users aren't accountants).
const statusLabels: Record<string, string> = {
  draft: "draft", sent: "sent", accepted: "accepted",
  declined: "declined", expired: "expired", converted: "turned into an invoice",
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ context: string; quote: QuoteDetail } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailHistoryKey, setEmailHistoryKey] = useState(0);
  const [orgName, setOrgName] = useState("");
  const orgId = typeof window !== "undefined" ? localStorage.getItem("activeOrgId") : null;
  const context = `${orgId}:${id}`;
  const currentContext = useRef(context);
  useEffect(() => { currentContext.current = context; }, [context]);
  const q = loaded?.context === context ? loaded.quote : null;
  useEntityTitle(q?.quoteNumber);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null); setError(null); setLoading(true); setOrgName(""); setSendDialogOpen(false);
    if (!orgId) { setLoading(false); return; }
    fetch(`/api/v1/quotes/${id}`, { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("Unable to load quote"); return r.json(); })
      .then(data => { const quote = quoteUiDocument(data.quote as QuoteWire); if (!controller.signal.aborted) setLoaded({ context, quote }); })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load valid quote amounts. Try again."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    fetch("/api/v1/organization", { headers: { "x-organization-id": orgId }, signal: controller.signal })
      .then(r => r.json()).then(data => { if (!controller.signal.aborted && data.organization?.name) setOrgName(data.organization.name); }).catch(() => {});
    return () => controller.abort();
  }, [id, orgId, context]);

  async function refreshQuote() {
    if (!orgId) return;
    try {
      const response = await fetch(`/api/v1/quotes/${id}`, { headers: { "x-organization-id": orgId } });
      if (!response.ok) throw new Error("Unable to reload quote");
      const data = await response.json();
      const quote = quoteUiDocument(data.quote as QuoteWire);
      if (currentContext.current === context) { setLoaded({ context, quote }); setError(null); }
    } catch {
      if (currentContext.current === context) { setLoaded(null); setError("Unable to reload valid quote amounts. Try again."); }
    }
  }

  async function action(path: string) {
    if (!orgId) return;
    const res = await fetch(`/api/v1/quotes/${id}/${path}`, { method: "POST", headers: { "x-organization-id": orgId } });
    if (res.ok) { await refreshQuote(); toast.success("Done"); }
    else toast.error("Failed");
  }

  async function handleSendComplete() {
    if (!orgId) return;
    await refreshQuote();
    setEmailHistoryKey((k) => k + 1);
  }

  async function handleConvert() {
    if (!orgId) return;
    const res = await fetch(`/api/v1/quotes/${id}/convert`, { method: "POST", headers: { "x-organization-id": orgId } });
    if (res.ok) { const data = await res.json(); if (currentContext.current !== context) return; toast.success("Invoice created from this quote"); router.push(`/sales/${data.invoice.id}`); }
    else toast.error("Couldn't create an invoice from this quote");
  }

  if (loading) return <div className="space-y-6"><PageHeader title="Loading..." /></div>;
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!q) return <div className="space-y-6"><PageHeader title="Quote not found" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title={q.quoteNumber} description={`To: ${q.contact?.name || "Unknown"}`}>
        <Button variant="outline" size="sm" asChild><Link href="/sales/quotes"><ArrowLeft className="mr-2 size-4" />Back</Link></Button>
        {q.status === "draft" && <Button size="sm" onClick={() => setSendDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700"><Send className="mr-2 size-4" />Send</Button>}
        {q.status === "sent" && <>
          <Button size="sm" onClick={() => action("accept")} className="bg-emerald-600 hover:bg-emerald-700"><Check className="mr-2 size-4" />Accept</Button>
          <Button size="sm" variant="outline" onClick={() => action("decline")} className="text-red-600"><X className="mr-2 size-4" />Decline</Button>
        </>}
        {q.status === "accepted" && <Button size="sm" onClick={handleConvert} className="bg-emerald-600 hover:bg-emerald-700" title="Turn this accepted quote into an invoice you can send and get paid on"><FileText className="mr-2 size-4" />Create an invoice from this quote</Button>}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Badge variant="outline" className={statusColors[q.status] || ""}>{statusLabels[q.status] || q.status}</Badge>
        <span className="text-xs sm:text-sm text-muted-foreground">Issued {q.issueDate} · Expires {q.expiryDate}</span>
      </div>

      <QuoteMoneyDetails quote={q} />

      <EmailHistory key={emailHistoryKey} documentType="quote" documentId={id} />

      <SendDocumentDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentType="quote"
        documentId={id}
        documentNumber={q.quoteNumber}
        contactEmail={q.contact?.email}
        contactName={q.contact?.name}
        organizationName={orgName}
        amountDue={q.total}
        currencyCode={q.currencyCode}
        dueDate={q.expiryDate}
        issueDate={q.issueDate}
        sendApiUrl={`/api/v1/quotes/${id}/send`}
        onSent={handleSendComplete}
      />
    </div>
  );
}
